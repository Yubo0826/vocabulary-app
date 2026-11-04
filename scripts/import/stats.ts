/**
 * 印出字典資料統計：詞條數、釋義數、例句數、無釋義的詞條數等。
 */
import { sql } from "drizzle-orm";
import { connect, run } from "./lib";

run(async () => {
  const { db, close } = connect();
  try {
    const { rows } = await db.execute<Record<string, string>>(sql`
      SELECT
        (SELECT count(*) FROM dict_entries)                                   AS "詞條",
        (SELECT count(*) FROM dict_definitions WHERE lang = 'zh-TW')          AS "中文釋義",
        (SELECT count(*) FROM dict_definitions WHERE lang = 'en')             AS "英英釋義",
        (SELECT count(*) FROM dict_word_forms)                                AS "詞形對照",
        (SELECT count(*) FROM dict_examples)                                  AS "例句",
        (SELECT count(*) FROM dict_example_words)                             AS "例句關聯",
        (SELECT count(*) FROM dict_entries e
          WHERE NOT EXISTS (SELECT 1 FROM dict_definitions d WHERE d.headword = e.headword))
                                                                              AS "無任何釋義的詞條",
        (SELECT count(*) FROM dict_entries e
          WHERE NOT EXISTS (SELECT 1 FROM dict_definitions d WHERE d.headword = e.headword AND d.lang = 'zh-TW'))
                                                                              AS "無中文釋義的詞條",
        (SELECT count(*) FROM dict_entries e
          WHERE NOT EXISTS (SELECT 1 FROM dict_definitions d WHERE d.headword = e.headword AND d.lang = 'en'))
                                                                              AS "無英英釋義的詞條",
        (SELECT count(*) FROM dict_entries e
          WHERE NOT EXISTS (SELECT 1 FROM dict_example_words w WHERE w.headword = e.headword))
                                                                              AS "無例句的詞條"
    `);
    console.table(Object.entries(rows[0]).map(([項目, 數量]) => ({ 項目, 數量: Number(數量) })));
  } finally {
    await close();
  }
});
