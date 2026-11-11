/**
 * 例句依詞義分組（docs/SENSE-GROUPING.md）：用 DeepSeek 為每個字整理 1–8 個粗分詞義（介面只顯示有例句的）、
 * 把每句例句分到一個詞義，並修正有問題的中文翻譯 → data/llm/senses/<檔名>.json
 *
 * 挑字：例句數 ≥ --min-examples（預設 5）的字，依詞頻排序；或用 --words=raise,run 指定。
 * 已出現在 data/llm/senses/ 任一檔案的字會跳過，中斷後重跑會接續。
 * 例句以英文原文對應（資料庫的例句 id 重新匯入後會變）。
 *
 * 參數：--words=a,b,c --min-examples=5 --limit=50 --concurrency=6 --out=檔名.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { withoutTechnicalGlosses } from "../../src/lib/gloss";
import { connect, getArg, ROOT, run } from "../import/lib";
import { chatJson, DEEPSEEK_MODEL, usageTotals } from "./deepseek";
import { zhProblems } from "./validate";

const DATA_DIR = path.join(ROOT, "data/llm/senses");
const MAX_SENSES = 8;
const MAX_ATTEMPTS = 2;
const WORDNET_SENSES = 12; // 每個字最多提供幾個 WordNet 詞義當參考

type Input = {
  headword: string;
  zh: string[];
  wordnet: { id: string; pos: string; def: string }[];
  examples: { id: number; en: string; zh: string }[];
};
export type Sense = { pos: string; label: string; gloss: string; synsets: string[] };
export type SenseExample = { en: string; sense: number; zhFix: string | null };
export type SenseWord = { headword: string; senses: Sense[]; examples: SenseExample[] };
type OutFile = { model: string; generatedAt: string; method: string; words: SenseWord[] };

const SYSTEM_PROMPT = `你是英文學習字典的編輯。使用者會給你一個英文單字的資料（JSON）：
- zh：中文釋義（依詞性分行）
- wordnet：WordNet 詞義（id、詞性、英文定義），依常用程度排序
- examples：這個字的例句（id、英文、中文翻譯）

請做三件事，以 JSON 回覆：
{"senses":[{"pos":"v.","label":"舉起、抬高","gloss":"lift to a higher position","synsets":["01974062-v"]}],
 "examples":[{"id":123,"sense":1,"zh_fix":null}]}

1. senses：把這個字整理成學習者看得懂的粗分詞義，依常用程度排序，通常 2–6 個。
   - 以 zh 與 wordnet 為依據，不要發明字典沒有的意思；意思相近的 WordNet 詞義合併成一個，不要分得太細。
   - 以例句實際用到的意思為主；例句沒用到的意思，最多再列 1 個最常見的。
   - pos 用 n. v. adj. adv. prep. conj. 等；label 是 2–10 個字的台灣繁體中文標籤，可用頓號列出 2–3 個近義說法，括號補充搭配對象，例如「提高（價格、數量）」；gloss 是簡短英文說明；synsets 列出合併進來的 WordNet id（必須來自輸入）。
2. examples：每一句例句都要列出，sense 填它屬於第幾個詞義（從 1 開始）；判斷不出來或不屬於任何詞義就填 0。
3. zh_fix：只有在中文翻譯「意思錯誤、漏譯、意思跑掉、逐字直譯到看不懂」，或用了大陸用語（例如「漲工資」→「加薪」、「遊戲」指比賽時改「比賽」）時，才填修正後的台灣繁體翻譯。
   其他情況一律填 null：意思正確只是不夠漂亮、數字寫法（8點半／八點半）、標點、語氣詞（了、吧）、同義換字，都不要改。大多數句子應該是 null。

中文一律使用台灣繁體與台灣用語、全形標點，絕對不要出現簡體字。只回覆 JSON。`;

async function loadInputs(db: ReturnType<typeof connect>["db"], words: string[] | null, minExamples: number, done: Set<string>, limit: number) {
  const { rows: heads } = await db.execute<{ headword: string }>(
    words
      ? sql`SELECT headword FROM dict_entries WHERE headword IN (${sql.join(words.map((w) => sql`${w}`), sql`, `)})`
      : sql`SELECT e.headword FROM dict_entries e
            JOIN (SELECT headword, count(*) n FROM dict_example_words GROUP BY headword) c ON c.headword = e.headword
            WHERE c.n >= ${minExamples} ORDER BY e.frequency_rank NULLS LAST, e.headword`,
  );
  const picked = heads.map((h) => h.headword).filter((h) => !done.has(h)).slice(0, limit);
  const inputs: Input[] = [];
  for (const headword of picked) {
    const { rows: defs } = await db.execute<{ lang: string; pos: string | null; text: string; ref: string | null }>(
      sql`SELECT lang, pos, text, source_ref AS ref FROM dict_definitions WHERE headword = ${headword} ORDER BY lang, sort_order`,
    );
    const { rows: exs } = await db.execute<{ id: number; en: string; zh: string | null }>(sql`
      SELECT e.id, e.text_en AS en, e.text_zh AS zh FROM dict_example_words w JOIN dict_examples e ON e.id = w.example_id
      WHERE w.headword = ${headword} ORDER BY w.score DESC, length(e.text_en)`);
    inputs.push({
      headword,
      zh: withoutTechnicalGlosses(defs.filter((d) => d.lang === "zh-TW")).map((d) => (d.pos ? `${d.pos} ${d.text}` : d.text)),
      wordnet: defs
        .filter((d) => d.lang === "en" && d.ref)
        .slice(0, WORDNET_SENSES)
        .map((d) => ({ id: d.ref!, pos: d.pos ?? "", def: d.text })),
      examples: exs.map((e) => ({ id: e.id, en: e.en, zh: e.zh ?? "" })),
    });
  }
  return inputs;
}

const CN_DIGITS: Record<string, string> = { 零: "0", 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9", 十: "10" };
/** 比較翻譯用：去掉標點、空白與語氣詞，中文數字轉阿拉伯數字 */
const normalizeZh = (s: string) =>
  s
    .replace(/[\s，。、！？：；「」『』（）,.!?:;()"'…—-]/g, "")
    .replace(/[了吧呢啊呀嗎]/g, "")
    .replace(/[零一二三四五六七八九十]/g, (c) => CN_DIGITS[c]);

/** 檢查模型回覆，通過時轉成要存的格式（例句改用英文原文對應） */
function parse(input: Input, json: unknown): { word: SenseWord } | { problems: string[] } {
  const problems: string[] = [];
  const data = json as { senses?: unknown; examples?: unknown };
  const senses = Array.isArray(data.senses) ? (data.senses as Partial<Sense>[]) : [];
  if (senses.length < 1 || senses.length > MAX_SENSES) problems.push(`詞義數 ${senses.length}`);
  const wordnetIds = new Set(input.wordnet.map((w) => w.id));
  const cleanSenses: Sense[] = senses.map((s, i) => {
    const label = String(s.label ?? "").trim();
    if (!label || label.length > 24) problems.push(`詞義 ${i + 1} 標籤長度不對：${label}`);
    problems.push(...zhProblems(label).map((p) => `詞義 ${i + 1} ${p}`));
    return {
      pos: String(s.pos ?? "").trim(),
      label,
      gloss: String(s.gloss ?? "").trim(),
      synsets: (Array.isArray(s.synsets) ? s.synsets : []).map(String).filter((id) => wordnetIds.has(id)),
    };
  });
  const answers = new Map<number, { sense?: unknown; zh_fix?: unknown }>();
  for (const e of Array.isArray(data.examples) ? (data.examples as { id?: unknown; sense?: unknown; zh_fix?: unknown }[]) : []) answers.set(Number(e.id), e);
  const examples: SenseExample[] = [];
  for (const ex of input.examples) {
    const a = answers.get(ex.id);
    const sense = Number(a?.sense);
    if (!a || !Number.isInteger(sense) || sense < 0 || sense > cleanSenses.length) {
      problems.push(`例句 ${ex.id} 沒有分組或編號不對`);
      continue;
    }
    const proposed = typeof a.zh_fix === "string" ? a.zh_fix.trim() : "";
    // 只差標點、空白、數字寫法或語氣詞的修正不採用
    const zhFix = proposed && normalizeZh(proposed) !== normalizeZh(ex.zh) ? proposed : null;
    if (zhFix) problems.push(...zhProblems(zhFix).map((p) => `例句 ${ex.id} 修正翻譯 ${p}`));
    examples.push({ en: ex.en, sense, zhFix });
  }
  if (problems.length) return { problems };
  return { word: { headword: input.headword, senses: cleanSenses, examples } };
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

function existingHeadwords(): Set<string> {
  const set = new Set<string>();
  if (!existsSync(DATA_DIR)) return set;
  for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
    for (const w of (JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8")) as OutFile).words) set.add(w.headword);
  }
  return set;
}

run(async () => {
  const words = getArg("words")?.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean) ?? null;
  const minExamples = Number(getArg("min-examples") ?? 5);
  const limit = Number(getArg("limit") ?? 50);
  const concurrency = Number(getArg("concurrency") ?? 6);
  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, getArg("out") ?? `${new Date().toISOString().slice(0, 10)}-deepseek.json`);

  const { db, close } = connect();
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set（請確認 .env.local）");
  let queue: { input: Input; attempts: number }[];
  try {
    queue = (await loadInputs(db, words, minExamples, existingHeadwords(), limit)).map((input) => ({ input, attempts: 0 }));
  } finally {
    await close();
  }
  console.log(`這次處理 ${queue.length} 個字，同時 ${concurrency} 個請求 → ${path.relative(ROOT, outPath)}`);

  const out: OutFile = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : {
        model: DEEPSEEK_MODEL,
        generatedAt: new Date().toISOString().slice(0, 10),
        method: "scripts/llm/generate-senses.ts：依 ECDICT 中文釋義與 OEWN 詞義整理粗分詞義、例句分組、修正中文翻譯",
        words: [],
      };
  const failed: { headword: string; problems: string[] }[] = [];
  const usage = usageTotals();

  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      item.attempts++;
      const { input } = item;
      const result = await chatJson(key, SYSTEM_PROMPT, JSON.stringify(input), { temperature: 0.3 });
      usage.add(result.usage);
      out.model = result.model;
      const parsed = parse(input, result.json);
      if ("word" in parsed) {
        out.words.push(parsed.word);
        saveJson(outPath, out);
        const fixes = parsed.word.examples.filter((e) => e.zhFix).length;
        console.log(`  ${input.headword}：${parsed.word.senses.length} 個詞義、${input.examples.length} 句、修正翻譯 ${fixes} 句`);
      } else if (item.attempts < MAX_ATTEMPTS) {
        queue.push(item);
      } else {
        failed.push({ headword: input.headword, problems: parsed.problems });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\n成功 ${out.words.length} 字（檔案累計），失敗 ${failed.length} 字`);
  console.log(usage.toString());
  for (const f of failed) console.log(`失敗 ${f.headword}：${f.problems.slice(0, 5).join("；")}`);
});
