/**
 * 找出「掛錯字」的 Tatoeba 例句 → data/llm/form-filter/<檔名>.json（之後由 npm run import:llm-form-filter 套用）
 *
 * 問題：Tatoeba 匯入時沒有判斷詞性，一個字如果本身是詞條、又是另一個字的變化形（accomplished 是形容詞，
 * 也是 accomplish 的過去式），句子會同時掛到兩個詞條底下，所以 accomplished 頁面出現 "He accomplished his mission."。
 * 這支腳本請 DeepSeek 逐句判斷：句中的字是用這個詞條自己的意思，還是只是原形的變化形（時態、被動、進行式等）。
 * 判斷為後者的句子，匯入時從這個詞條移除（原形底下的例句不受影響）。
 *
 * 挑字：本身是詞條、同時是另一個詞條的過去式／過去分詞／現在分詞／第三人稱單數（dict_word_forms kind p/d/i/3），
 * 有 Tatoeba 例句、而且自己有不屬於變化形的意思（went 這種只有「go 的過去式」的字不處理）。依詞頻排序。
 * 已出現在 data/llm/form-filter/ 任一檔案的字會跳過，中斷後重跑會接續。
 * 例句以英文原文對應（資料庫的例句 id 重新匯入後會變）。
 *
 * 參數：--words=a,b,c --limit=2000 --concurrency=6 --out=檔名.json
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { connect, getArg, ROOT, run } from "../import/lib";
import { chatJson, DEEPSEEK_MODEL, usageTotals } from "./deepseek";

const DATA_DIR = path.join(ROOT, "data/llm/form-filter");
const MAX_ATTEMPTS = 2;
const FORM_KINDS = ["p", "d", "i", "3"];
const KIND_LABEL: Record<string, string> = { p: "過去式", d: "過去分詞", i: "現在分詞", "3": "第三人稱單數" };
/** 釋義裡標示「X 的過去式」這類變化形說明的行，不算這個字自己的意思 */
const INFLECTION_GLOSS = /過去式|過去分詞|現在分詞|第三人稱|的複數|的比較級|的最高級/;

type Input = {
  headword: string;
  meanings: string[]; // 這個字自己的意思（不含變化形說明）
  formOf: { lemma: string; kind: string; meanings: string[] }[];
  examples: { id: number; en: string }[];
};
export type FormFilterExample = { en: string; keep: boolean };
export type FormFilterWord = { headword: string; lemmas: string[]; examples: FormFilterExample[] };
type OutFile = { model: string; generatedAt: string; method: string; words: FormFilterWord[] };

const SYSTEM_PROMPT = `你是英文學習字典的編輯。有些英文字本身是詞條，同時也是另一個字的變化形，例如 accomplished 是形容詞（技藝高超的），也是 accomplish 的過去式。
例句是用字面比對自動掛上的，所以 accomplished 詞條底下混進了 "He accomplished his mission." 這種其實在示範 accomplish 的句子。

使用者會給你一個字的資料（JSON）：
- headword：詞條
- meanings：這個詞條自己的意思
- formOf：它是哪個字的什麼變化形，以及那個字的意思
- examples：掛在這個詞條底下的例句（id、英文）

請逐句判斷，以 JSON 回覆：{"examples":[{"id":123,"keep":true}]}
- keep = true：句中的 headword 用的是 meanings 裡的意思（例如分詞形容詞描述狀態或特質：an accomplished pianist、I'm tired、a used car、the meeting starts at 9）。
- keep = false：句中的 headword 只是 formOf 那個字的變化形，表達的是那個字的動作或事件（時態、完成式、被動語態、進行式、第三人稱動詞）：He accomplished his mission、We've accomplished a lot、I found my keys、She is meeting him later、He means it。
- 片語或固定用法：依它在字典裡屬於哪個字判斷。屬於原形的填 false（found out 屬於 find、lost and found 屬於 find）；meanings 裡有的就填 true（例如 meanings 有「習慣的」時，be used to doing 填 true）。
- 真的分不出來（同時說得通）時填 true。
每一句都要列出。只回覆 JSON。`;

async function loadInputs(db: ReturnType<typeof connect>["db"], words: string[] | null, done: Set<string>, limit: number) {
  const kinds = sql.join(FORM_KINDS.map((k) => sql`${k}`), sql`, `);
  const { rows: heads } = await db.execute<{ headword: string }>(sql`
    SELECT e.headword FROM dict_entries e
    WHERE EXISTS (SELECT 1 FROM dict_word_forms f JOIN dict_entries l ON l.headword = f.lemma
                  WHERE f.form = e.headword AND f.lemma <> e.headword AND f.kind IN (${kinds}))
      AND EXISTS (SELECT 1 FROM dict_example_words w JOIN dict_examples x ON x.id = w.example_id
                  WHERE w.headword = e.headword AND x.source = 'tatoeba')
      ${words ? sql`AND e.headword IN (${sql.join(words.map((w) => sql`${w}`), sql`, `)})` : sql``}
    ORDER BY e.frequency_rank NULLS LAST, e.headword`);

  /** 一個字的意思：優先用 LLM 現代化詞條，沒有時用 ECDICT 中文釋義；去掉變化形說明 */
  const meaningsOf = async (headword: string) => {
    const { rows: modern } = await db.execute<{ pos: string; label: string }>(
      sql`SELECT pos, label_zh AS label FROM dict_entry_senses WHERE headword = ${headword} ORDER BY sense_order`,
    );
    const lines = modern.length
      ? modern.map((s) => `${s.pos} ${s.label}`)
      : (
          await db.execute<{ pos: string | null; text: string }>(
            sql`SELECT pos, text FROM dict_definitions WHERE headword = ${headword} AND lang = 'zh-TW' ORDER BY sort_order`,
          )
        ).rows.map((d) => (d.pos ? `${d.pos} ${d.text}` : d.text));
    return lines.filter((l) => !INFLECTION_GLOSS.test(l));
  };

  const inputs: Input[] = [];
  let skipped = 0;
  for (const { headword } of heads) {
    if (inputs.length >= limit) break;
    if (done.has(headword)) continue;
    const meanings = await meaningsOf(headword);
    if (meanings.length === 0) {
      skipped++;
      continue;
    }
    const { rows: forms } = await db.execute<{ lemma: string; kind: string }>(sql`
      SELECT f.lemma, f.kind FROM dict_word_forms f JOIN dict_entries l ON l.headword = f.lemma
      WHERE f.form = ${headword} AND f.lemma <> ${headword} AND f.kind IN (${kinds}) ORDER BY f.lemma, f.kind`);
    const byLemma = new Map<string, string[]>();
    for (const f of forms) byLemma.set(f.lemma, [...(byLemma.get(f.lemma) ?? []), KIND_LABEL[f.kind]]);
    const formOf = [];
    for (const [lemma, kindLabels] of byLemma) {
      formOf.push({ lemma, kind: kindLabels.join("、"), meanings: (await meaningsOf(lemma)).slice(0, 6) });
    }
    const { rows: exs } = await db.execute<{ id: number; en: string }>(sql`
      SELECT x.id, x.text_en AS en FROM dict_example_words w JOIN dict_examples x ON x.id = w.example_id
      WHERE w.headword = ${headword} AND x.source = 'tatoeba' ORDER BY w.score DESC, length(x.text_en)`);
    inputs.push({ headword, meanings, formOf, examples: exs });
  }
  return { inputs, skipped };
}

function parse(input: Input, json: unknown): { word: FormFilterWord } | { problems: string[] } {
  const problems: string[] = [];
  const list = (json as { examples?: unknown }).examples;
  const answers = new Map<number, unknown>();
  for (const e of Array.isArray(list) ? (list as { id?: unknown; keep?: unknown }[]) : []) answers.set(Number(e.id), e.keep);
  const examples: FormFilterExample[] = [];
  for (const ex of input.examples) {
    const keep = answers.get(ex.id);
    if (typeof keep !== "boolean") problems.push(`例句 ${ex.id} 沒有判斷`);
    else examples.push({ en: ex.en, keep });
  }
  if (problems.length) return { problems };
  return { word: { headword: input.headword, lemmas: input.formOf.map((f) => f.lemma), examples } };
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
  const limit = Number(getArg("limit") ?? 2000);
  const concurrency = Number(getArg("concurrency") ?? 6);
  mkdirSync(DATA_DIR, { recursive: true });
  const outPath = path.join(DATA_DIR, getArg("out") ?? `${new Date().toISOString().slice(0, 10)}-deepseek.json`);

  const { db, close } = connect();
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set（請確認 .env.local）");
  let queue: { input: Input; attempts: number }[];
  try {
    const { inputs, skipped } = await loadInputs(db, words, existingHeadwords(), limit);
    queue = inputs.map((input) => ({ input, attempts: 0 }));
    console.log(`這次處理 ${queue.length} 個字（略過 ${skipped} 個只有變化形意思的字），同時 ${concurrency} 個請求 → ${path.relative(ROOT, outPath)}`);
  } finally {
    await close();
  }

  const out: OutFile = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : {
        model: DEEPSEEK_MODEL,
        generatedAt: new Date().toISOString().slice(0, 10),
        method: "scripts/llm/filter-form-examples.ts：判斷變化形詞條（accomplished 等）底下的 Tatoeba 例句是否其實在示範原形",
        words: [],
      };
  const failed: { headword: string; problems: string[] }[] = [];
  const usage = usageTotals();
  let removed = 0;

  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      item.attempts++;
      const { input } = item;
      const result = await chatJson(key, SYSTEM_PROMPT, JSON.stringify(input), { temperature: 0 });
      usage.add(result.usage);
      out.model = result.model;
      const parsed = parse(input, result.json);
      if ("word" in parsed) {
        out.words.push(parsed.word);
        saveJson(outPath, out);
        const n = parsed.word.examples.filter((e) => !e.keep).length;
        removed += n;
        console.log(`  ${input.headword}：${input.examples.length} 句，移除 ${n} 句`);
      } else if (item.attempts < MAX_ATTEMPTS) {
        queue.push(item);
      } else {
        failed.push({ headword: input.headword, problems: parsed.problems });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\n這次移除 ${removed} 句；成功 ${out.words.length} 字（檔案累計），失敗 ${failed.length} 字`);
  console.log(usage.toString());
  for (const f of failed) console.log(`失敗 ${f.headword}：${f.problems.slice(0, 5).join("；")}`);
});
