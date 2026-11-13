/**
 * 用 LLM 重新整理現代化的詞條（詞義、中文釋義、英英釋義、常用程度、語域），
 * 以 ECDICT 中文釋義與 OEWN 詞義為參考依據 → data/llm/entries/<目錄>/<字首>.json
 *
 * 只產生資料，不寫入資料庫。例句沿用 Tatoeba 與既有 LLM 例句，這裡不處理。
 * 輸出依字首分檔（a.json … z.json，其他字元放 0.json），避免單一檔案過大。
 * 已在輸出目錄裡的字會跳過，中斷後重跑會接續；失敗的字記在 failed.json，重跑時會再試。
 *
 * 參數：
 *   --words=a,b,c       只跑指定的字（試跑用）；不給則跑全部詞條（依詞頻排序）
 *   --limit=N           最多處理幾個字
 *   --max-rank=N        只跑詞頻排名 ≤ N 的字
 * 餘額不足（HTTP 402）或金鑰無效（401）時存檔後停止。
 *   --out-dir=full      輸出目錄（data/llm/entries/ 底下）
 *   --concurrency=12
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { withoutTechnicalGlosses } from "../../src/lib/gloss";
import { connect, getArg, ROOT, run } from "../import/lib";
import { chatJson, DEEPSEEK_MODEL, usageTotals } from "./deepseek";
import { zhProblems } from "./validate";

const MAX_SENSES = 15;
const MAX_ATTEMPTS = 2;
const WORDNET_SENSES = 15;
const SAVE_EVERY = 200; // 每完成幾個字存檔一次

export const USAGE_LEVELS = ["common", "less_common", "rare"] as const;
export const REGISTERS = ["formal", "informal", "slang", "literary", "old", "technical", "offensive"] as const;
const POS = new Set(["n.", "v.", "adj.", "adv.", "prep.", "conj.", "pron.", "int.", "det.", "num.", "abbr.", "phr."]);

type Input = {
  headword: string;
  frequencyRank: number | null;
  zh: string[];
  wordnet: { id: string; pos: string; def: string }[];
};
export type EntrySense = {
  pos: string;
  label: string; // 簡短中文標籤
  zh: string; // 中文說明（什麼情境用這個意思）
  en: string; // 學習者風格的英英釋義
  usage: (typeof USAGE_LEVELS)[number];
  register: (typeof REGISTERS)[number][];
  synsets: string[];
};
export type EntryWord = { headword: string; senses: EntrySense[]; omitted: { meaning: string; reason: string }[] };
export type EntryFile = { model: string; generatedAt: string; method: string; words: EntryWord[] };

const METHOD = "scripts/llm/generate-entries.ts：以 ECDICT 中文釋義與 OEWN 詞義為參考，整理現代化詞義、中英釋義、常用程度與語域";

const SYSTEM_PROMPT = `你是給台灣學習者用的現代英文學習字典的編輯。使用者會給你一個英文單字的參考資料（JSON）：
- zh：舊英漢字典的中文釋義（依詞性分行）。常混有古義、罕用義與舊字典的誤譯，排序也不依現代用法
- wordnet：WordNet 詞義（id、詞性、英文定義）。收得很細，排序不代表常用程度，也收了不少古義
- frequencyRank：詞頻排名（越小越常用），可能為 null

請以「現代英文（2020 年代）實際怎麼用」為準，重新整理這個字，以 JSON 回覆：
{"senses":[{"pos":"adj.","label":"擔心的、憂慮的","zh":"擔心將來可能發生不好的事","en":"worried or nervous that something bad or unpleasant will happen","usage":"common","register":[],"synsets":["00826475-s"]}],
 "omitted":[{"meaning":"敏悟的、知曉的","reason":"古義，現代已不使用"}]}

規則：
1. senses 依現代常用程度排序，最常用的放第一個。意思相近的合併，學習者看得懂的粗細即可：常用字通常 2–6 個，罕用字 1–2 個。
2. **古義一律放進 omitted，不要列在 senses**，即使參考資料有列、即使排在第一個。判斷標準：現代報章、網路、日常對話裡幾乎遇不到的意思。
   例如 apprehensive 的「理解力強的」、awful 的「令人敬畏的」、nice 的「謹慎的」都是古義。
3. **主動檢查現代網路、科技、社群、串流、職場用法**，參考資料沒有也要補上，並依實際常用程度排序。
   例如 stream 的「串流（影音）」、ghost 的「（交友、社群）突然斷聯、搞失蹤」、cloud 的「雲端」、feed 的「動態消息」。
   但不要發明不存在的意思，也不要把別的字的用法套到這個字上。
4. usage：common（現代常用，一般學習者會遇到）、less_common（看得到但不常用）、rare（罕用，只在特定文體或領域出現）。
   不要每個都標 common：只有這個字最主要的幾個意思才是 common。
5. register：適用時填，可多個，否則空陣列。formal（正式）、informal（口語）、slang（俚語）、literary（文學）、old（舊式說法，仍看得懂但已過時）、technical（專業術語）、offensive（冒犯）。
6. label：2–12 字的台灣繁體中文標籤，可用頓號列 2–3 個近義說法，括號補充搭配對象，例如「提高（價格、數量）」。只寫這個意思本身，不要加入參考資料沒有的形容。
7. zh：一句簡短的中文說明，讓學習者知道什麼情境用這個意思，不要只是重複 label。
8. en：學習者字典風格的英文定義，用常見單字寫成，通常 6–20 個字，盡量不用這個字本身或它的變化形來解釋。
   **用你自己的話撰寫**，不要照抄或模仿任何現有字典（Cambridge、Oxford、Longman、Merriam-Webster、Collins 等）的定義原文。
9. synsets：這個詞義對應的 WordNet id（必須來自輸入，可多個，沒有就空陣列）。
10. omitted：參考資料裡有、但你沒列進 senses 的意思，簡短說明原因（古義、罕用、專業領域過窄、與某詞義重複、誤譯等）。沒有就空陣列。

中文一律使用台灣繁體與台灣用語、全形標點，絕對不要出現簡體字。只回覆 JSON。`;

const shardOf = (headword: string) => (/^[a-z]/.test(headword) ? headword[0] : "0");

/** 讀取輸出目錄裡已完成的字（依分檔） */
function loadShards(dir: string): Map<string, EntryFile> {
  const shards = new Map<string, EntryFile>();
  if (!existsSync(dir)) return shards;
  for (const f of readdirSync(dir).filter((f) => /^[a-z0]\.json$/.test(f))) {
    shards.set(f.replace(".json", ""), JSON.parse(readFileSync(path.join(dir, f), "utf8")) as EntryFile);
  }
  return shards;
}

/** 存檔；Windows 上檔案偶爾被防毒或編輯器暫時鎖住（EBUSY／UNKNOWN），稍等後重試 */
function saveJson(file: string, data: unknown) {
  for (let attempt = 1; ; attempt++) {
    try {
      writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
      return;
    } catch (err) {
      if (attempt >= 10) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * attempt);
    }
  }
}

async function loadInputs(
  db: ReturnType<typeof connect>["db"],
  words: string[] | null,
  done: Set<string>,
  limit: number,
  maxRank: number | null,
) {
  const { rows: heads } = await db.execute<{ headword: string; rank: number | null }>(
    words
      ? sql`SELECT headword, frequency_rank AS rank FROM dict_entries WHERE headword IN (${sql.join(words.map((w) => sql`${w}`), sql`, `)})`
      : maxRank !== null
        ? sql`SELECT headword, frequency_rank AS rank FROM dict_entries WHERE frequency_rank <= ${maxRank} ORDER BY frequency_rank, headword`
        : sql`SELECT headword, frequency_rank AS rank FROM dict_entries ORDER BY frequency_rank NULLS LAST, headword`,
  );
  if (words) {
    const found = new Set(heads.map((h) => h.headword));
    const missing = words.filter((w) => !found.has(w));
    if (missing.length) console.warn(`字典沒有這些字，略過：${missing.join(", ")}`);
  }
  const picked = heads.filter((h) => !done.has(h.headword)).slice(0, limit);

  // 一次取出所有釋義，避免逐字查詢
  const defsByWord = new Map<string, { lang: string; pos: string | null; text: string; ref: string | null }[]>();
  for (let i = 0; i < picked.length; i += 2000) {
    const batch = picked.slice(i, i + 2000).map((h) => h.headword);
    const { rows } = await db.execute<{ headword: string; lang: string; pos: string | null; text: string; ref: string | null }>(sql`
      SELECT headword, lang, pos, text, source_ref AS ref FROM dict_definitions
      WHERE headword IN (${sql.join(batch.map((w) => sql`${w}`), sql`, `)}) ORDER BY headword, lang, sort_order`);
    for (const r of rows) {
      const list = defsByWord.get(r.headword) ?? [];
      list.push(r);
      defsByWord.set(r.headword, list);
    }
  }

  return picked.map(({ headword, rank }): Input => {
    const defs = defsByWord.get(headword) ?? [];
    return {
      headword,
      frequencyRank: rank,
      zh: withoutTechnicalGlosses(defs.filter((d) => d.lang === "zh-TW")).map((d) => (d.pos ? `${d.pos} ${d.text}` : d.text)),
      wordnet: defs
        .filter((d) => d.lang === "en" && d.ref)
        .slice(0, WORDNET_SENSES)
        .map((d) => ({ id: d.ref!, pos: d.pos ?? "", def: d.text })),
    };
  });
}

/** 檢查模型回覆，通過時轉成要存的格式 */
function parse(input: Input, json: unknown): { word: EntryWord } | { problems: string[] } {
  const problems: string[] = [];
  const data = json as { senses?: unknown; omitted?: unknown };
  const senses = Array.isArray(data.senses) ? (data.senses as Partial<Record<keyof EntrySense, unknown>>[]) : [];
  if (senses.length < 1 || senses.length > MAX_SENSES) problems.push(`詞義數 ${senses.length}`);
  const wordnetIds = new Set(input.wordnet.map((w) => w.id));

  const clean: EntrySense[] = senses.map((s, i) => {
    const at = `詞義 ${i + 1}`;
    const pos = String(s.pos ?? "").trim().replace(/^v[ti]\.$/, "v."); // vt. vi. 統一成 v.
    const label = String(s.label ?? "").trim();
    const zh = String(s.zh ?? "").trim();
    const en = String(s.en ?? "").trim();
    const usage = String(s.usage ?? "") as EntrySense["usage"];
    const register = (Array.isArray(s.register) ? s.register : []).map(String) as EntrySense["register"];
    if (!POS.has(pos)) problems.push(`${at} 詞性不對：${pos}`);
    if (!label || label.length > 24) problems.push(`${at} 標籤長度不對：${label}`);
    if (!zh) problems.push(`${at} 沒有中文說明`);
    if (!en) problems.push(`${at} 沒有英文定義`);
    if (!USAGE_LEVELS.includes(usage)) problems.push(`${at} usage 不對：${usage}`);
    if (register.some((r) => !REGISTERS.includes(r))) problems.push(`${at} register 不對：${register.join(",")}`);
    for (const text of [label, zh]) problems.push(...zhProblems(text).map((p) => `${at} ${p}`));
    return { pos, label, zh, en, usage, register, synsets: (Array.isArray(s.synsets) ? s.synsets : []).map(String).filter((id) => wordnetIds.has(id)) };
  });

  const omitted = (Array.isArray(data.omitted) ? (data.omitted as { meaning?: unknown; reason?: unknown }[]) : []).map((o) => ({
    meaning: String(o.meaning ?? "").trim(),
    reason: String(o.reason ?? "").trim(),
  }));
  if (problems.length) return { problems };
  return { word: { headword: input.headword, senses: clean, omitted } };
}

run(async () => {
  const words = getArg("words")?.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean) ?? null;
  const limit = Number(getArg("limit") ?? Infinity);
  const maxRank = getArg("max-rank") ? Number(getArg("max-rank")) : null;
  const concurrency = Number(getArg("concurrency") ?? 12);
  const outDir = path.join(ROOT, "data/llm/entries", getArg("out-dir") ?? "full");
  mkdirSync(outDir, { recursive: true });
  const failedPath = path.join(outDir, "failed.json");

  const shards = loadShards(outDir);
  const done = new Set([...shards.values()].flatMap((s) => s.words.map((w) => w.headword)));
  const dirty = new Set<string>();
  const save = () => {
    for (const key of dirty) {
      const shard = shards.get(key)!;
      shard.words.sort((a, b) => a.headword.localeCompare(b.headword));
      saveJson(path.join(outDir, `${key}.json`), shard);
    }
    dirty.clear();
  };

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set（請確認 .env.local）");
  const { db, close } = connect();
  let queue: { input: Input; attempts: number }[];
  try {
    queue = (await loadInputs(db, words, done, limit, maxRank)).map((input) => ({ input, attempts: 0 }));
  } finally {
    await close();
  }
  const total = queue.length;
  console.log(`已完成 ${done.size} 字；這次處理 ${total} 個字，同時 ${concurrency} 個請求 → ${path.relative(ROOT, outDir)}`);

  const failed: { headword: string; problems: string[] }[] = [];
  const usage = usageTotals();
  const started = Date.now();
  let finished = 0;
  let model: string = DEEPSEEK_MODEL;
  let stopReason = null as string | null; // 餘額不足等無法繼續的錯誤：存檔後停止，剩下的字留待下次

  const worker = async () => {
    for (let item = queue.shift(); item && !stopReason; item = queue.shift()) {
      item.attempts++;
      let parsed: ReturnType<typeof parse>;
      try {
        const result = await chatJson(key, SYSTEM_PROMPT, JSON.stringify(item.input), { temperature: 0.3 });
        usage.add(result.usage);
        model = result.model;
        parsed = parse(item.input, result.json);
      } catch (err) {
        const message = (err as Error).message;
        if (/HTTP (401|402)/.test(message)) {
          stopReason = message;
          break;
        }
        parsed = { problems: [`請求失敗：${message}`] };
      }
      if ("word" in parsed) {
        const k = shardOf(parsed.word.headword);
        const shard = shards.get(k) ?? { model, generatedAt: new Date().toISOString().slice(0, 10), method: METHOD, words: [] };
        shard.model = model;
        shard.words.push(parsed.word);
        shards.set(k, shard);
        dirty.add(k);
      } else if (item.attempts < MAX_ATTEMPTS) {
        queue.push(item);
        continue;
      } else {
        failed.push({ headword: item.input.headword, problems: parsed.problems });
      }
      finished++;
      if (finished % SAVE_EVERY === 0 || finished === total) {
        save();
        const mins = (Date.now() - started) / 60000;
        const eta = (mins / finished) * (total - finished);
        console.log(`  ${finished}/${total}（失敗 ${failed.length}），已 ${mins.toFixed(1)} 分，預估剩 ${eta.toFixed(0)} 分｜${usage}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  save();
  if (stopReason) console.log(`\n中途停止（${stopReason.slice(0, 120)}），已完成的字都已存檔，補足後重跑會接續`);

  // 失敗清單只保留這次仍失敗的字（成功的字下次會因 done 而跳過）
  saveJson(failedPath, failed);
  console.log(`\n結束：成功 ${finished - failed.length} 字，失敗 ${failed.length} 字，未處理 ${total - finished} 字（${path.relative(ROOT, failedPath)}）`);
  console.log(usage.toString());
  for (const f of failed.slice(0, 20)) console.log(`失敗 ${f.headword}：${f.problems.slice(0, 3).join("；")}`);
});
