/**
 * 相似字 → dict_similar_words（單字頁「相似」區塊的「易混淆」與「近義字」兩排字）
 *
 * - 易混淆（confusable，source = 'computed'）：在常用字裡找拼法相近的字。
 *   分數 = 1 − 編輯距離 / 較長字長，開頭字母相同、結尾 3 個字母相同各加分，再依詞頻微調。
 *   排除同一個字的詞形變化（go/went）、同字根（negotiate/negotiation）、只差否定或 re- 等字首（happy/unhappy）。
 * - 近義字（synonym，source = 'oewn'）：Open English WordNet 2025（CC BY 4.0）的關係。
 *   同一個 synset 的成員 > similar/also > 上位詞 > 下位詞 > 同一個上位詞底下的其他字；
 *   依該字主要詞性的前幾個 sense 加權（越常用的 sense 權重越高）。
 *
 * 只收 dict_entries 裡、WordNet 也有收的字（排除人名與縮寫）。必須在 ECDICT 與 WordNet 匯入之後執行。
 * 參數：--confusable-pool=12000（易混淆候選的詞頻範圍）、--synonym-pool=30000
 * 可重複執行：清空 dict_similar_words 後重灌。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { similarWords } from "../../src/db/schema";
import { editDistance } from "../../src/lib/edit-distance";
import { normalizeHeadword } from "../../src/lib/headword";
import { connect, getArg, insertInBatches, requireRawFile, run } from "./lib";

const CONFUSABLES_PER_WORD = 5;
const SYNONYMS_PER_WORD = 10;
const SENSES_USED = 4; // 每個詞性取前幾個 sense
const NEGATIVE_PREFIXES = ["un", "in", "im", "il", "ir", "dis", "non", "re", "mis"];

type Synset = { members?: string[]; hypernym?: string[]; hyponym?: string[]; similar?: string[]; also?: string[] };
type OewnEntries = Record<string, Record<string, { sense?: { synset: string }[] }>>;

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

/** 同字根或只差字首：negotiate/negotiation、happy/unhappy */
function sameFamily(a: string, b: string): boolean {
  if (NEGATIVE_PREFIXES.some((p) => a === p + b || b === p + a)) return true;
  let common = 0;
  while (common < a.length && a[common] === b[common]) common++;
  return common >= 4 && common >= Math.min(a.length, b.length) - 3;
}

run(async () => {
  const confusablePoolRank = Number(getArg("confusable-pool") ?? 12000);
  const synonymPoolRank = Number(getArg("synonym-pool") ?? 30000);

  const dir = path.dirname(
    requireRawFile("oewn/entries-a.json", "請先依 scripts/import/wordnet.ts 的說明下載並解壓 Open English WordNet"),
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const synsets: Record<string, Synset> = {};
  for (const f of files.filter((f) => !f.startsWith("entries-") && f !== "frames.json")) {
    Object.assign(synsets, readJson<Record<string, Synset>>(path.join(dir, f)));
  }
  // 小寫的 lemma → 各詞性的 synset id（OEWN 同一詞性內已依常用程度排序；大寫開頭的是專有名詞，不收）
  const sensesOf = new Map<string, string[][]>();
  for (const f of files.filter((f) => f.startsWith("entries-"))) {
    for (const [lemma, byPos] of Object.entries(readJson<OewnEntries>(path.join(dir, f)))) {
      if (lemma !== lemma.toLowerCase()) continue;
      const headword = normalizeHeadword(lemma.replace(/_/g, " "));
      const groups = Object.values(byPos).map(({ sense = [] }) => sense.map((s) => s.synset));
      sensesOf.set(headword, [...(sensesOf.get(headword) ?? []), ...groups].sort((a, b) => b.length - a.length));
    }
  }

  const { db, close } = connect();
  try {
    const entryRows = await db.query.entries.findMany({ columns: { headword: true, frequencyRank: true } });
    if (entryRows.length === 0) throw new Error("dict_entries 是空的，請先執行 ECDICT 匯入");
    const rankOf = new Map(entryRows.map((e) => [e.headword, e.frequencyRank ?? 999_999]));
    const lemmaOf = new Map(
      (await db.query.wordForms.findMany({ columns: { form: true, lemma: true } })).map((f) => [f.form, f.lemma]),
    );
    const root = (w: string) => lemmaOf.get(w) ?? w;
    const related = (a: string, b: string) => a === b || root(a) === root(b) || sameFamily(a, b);

    const inWordNet = (h: string) => sensesOf.has(h);
    const confusablePool = entryRows
      .map((e) => e.headword)
      .filter((h) => /^[a-z]{3,}$/.test(h) && rankOf.get(h)! <= confusablePoolRank && inWordNet(h));
    const synonymPool = new Set(
      entryRows
        .map((e) => e.headword)
        .filter((h) => /^[a-z]+(?: [a-z]+)?$/.test(h) && rankOf.get(h)! <= synonymPoolRank && inWordNet(h)),
    );
    // 依長度分桶，只比較長度差 ≤ 3 的字
    const byLength = new Map<number, string[]>();
    for (const w of confusablePool) byLength.set(w.length, [...(byLength.get(w.length) ?? []), w]);

    const confusablesOf = (w: string): string[] => {
      const scored: [string, number][] = [];
      for (let len = w.length - 3; len <= w.length + 3; len++) {
        for (const x of byLength.get(len) ?? []) {
          // 便宜的預先過濾：開頭字母或結尾兩個字母相同才算編輯距離（容易看錯的字幾乎都符合）
          if (w[0] !== x[0] && w.slice(-2) !== x.slice(-2)) continue;
          if (related(w, x)) continue;
          let score = 1 - editDistance(w, x) / Math.max(w.length, x.length);
          if (w[0] === x[0]) score += 0.1;
          if (w.slice(-3) === x.slice(-3)) score += 0.1;
          if (score < 0.5) continue;
          scored.push([x, score - Math.log10(rankOf.get(x)!) * 0.02]);
        }
      }
      return scored
        .sort((a, b) => b[1] - a[1])
        .slice(0, CONFUSABLES_PER_WORD)
        .map(([x]) => x);
    };

    const synonymsOf = (w: string): string[] => {
      const score = new Map<string, number>();
      const add = (members: string[] | undefined, weight: number) => {
        for (const m of members ?? []) {
          const h = normalizeHeadword(m.replace(/_/g, " "));
          if (!synonymPool.has(h) || related(w, h)) continue;
          score.set(h, (score.get(h) ?? 0) + weight);
        }
      };
      // 每個詞性各取前幾個 sense；sense 多的詞性（通常是主要詞性）權重稍高
      const senses = (sensesOf.get(w) ?? []).flatMap((ids, posIndex) =>
        ids.slice(0, SENSES_USED).map((id, i) => ({ id, weight: (posIndex === 0 ? 1 : 0.8) / (i + 1) ** 1.5 })),
      );
      senses.forEach(({ id, weight }) => {
        const s = synsets[id];
        if (!s) return;
        add(s.members, 3 * weight);
        for (const r of [...(s.similar ?? []), ...(s.also ?? [])]) add(synsets[r]?.members, 2.5 * weight);
        for (const h of s.hypernym ?? []) {
          add(synsets[h]?.members, 2 * weight);
          for (const sibling of synsets[h]?.hyponym ?? []) if (sibling !== id) add(synsets[sibling]?.members, 0.8 * weight);
        }
        for (const h of s.hyponym ?? []) add(synsets[h]?.members, 1.5 * weight);
      });
      return [...score]
        .sort((a, b) => b[1] - a[1] || rankOf.get(a[0])! - rankOf.get(b[0])!)
        .slice(0, SYNONYMS_PER_WORD)
        .map(([h]) => h);
    };

    const rows: (typeof similarWords.$inferInsert)[] = [];
    let done = 0;
    for (const { headword } of entryRows) {
      if (/^[a-z]{3,}$/.test(headword)) {
        confusablesOf(headword).forEach((word, rank) =>
          rows.push({ headword, kind: "confusable", word, rank, source: "computed" }),
        );
      }
      if (inWordNet(headword)) {
        synonymsOf(headword).forEach((word, rank) => rows.push({ headword, kind: "synonym", word, rank, source: "oewn" }));
      }
      if (++done % 5000 === 0) console.log(`  ${done} / ${entryRows.length}`);
    }

    await db.transaction(async (tx) => {
      await tx.delete(similarWords);
      await insertInBatches(tx, similarWords, rows);
    });
    const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
    console.log(`易混淆 ${count("confusable")} 筆、近義字 ${count("synonym")} 筆`);
  } finally {
    await close();
  }
});
