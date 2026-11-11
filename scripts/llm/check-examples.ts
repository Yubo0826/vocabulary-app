/**
 * 用 validate.ts 的規則檢查 data/llm/examples/ 所有檔案，列出有問題的字與統計。
 * 參數：--remove 直接從檔案移除有問題的字（之後重跑 llm:examples 會重新產生）
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { connect, ROOT, run } from "../import/lib";
import { checkWord, type Example } from "./validate";

const DATA_DIR = path.join(ROOT, "data/llm/examples");

run(async () => {
  const remove = process.argv.includes("--remove");
  const { db, close } = connect();
  const forms = new Map<string, Set<string>>();
  try {
    const { rows } = await db.execute<{ lemma: string; form: string }>(sql`SELECT lemma, form FROM dict_word_forms`);
    for (const r of rows) (forms.get(r.lemma) ?? forms.set(r.lemma, new Set()).get(r.lemma)!).add(r.form);
  } finally {
    await close();
  }

  for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const full = path.join(DATA_DIR, file);
    const data = JSON.parse(readFileSync(full, "utf8")) as { words: { headword: string; examples: Example[] }[] };
    const bad = new Set<string>();
    for (const w of data.words) {
      const problems = checkWord(w.headword, forms.get(w.headword) ?? new Set(), w.examples);
      if (problems.length) {
        bad.add(w.headword);
        console.log(`${file} ${w.headword}：${problems.join("；")}`);
      }
    }
    const sentences = data.words.flatMap((w) => w.examples);
    const the = sentences.filter((e) => /^The\b/.test(e.en)).length;
    console.log(`${file}：${data.words.length} 字、${sentences.length} 句，有問題 ${bad.size} 字，The 開頭 ${((100 * the) / sentences.length).toFixed(0)}%`);
    if (remove && bad.size) {
      data.words = data.words.filter((w) => !bad.has(w.headword));
      writeFileSync(full, JSON.stringify(data, null, 1) + "\n");
      console.log(`  已移除 ${bad.size} 字`);
    }
  }
});
