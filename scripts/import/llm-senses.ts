/**
 * LLM 整理的詞義與例句分組 → dict_senses、dict_example_words.sense_id、dict_examples.text_zh_revised
 *
 * 資料檔：data/llm/senses/*.json（scripts/llm/generate-senses.ts 產生，進版控）。
 * 例句以英文原文對應這個字底下的例句（例句 id 重新匯入後會變）；找不到的例句略過並計數。
 * 必須在 Tatoeba 與 LLM 例句匯入之後執行（重新匯入例句會清掉分組，要再跑一次這支）。
 * 可重複執行：清空 dict_senses 與所有修正翻譯後重灌。
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { entries, exampleWords, examples, senses } from "../../src/db/schema";
import type { SenseWord } from "../llm/generate-senses";
import { connect, ROOT, run } from "./lib";

const DATA_DIR = path.join(ROOT, "data/llm/senses");

type SenseFile = { model: string; words: SenseWord[] };

run(async () => {
  const files = existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort() : [];
  const words: (SenseWord & { model: string })[] = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8")) as SenseFile;
    for (const w of data.words) words.push({ ...w, model: data.model });
  }

  const { db, close } = connect();
  try {
    const known = new Set(
      words.length
        ? (await db.select({ h: entries.headword }).from(entries).where(inArray(entries.headword, words.map((w) => w.headword)))).map((r) => r.h)
        : [],
    );
    let linked = 0;
    let missing = 0;
    let revised = 0;

    await db.transaction(async (tx) => {
      // DELETE（不是 TRUNCATE）才會觸發 sense_id 的 ON DELETE SET NULL
      await tx.delete(senses);
      await tx
        .update(examples)
        .set({ textZhRevised: null, zhRevisedModel: null })
        .where(isNotNull(examples.textZhRevised));

      for (const w of words) {
        if (!known.has(w.headword)) continue;
        const inserted = await tx
          .insert(senses)
          .values(
            w.senses.map((s, i) => ({
              headword: w.headword,
              senseOrder: i + 1,
              pos: s.pos || null,
              labelZh: s.label,
              glossEn: s.gloss || null,
              wordnetSynsets: s.synsets,
              model: w.model,
            })),
          )
          .returning({ id: senses.id, order: senses.senseOrder });
        const senseIdOf = new Map(inserted.map((r) => [r.order, r.id]));

        // 這個字底下的例句：英文原文 → 例句 id
        const rows = await tx
          .select({ id: examples.id, en: examples.textEn })
          .from(exampleWords)
          .innerJoin(examples, eq(examples.id, exampleWords.exampleId))
          .where(eq(exampleWords.headword, w.headword));
        const idOf = new Map(rows.map((r) => [r.en, r.id]));

        const assignments: { id: number; senseId: number }[] = [];
        for (const ex of w.examples) {
          const id = idOf.get(ex.en);
          if (id === undefined) {
            missing++;
            continue;
          }
          const senseId = senseIdOf.get(ex.sense);
          if (senseId) assignments.push({ id, senseId });
          if (ex.zhFix) {
            await tx.update(examples).set({ textZhRevised: ex.zhFix, zhRevisedModel: w.model }).where(eq(examples.id, id));
            revised++;
          }
        }
        if (assignments.length) {
          const values = sql.join(
            assignments.map((a) => sql`(${a.id}::int, ${a.senseId}::int)`),
            sql`, `,
          );
          await tx.execute(sql`
            UPDATE dict_example_words w SET sense_id = v.sense_id
            FROM (VALUES ${values}) AS v(example_id, sense_id)
            WHERE w.headword = ${w.headword} AND w.example_id = v.example_id`);
          linked += assignments.length;
        }
      }
    });

    console.log(`讀取 ${files.length} 個檔案、${words.length} 個字（字典有 ${known.size} 個）`);
    console.log(`例句分組 ${linked} 筆，修正翻譯 ${revised} 句，找不到的例句 ${missing} 句（例句重新匯入後已不存在）`);
  } finally {
    await close();
  }
});
