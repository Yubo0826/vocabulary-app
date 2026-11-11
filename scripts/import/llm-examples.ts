/**
 * LLM 產生的例句 → dict_examples（source = 'llm'）、dict_example_words
 *
 * 資料檔放在 data/llm/examples/*.json（進版控），格式：
 *   { "model": "claude-opus-5-5", "words": [{ "headword": "aerial", "examples": [{ "en": "...", "zh": "..." }] }] }
 *
 * - 中文已是台灣繁體，不經過 OpenCC：s2twp 會把「支持」改成「支援」、「文件」改成「檔案」。
 * - 每句只關聯到它所屬的 headword（不像 Tatoeba 會斷詞關聯到句中所有字）。
 * - 字典裡沒有的 headword 略過並列出。
 * 必須在 ECDICT 匯入之後執行。可重複執行：刪除 source = 'llm' 的例句後重灌（Tatoeba 例句不受影響）。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { entries, exampleWords, examples } from "../../src/db/schema";
import { normalizeHeadword } from "../../src/lib/headword";
import { connect, insertInBatches, ROOT, run } from "./lib";

const DATA_DIR = path.join(ROOT, "data/llm/examples");
/** 排序分數：只補給沒有 Tatoeba 例句的字，數值只影響同一字內的順序 */
const SCORE = 50;

type ExampleFile = { model: string; words: { headword: string; examples: { en: string; zh: string }[] }[] };

function loadFiles() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  const items: { headword: string; en: string; zh: string; model: string }[] = [];
  for (const file of files) {
    const data = JSON.parse(readFileSync(path.join(DATA_DIR, file), "utf8")) as ExampleFile;
    if (!data.model) throw new Error(`${file} 缺少 model 欄位`);
    for (const w of data.words) {
      for (const ex of w.examples) {
        const en = ex.en.trim();
        const zh = ex.zh.trim();
        if (!en || !zh) throw new Error(`${file}：${w.headword} 有空白的例句`);
        items.push({ headword: normalizeHeadword(w.headword), en, zh, model: data.model });
      }
    }
  }
  return { files, items };
}

run(async () => {
  const { files, items } = loadFiles();
  const { db, close } = connect();
  try {
    const headwords = [...new Set(items.map((i) => i.headword))];
    const known = new Set(
      (await db.select({ h: entries.headword }).from(entries).where(inArray(entries.headword, headwords))).map((e) => e.h),
    );
    const missing = headwords.filter((h) => !known.has(h));
    const rows = items.filter((i) => known.has(i.headword));

    await db.transaction(async (tx) => {
      // dict_example_words 由外鍵 cascade 一併刪除
      await tx.delete(examples).where(eq(examples.source, "llm"));
      const ids: number[] = [];
      for (let i = 0; i < rows.length; i += 2000) {
        const inserted = await tx
          .insert(examples)
          .values(rows.slice(i, i + 2000).map((r) => ({ textEn: r.en, textZh: r.zh, source: "llm", model: r.model })))
          .returning({ id: examples.id });
        ids.push(...inserted.map((r) => r.id));
      }
      await insertInBatches(
        tx,
        exampleWords,
        rows.map((r, i) => ({ headword: r.headword, exampleId: ids[i], score: SCORE })),
        5000,
      );
    });

    console.log(`讀取 ${files.length} 個檔案，寫入 LLM 例句 ${rows.length} 句，涵蓋 ${known.size} 個詞條`);
    if (missing.length) console.log(`字典裡沒有、已略過：${missing.join("、")}`);
  } finally {
    await close();
  }
});
