/**
 * Tatoeba → dict_examples、dict_example_words
 *
 * 原始檔（https://downloads.tatoeba.org/exports/per_language/ 下載後 bunzip2 解壓）放在 data/raw/tatoeba/：
 *   eng_sentences_detailed.tsv  id, lang, text, username, date_added, date_modified
 *   cmn_sentences_detailed.tsv  同上
 *   eng_sentences_CC0.tsv       id, lang, text, date_modified（以 CC0 釋出的句子）
 *   cmn_sentences_CC0.tsv       同上
 *   eng-cmn_links.tsv           eng_id, cmn_id
 *
 * 流程：英文句與中文翻譯配對（一句英文只取一句中文）→ 斷詞後透過 dict_word_forms 還原原形
 * → 依句長與常用字比例計分 → 每個 headword 保留分數最高的 N 句。
 * 必須在 ECDICT 匯入之後執行。可重複執行：刪除 source = 'tatoeba' 的例句後重灌（LLM 例句不受影響）。
 *
 * 參數：--per-headword=20
 */
import { eq } from "drizzle-orm";
import { entries, exampleWords, examples, wordForms } from "../../src/db/schema";
import { MAINLAND_TERMS } from "../llm/validate";
import { connect, getArg, insertInBatches, readLines, requireRawFile, run, toTaiwanese } from "./lib";

const HINT =
  "請從 https://downloads.tatoeba.org/exports/per_language/{eng,cmn}/ 下載對應的 .tsv.bz2 到 data/raw/tatoeba/ 並用 bunzip2 解壓";
const LICENSE_CC_BY = "CC BY 2.0 FR";
const LICENSE_CC0 = "CC0 1.0";
const COMMON_RANK = 5000; // 排名在此以內視為常用字，用於計分
/** 超過這個字數的句子不收（Tatoeba 有整段日記式的長文）；因此沒有例句的字改由 LLM 補 */
const MAX_WORDS = 25;
/** 中文翻譯含大陸用語（轉繁體後仍看得出來的，例如「工資」）時扣分，讓翻譯較道地的句子排前面 */
const MAINLAND_PENALTY = 30;
/** 和已選句子的實詞重疊度 ≥ 這個值就視為重複（raise your hand 出現好幾次），排到後面 */
const DUPLICATE_OVERLAP = 0.5;
const DUPLICATE_PENALTY = 100;
/** 判斷重複時忽略的功能詞 */
const STOPWORDS = new Set(
  "a an the i you he she it we they me him her us them my your his its our their this that these those to of in on at for with and or but if when where how what who why is are was were be been being am do does did done can could would will shall should may might must not no have has had please up out so as by from than then there here very just too also all some any one".split(" "),
);

type Sentence = { text: string; author: string | null };

async function readIdSet(file: string): Promise<Set<number>> {
  const ids = new Set<number>();
  for await (const line of readLines(file)) {
    const id = Number(line.slice(0, line.indexOf("\t")));
    if (id) ids.add(id);
  }
  return ids;
}

/** 讀取 *_sentences_detailed.tsv，只保留 wanted 內的句子 */
async function readSentences(file: string, wanted: Set<number>): Promise<Map<number, Sentence>> {
  const map = new Map<number, Sentence>();
  for await (const line of readLines(file)) {
    const [id, , text, username] = line.split("\t");
    const n = Number(id);
    if (!wanted.has(n) || !text) continue;
    map.set(n, { text, author: username && username !== "\\N" ? username : null });
  }
  return map;
}

/** 英文斷詞：小寫、保留字中的撇號與連字號 */
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) ?? [];
}

/** 0–100：句長 5–15 字得 50 分、超出範圍遞減；常用字比例最多 50 分 */
function scoreSentence(wordCount: number, commonCount: number): number {
  const distance = wordCount < 5 ? 5 - wordCount : wordCount > 15 ? wordCount - 15 : 0;
  const lengthScore = Math.max(0, 50 - distance * 8);
  const commonScore = wordCount ? (commonCount / wordCount) * 50 : 0;
  return Math.round(lengthScore + commonScore);
}

run(async () => {
  const perHeadword = Number(getArg("per-headword") ?? 20);
  const files = {
    engDetailed: requireRawFile("tatoeba/eng_sentences_detailed.tsv", HINT),
    cmnDetailed: requireRawFile("tatoeba/cmn_sentences_detailed.tsv", HINT),
    engCc0: requireRawFile("tatoeba/eng_sentences_CC0.tsv", HINT),
    cmnCc0: requireRawFile("tatoeba/cmn_sentences_CC0.tsv", HINT),
    links: requireRawFile("tatoeba/eng-cmn_links.tsv", HINT),
  };

  // 1. 翻譯連結與句子
  const links = new Map<number, number[]>();
  const cmnIds = new Set<number>();
  for await (const line of readLines(files.links)) {
    const [eng, cmn] = line.split("\t").map(Number);
    if (!eng || !cmn) continue;
    const list = links.get(eng);
    if (list) list.push(cmn);
    else links.set(eng, [cmn]);
    cmnIds.add(cmn);
  }
  const [engCc0, cmnCc0, engSentences, cmnSentences] = await Promise.all([
    readIdSet(files.engCc0),
    readIdSet(files.cmnCc0),
    readSentences(files.engDetailed, new Set(links.keys())),
    readSentences(files.cmnDetailed, cmnIds),
  ]);

  // 2. 配對：一句英文取 id 最小、仍存在的中文翻譯
  type Pair = { enId: number; en: Sentence; zhId: number; zh: Sentence; tokens: string[] };
  const pairs: Pair[] = [];
  for (const [enId, zhIds] of links) {
    const en = engSentences.get(enId);
    const zhId = zhIds.filter((id) => cmnSentences.has(id)).sort((a, b) => a - b)[0];
    if (!en || zhId === undefined) continue;
    const tokens = tokenize(en.text);
    if (tokens.length > MAX_WORDS) continue;
    pairs.push({ enId, en, zhId, zh: cmnSentences.get(zhId)!, tokens });
  }

  const { db, close } = connect();
  try {
    // 3. 字典：headword → 排名、變化形 → 原形
    const rankOf = new Map<string, number | null>();
    for (const e of await db.select({ h: entries.headword, r: entries.frequencyRank }).from(entries)) {
      rankOf.set(e.h, e.r);
    }
    if (rankOf.size === 0) throw new Error("dict_entries 是空的，請先執行 ECDICT 匯入");
    const lemmasOf = new Map<string, string[]>();
    for (const f of await db.select({ form: wordForms.form, lemma: wordForms.lemma }).from(wordForms)) {
      const list = lemmasOf.get(f.form);
      if (list) list.push(f.lemma);
      else lemmasOf.set(f.form, [f.lemma]);
    }

    /** 一個 token 對應到的 headword：本身是詞條就算，加上它的原形（結果快取） */
    const headwordCache = new Map<string, string[]>();
    const headwordsOf = (token: string): string[] => {
      const cached = headwordCache.get(token);
      if (cached) return cached;
      const result = new Set<string>();
      const tryWord = (w: string) => {
        if (rankOf.has(w)) result.add(w);
        for (const lemma of lemmasOf.get(w) ?? []) if (rankOf.has(lemma)) result.add(lemma);
      };
      tryWord(token);
      if (result.size === 0) {
        // 縮寫與所有格：don't → do、he's → he、children's → children → child
        const stripped = token.replace(/(?:n't|'s|'re|'ll|'ve|'d|'m|')$/, "");
        if (stripped !== token) tryWord(stripped);
        if (stripped.includes("-")) stripped.split("-").forEach(tryWord);
      }
      const list = [...result];
      headwordCache.set(token, list);
      return list;
    };

    // 4. 計分，依 headword 分組；中文先轉台灣繁體（寫入時沿用）
    const zhTw = pairs.map((p) => toTaiwanese(p.zh.text));
    const candidates = new Map<string, { pair: number; score: number }[]>();
    pairs.forEach((pair, index) => {
      const linked = new Set<string>();
      let common = 0;
      for (const token of pair.tokens) {
        const hws = headwordsOf(token);
        hws.forEach((h) => linked.add(h));
        if (hws.some((h) => (rankOf.get(h) ?? Infinity) <= COMMON_RANK)) common++;
      }
      const mainland = MAINLAND_TERMS.some((m) => zhTw[index].includes(m));
      const score = scoreSentence(pair.tokens.length, common) - (mainland ? MAINLAND_PENALTY : 0);
      for (const h of linked) {
        const list = candidates.get(h);
        if (list) list.push({ pair: index, score });
        else candidates.set(h, [{ pair: index, score }]);
      }
    });

    // 5. 每個 headword 取前 N 句（同分時短句優先）。依序挑選時，和已選句子實詞重疊太多的視為重複，
    //    排到所有不重複的句子之後（分數扣 DUPLICATE_PENALTY，單字頁依分數排序）
    /** 句中的實詞：去掉功能詞與這個 headword 本身的各種形式，並還原成原形（hands → hand） */
    const contentWords = (pair: number, headword: string) =>
      new Set(
        pairs[pair].tokens
          .filter((t) => !STOPWORDS.has(t) && !headwordsOf(t).includes(headword))
          .map((t) => lemmasOf.get(t)?.[0] ?? t),
      );
    const overlap = (a: Set<string>, b: Set<string>) => {
      if (a.size === 0 || b.size === 0) return 0;
      let shared = 0;
      for (const w of a) if (b.has(w)) shared++;
      return shared / Math.min(a.size, b.size);
    };
    const kept: { headword: string; pair: number; score: number }[] = [];
    let duplicates = 0;
    for (const [headword, list] of candidates) {
      list.sort((a, b) => b.score - a.score || pairs[a.pair].tokens.length - pairs[b.pair].tokens.length || a.pair - b.pair);
      const picked: { c: (typeof list)[number]; words: Set<string> }[] = [];
      const repeated: (typeof list)[number][] = [];
      for (const c of list) {
        if (picked.length >= perHeadword) break;
        const words = contentWords(c.pair, headword);
        if (picked.some((p) => overlap(words, p.words) >= DUPLICATE_OVERLAP)) repeated.push(c);
        else picked.push({ c, words });
      }
      picked.forEach(({ c }) => kept.push({ headword, ...c }));
      for (const c of repeated.slice(0, perHeadword - picked.length)) {
        kept.push({ headword, pair: c.pair, score: c.score - DUPLICATE_PENALTY });
        duplicates++;
      }
    }
    const usedPairs = [...new Set(kept.map((k) => k.pair))].sort((a, b) => a - b);

    // 6. 寫入
    await db.transaction(async (tx) => {
      // 只清掉 Tatoeba 的例句（dict_example_words 由外鍵 cascade 一併刪除），保留 LLM 產生的例句
      await tx.delete(examples).where(eq(examples.source, "tatoeba"));
      const exampleIdOf = new Map<number, number>();
      // 一句英文只配一句中文，所以英文句 id 可唯一對回配對
      const pairIndexOfEnId = new Map(usedPairs.map((i) => [pairs[i].enId, i]));
      const rows = usedPairs.map((i) => {
        const p = pairs[i];
        return {
          textEn: p.en.text,
          textZh: zhTw[i],
          enSentenceId: p.enId,
          zhSentenceId: p.zhId,
          enAuthor: p.en.author,
          zhAuthor: p.zh.author,
          enLicense: engCc0.has(p.enId) ? LICENSE_CC0 : LICENSE_CC_BY,
          zhLicense: cmnCc0.has(p.zhId) ? LICENSE_CC0 : LICENSE_CC_BY,
          source: "tatoeba",
        };
      });
      for (let i = 0; i < rows.length; i += 2000) {
        const inserted = await tx
          .insert(examples)
          .values(rows.slice(i, i + 2000))
          .returning({ id: examples.id, enId: examples.enSentenceId });
        for (const r of inserted) exampleIdOf.set(pairIndexOfEnId.get(r.enId!)!, r.id); // Tatoeba 例句一定有英文句 id
      }
      await insertInBatches(
        tx,
        exampleWords,
        kept.map((k) => ({ headword: k.headword, exampleId: exampleIdOf.get(k.pair)!, score: k.score })),
        5000,
      );
    });

    const cc0 = usedPairs.filter((i) => engCc0.has(pairs[i].enId)).length;
    console.log(`英中配對 ${pairs.length} 組，寫入例句 ${usedPairs.length} 句（英文 CC0 ${cc0} 句）`);
    console.log(`例句關聯 ${kept.length} 筆（其中重複排後 ${duplicates} 筆），涵蓋 ${candidates.size} 個詞條`);
  } finally {
    await close();
  }
});
