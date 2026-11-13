/**
 * LLM 整理的現代化詞條 → dict_entry_senses
 *
 * 資料檔：data/llm/entries/full/<字首>.json（scripts/llm/generate-entries.ts 產生，進版控）。
 * 只匯入已存在於 dict_entries 的字。「不列入的意思」（omitted）只留在 JSON，不進資料庫。
 * 可重複執行：清空 dict_entry_senses 後重灌。必須在 ECDICT 匯入之後執行。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { inArray, sql } from "drizzle-orm";
import { entries, entrySenses } from "../../src/db/schema";
import type { EntryFile } from "../llm/generate-entries";
import { connect, insertInBatches, ROOT, run } from "./lib";

const DATA_DIR = path.join(ROOT, "data/llm/entries/full");

run(async () => {
  const files = existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => /^[a-z0]\.json$/.test(f)).sort() : [];
  const words = files.flatMap((f) => {
    const data = JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8")) as EntryFile;
    return data.words.map((w) => ({ ...w, model: data.model }));
  });

  const { db, close } = connect();
  try {
    const known = new Set<string>();
    const headwords = words.map((w) => w.headword);
    for (let i = 0; i < headwords.length; i += 5000) {
      const rows = await db.select({ h: entries.headword }).from(entries).where(inArray(entries.headword, headwords.slice(i, i + 5000)));
      for (const r of rows) known.add(r.h);
    }

    const rows: (typeof entrySenses.$inferInsert)[] = words
      .filter((w) => known.has(w.headword))
      .flatMap((w) =>
        w.senses.map((s, i) => ({
          headword: w.headword,
          senseOrder: i + 1,
          pos: s.pos,
          labelZh: s.label,
          defZh: s.zh,
          defEn: s.en,
          usage: s.usage,
          register: s.register,
          wordnetSynsets: s.synsets,
          model: w.model,
        })),
      );

    await db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE dict_entry_senses RESTART IDENTITY`);
      await insertInBatches(tx, entrySenses, rows);
    });

    console.log(`讀取 ${files.length} 個檔案、${words.length} 個字（字典有 ${known.size} 個）`);
    console.log(`匯入 ${rows.length} 個詞義`);
  } finally {
    await close();
  }
});
