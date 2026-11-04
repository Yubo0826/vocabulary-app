/**
 * Open English WordNet 2025（CC BY 4.0）→ dict_definitions（lang = en）
 *
 * 原始檔：data/raw/oewn/（解壓 english-wordnet-2025-json.zip）
 *   https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip
 *   entries-*.json   lemma → { 詞性: { sense: [{ id, synset }] } }
 *   其餘 *.json      synset id → { definition: [...], partOfSpeech, ... }（frames.json 除外）
 *
 * 只匯入已存在於 dict_entries 的字，source_ref 存 synset id。必須在 ECDICT 匯入之後執行。
 * 可重複執行：刪除 lang = 'en' 的釋義後重灌。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { definitions, entries } from "../../src/db/schema";
import { normalizeHeadword } from "../../src/lib/headword";
import { connect, insertInBatches, requireRawFile, run } from "./lib";

const SOURCE = "oewn";
// OEWN 詞性代碼 → 與 ECDICT 一致的寫法（s = 衛星形容詞，視同形容詞）
const POS_LABEL: Record<string, string> = { n: "n.", v: "v.", a: "adj.", s: "adj.", r: "adv." };

type OewnEntries = Record<string, Record<string, { sense?: { synset: string }[] }>>;
type OewnSynsets = Record<string, { definition?: string[] }>;

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

run(async () => {
  const dir = path.dirname(
    requireRawFile(
      "oewn/entries-a.json",
      "請下載 english-wordnet-2025-json.zip 並解壓到 data/raw/oewn/：\n" +
        "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip",
    ),
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  const synsets: OewnSynsets = {};
  for (const f of files.filter((f) => !f.startsWith("entries-") && f !== "frames.json")) {
    Object.assign(synsets, readJson<OewnSynsets>(path.join(dir, f)));
  }

  const { db, close } = connect();
  try {
    const known = new Set(
      (await db.select({ h: entries.headword }).from(entries)).map((e) => e.h),
    );
    if (known.size === 0) throw new Error("dict_entries 是空的，請先執行 ECDICT 匯入");

    // headword → 詞性 → synset id 清單（OEWN 中同一詞性的 sense 已依常用程度排序）
    const sensesOf = new Map<string, Map<string, string[]>>();
    for (const f of files.filter((f) => f.startsWith("entries-"))) {
      for (const [lemma, byPos] of Object.entries(readJson<OewnEntries>(path.join(dir, f)))) {
        const headword = normalizeHeadword(lemma.replace(/_/g, " "));
        if (!known.has(headword)) continue;
        const target = sensesOf.get(headword) ?? new Map<string, string[]>();
        sensesOf.set(headword, target);
        for (const [pos, { sense = [] }] of Object.entries(byPos)) {
          const key = POS_LABEL[pos] ?? pos;
          target.set(key, [...(target.get(key) ?? []), ...sense.map((s) => s.synset)]);
        }
      }
    }

    const rows: (typeof definitions.$inferInsert)[] = [];
    for (const [headword, byPos] of sensesOf) {
      // 詞性群組依 sense 數多寡排序，讓 go、run 這類以動詞為主的字先顯示動詞
      const groups = [...byPos].sort((a, b) => b[1].length - a[1].length);
      const seen = new Set<string>();
      let order = 0;
      for (const [pos, ids] of groups) {
        for (const id of ids) {
          const text = synsets[id]?.definition?.[0]?.trim();
          if (!text || seen.has(id)) continue;
          seen.add(id);
          rows.push({
            headword,
            lang: "en",
            pos,
            text,
            sortOrder: order++,
            source: SOURCE,
            sourceRef: id,
          });
        }
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(definitions).where(eq(definitions.lang, "en"));
      await insertInBatches(tx, definitions, rows);
    });

    const { rows: cnt } = await db.execute<{ n: string }>(
      sql`SELECT count(DISTINCT headword) AS n FROM dict_definitions WHERE lang = 'en'`,
    );
    console.log(`synset ${Object.keys(synsets).length} 個；寫入英英釋義 ${rows.length} 筆，涵蓋 ${cnt[0].n} 個詞條`);
  } finally {
    await close();
  }
});
