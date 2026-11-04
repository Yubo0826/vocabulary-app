/**
 * 字典查詢（僅限伺服器端）。字典資料只在匯入時變動，因此查詢結果以 `use cache` 快取；
 * 重新匯入後需重啟伺服器或等快取過期（cacheLife "days"）。
 */
import { and, asc, desc, eq, inArray, like, ne, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import { definitions, entries, exampleWords, examples, wordForms } from "@/db/schema";
import { editDistance } from "./edit-distance";
import { normalizeHeadword } from "./headword";

export type MatchType = "exact" | "form" | "prefix" | "fuzzy";

export type SearchItem = {
  headword: string;
  display: string;
  phonetic: string | null;
  gloss: string | null; // 第一筆中文釋義，提示清單用
  via: MatchType;
  form?: string; // via = form 時，使用者輸入的變化形（例如 mice）
};

export type SearchResult = {
  query: string;
  matchType: MatchType | null; // 最佳的比對方式；null = 完全找不到
  items: SearchItem[];
};

const MAX_QUERY_LENGTH = 64;
const FUZZY_THRESHOLD = 0.2; // pg_trgm 相似度門檻：只用來撈候選字，排序改看編輯距離
const FUZZY_CANDIDATES = 100;

/** LIKE 的萬用字元跳脫 */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * 查詢流程：完全符合 → 詞形還原 → 前綴（依詞頻）→ 前面都沒結果時才做模糊搜尋。
 * 前三種結果會合併成一份清單（完全符合在最前），供即時提示與搜尋結果頁共用。
 */
export async function searchDictionary(input: string, limit = 10): Promise<SearchResult> {
  "use cache";
  cacheLife("days");

  const query = normalizeHeadword(input).slice(0, MAX_QUERY_LENGTH);
  if (!query) return { query, matchType: null, items: [] };

  type Row = { headword: string; display: string; phonetic: string | null };
  const columns = { headword: entries.headword, display: entries.display, phonetic: entries.phonetic };
  const found: { row: Row; via: MatchType; form?: string }[] = [];
  const seen = new Set<string>();
  const add = (row: Row, via: MatchType, form?: string) => {
    if (seen.has(row.headword) || found.length >= limit) return;
    seen.add(row.headword);
    found.push({ row, via, form });
  };

  // 1. 完全符合
  const [exact] = await db.select(columns).from(entries).where(eq(entries.headword, query));
  if (exact) add(exact, "exact");

  // 2. 詞形還原（went → go、mice → mouse）
  const lemmas = await db
    .selectDistinct({ ...columns, rank: entries.frequencyRank })
    .from(wordForms)
    .innerJoin(entries, eq(entries.headword, wordForms.lemma))
    .where(eq(wordForms.form, query))
    .orderBy(sql`${entries.frequencyRank} ASC NULLS LAST`);
  for (const l of lemmas) add(l, "form", query);

  // 3. 前綴搜尋
  const prefix = await db
    .select(columns)
    .from(entries)
    .where(and(like(entries.headword, `${escapeLike(query)}%`), ne(entries.headword, query)))
    .orderBy(sql`${entries.frequencyRank} ASC NULLS LAST`, sql`length(${entries.headword})`, asc(entries.headword))
    .limit(limit);
  for (const p of prefix) add(p, "prefix");

  // 4. 模糊搜尋：trigram 撈候選 → 依編輯距離、詞頻、相似度排序
  if (found.length === 0) {
    const candidates = await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL pg_trgm.similarity_threshold = ${FUZZY_THRESHOLD}`));
      const similarity = sql<number>`similarity(${entries.headword}, ${query})`;
      return tx
        .select({ ...columns, rank: entries.frequencyRank, similarity })
        .from(entries)
        .where(sql`${entries.headword} % ${query}`)
        .orderBy(desc(similarity))
        .limit(FUZZY_CANDIDATES);
    });
    const maxDistance = Math.max(2, Math.floor(query.length / 3));
    candidates
      .map((c) => ({ ...c, distance: editDistance(query, c.headword) }))
      .filter((c) => c.distance <= maxDistance)
      .sort(
        (a, b) =>
          a.distance - b.distance ||
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          b.similarity - a.similarity,
      )
      .forEach((c) => add(c, "fuzzy"));
  }

  const glosses = await firstGlosses(found.map((f) => f.row.headword));
  return {
    query,
    matchType: found[0]?.via ?? null,
    items: found.map(({ row, via, form }) => ({
      ...row,
      gloss: glosses.get(row.headword) ?? null,
      via,
      ...(form ? { form } : {}),
    })),
  };
}

/** 每個 headword 的第一筆中文釋義（含詞性） */
async function firstGlosses(headwords: string[]): Promise<Map<string, string>> {
  if (headwords.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([definitions.headword], {
      headword: definitions.headword,
      pos: definitions.pos,
      text: definitions.text,
    })
    .from(definitions)
    .where(and(inArray(definitions.headword, headwords), eq(definitions.lang, "zh-TW")))
    .orderBy(definitions.headword, definitions.sortOrder);
  return new Map(rows.map((r) => [r.headword, r.pos ? `${r.pos} ${r.text}` : r.text]));
}

export type WordDetail = NonNullable<Awaited<ReturnType<typeof getWord>>>;

/** 單字頁資料；headword 不存在時回傳 null */
export async function getWord(input: string, exampleLimit = 20) {
  "use cache";
  cacheLife("days");

  const headword = normalizeHeadword(input);
  const [entry] = await db.select().from(entries).where(eq(entries.headword, headword));
  if (!entry) return null;

  const [defs, exampleRows, inflections, lemmaOf] = await Promise.all([
    db
      .select({ lang: definitions.lang, pos: definitions.pos, text: definitions.text })
      .from(definitions)
      .where(eq(definitions.headword, headword))
      .orderBy(definitions.lang, definitions.sortOrder),
    db
      .select({
        id: examples.id,
        textEn: examples.textEn,
        textZh: examples.textZh,
        enSentenceId: examples.enSentenceId,
        zhSentenceId: examples.zhSentenceId,
        enAuthor: examples.enAuthor,
        zhAuthor: examples.zhAuthor,
        enLicense: examples.enLicense,
        zhLicense: examples.zhLicense,
      })
      .from(exampleWords)
      .innerJoin(examples, eq(examples.id, exampleWords.exampleId))
      .where(eq(exampleWords.headword, headword))
      .orderBy(desc(exampleWords.score), sql`length(${examples.textEn})`)
      .limit(exampleLimit),
    // 這個字的變化形（go → went, gone …）
    db
      .select({ form: wordForms.form, kind: wordForms.kind })
      .from(wordForms)
      .where(eq(wordForms.lemma, headword)),
    // 這個字本身是哪個字的變化形（left → leave）
    db
      .select({ lemma: wordForms.lemma, kind: wordForms.kind })
      .from(wordForms)
      .innerJoin(entries, eq(entries.headword, wordForms.lemma))
      .where(eq(wordForms.form, headword)),
  ]);

  return {
    entry,
    zh: defs.filter((d) => d.lang === "zh-TW"),
    en: defs.filter((d) => d.lang === "en"),
    examples: exampleRows,
    inflections,
    lemmaOf,
  };
}

/** 輸入不是詞條但是某字的變化形時，回傳原形（單字頁用來轉址） */
export async function findLemma(input: string): Promise<string | null> {
  "use cache";
  cacheLife("days");

  const [row] = await db
    .select({ lemma: wordForms.lemma })
    .from(wordForms)
    .innerJoin(entries, eq(entries.headword, wordForms.lemma))
    .where(eq(wordForms.form, normalizeHeadword(input)))
    .orderBy(sql`${entries.frequencyRank} ASC NULLS LAST`)
    .limit(1);
  return row?.lemma ?? null;
}
