/**
 * 移除掛錯字的 Tatoeba 例句關聯（accomplished 底下的 "He accomplished his mission." 等）
 *
 * 資料檔：data/llm/form-filter/*.json（scripts/llm/filter-form-examples.ts 產生，進版控）。
 * keep = false 的句子從該詞條的 dict_example_words 刪除；原形（accomplish）底下的同一句不受影響。
 * 例句以英文原文對應；只動 Tatoeba 例句。
 * 必須在 Tatoeba 匯入之後執行（重新匯入例句會把關聯加回來，要再跑一次這支）。可重複執行。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { FormFilterWord } from "../llm/filter-form-examples";
import { connect, ROOT, run } from "./lib";

const DATA_DIR = path.join(ROOT, "data/llm/form-filter");

run(async () => {
  const files = existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort() : [];
  const pairs: { headword: string; en: string }[] = [];
  for (const f of files) {
    for (const w of (JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8")) as { words: FormFilterWord[] }).words) {
      for (const ex of w.examples) if (!ex.keep) pairs.push({ headword: w.headword, en: ex.en });
    }
  }

  const { db, close } = connect();
  try {
    let removed = 0;
    await db.transaction(async (tx) => {
      for (let i = 0; i < pairs.length; i += 1000) {
        const values = sql.join(
          pairs.slice(i, i + 1000).map((p) => sql`(${p.headword}, ${p.en})`),
          sql`, `,
        );
        const result = await tx.execute(sql`
          DELETE FROM dict_example_words w
          USING dict_examples x, (VALUES ${values}) AS v(headword, text_en)
          WHERE x.id = w.example_id AND x.source = 'tatoeba' AND w.headword = v.headword AND x.text_en = v.text_en`);
        removed += result.rowCount ?? 0;
      }
    });
    console.log(`讀取 ${files.length} 個檔案、${pairs.length} 句要移除；實際刪除 ${removed} 筆關聯（其餘已不存在）`);
  } finally {
    await close();
  }
});
