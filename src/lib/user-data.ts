/**
 * 使用者資料存取層：收藏、筆記、單字本、字卡。
 *
 * 規則：
 * - 第一個參數一律是 userId，只能由伺服器端從 session 取得（見 session.ts），不可來自用戶端。
 * - 每個查詢都以 userId 過濾；操作別人的資料一律視為「找不到」（NotFoundError），不透露資料是否存在。
 * - 不做硬刪除：取消收藏、刪除單字本都是設定 deleted_at（軟刪除）。
 */
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, definitions, entries, savedWords, wordbookItems, wordbooks, wordForms } from "@/db/schema";
import { modernGlossSql, TECHNICAL_GLOSS_PATTERN } from "@/lib/gloss";
import { familiarityOf } from "./familiarity";
import { normalizeHeadword } from "./headword";
import { MAX_IMPORT_CHARS, MAX_IMPORT_WORDS, parseWordList } from "./word-list";

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_NOTE_LENGTH = 2000;
const MAX_WORDBOOK_NAME_LENGTH = 50;
const MAX_WORDBOOK_DESCRIPTION_LENGTH = 200;

function cleanNote(note: string | null | undefined): string | null {
  const v = note?.trim() ?? "";
  if (v.length > MAX_NOTE_LENGTH) throw new ValidationError(`筆記最多 ${MAX_NOTE_LENGTH} 字`);
  return v || null;
}

function cleanWordbookInput(input: { name: string; description?: string | null }) {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name) throw new ValidationError("請輸入單字本名稱");
  if (name.length > MAX_WORDBOOK_NAME_LENGTH) throw new ValidationError(`名稱最多 ${MAX_WORDBOOK_NAME_LENGTH} 字`);
  if (description && description.length > MAX_WORDBOOK_DESCRIPTION_LENGTH) {
    throw new ValidationError(`說明最多 ${MAX_WORDBOOK_DESCRIPTION_LENGTH} 字`);
  }
  return { name, description };
}

const activeSaved = (userId: string) => and(eq(savedWords.userId, userId), isNull(savedWords.deletedAt));
const activeWordbook = (userId: string) => and(eq(wordbooks.userId, userId), isNull(wordbooks.deletedAt));

// ---------------------------------------------------------------- 收藏

const MAX_CONTEXT_URL_LENGTH = 2000;
const MAX_CONTEXT_SENTENCE_LENGTH = 500;

/** 從擴充元件收藏時一併記錄的出處（在哪個網頁、哪句話看到這個字） */
export type SaveContext = { url: string | null; sentence: string | null };

function cleanContext(context: SaveContext): SaveContext {
  const url = context.url?.trim() || null;
  const sentence = context.sentence?.replace(/\s+/g, " ").trim() || null;
  return {
    url: url && /^https?:\/\//i.test(url) && url.length <= MAX_CONTEXT_URL_LENGTH ? url : null,
    sentence: sentence ? sentence.slice(0, MAX_CONTEXT_SENTENCE_LENGTH) : null,
  };
}

/**
 * 收藏一個字：重新收藏時清除 deleted_at（並把收藏時間更新為現在）。
 * 同時確保有一張 en_zh 字卡（新卡 due = 現在、state = New；曾取消收藏則恢復原本的字卡與複習進度）。
 * 有 context（擴充元件）時 origin 記為 'extension'；已收藏過的字也會把出處更新成這次看到的地方。
 */
export async function saveWord(userId: string, rawHeadword: string, note?: string | null, context?: SaveContext) {
  const headword = normalizeHeadword(rawHeadword);
  const cleanedNote = note === undefined ? undefined : cleanNote(note);
  const cleanedContext = context ? cleanContext(context) : undefined;
  return db.transaction((tx) => saveWordIn(tx, userId, headword, cleanedNote, cleanedContext));
}

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** saveWord 的本體，在呼叫端的 transaction 裡執行。headword 須已正規化 */
export async function saveWordIn(
  tx: Tx,
  userId: string,
  headword: string,
  cleanedNote: string | null | undefined,
  context?: SaveContext,
) {
  const [entry] = await tx.select({ h: entries.headword }).from(entries).where(eq(entries.headword, headword));
  if (!entry) throw new NotFoundError("headword");

  const now = new Date();
  const contextColumns = context ? { contextUrl: context.url, contextSentence: context.sentence } : {};
  const [saved] = await tx
    .insert(savedWords)
    .values({ userId, headword, note: cleanedNote ?? null, origin: context ? "extension" : "search", ...contextColumns })
    .onConflictDoUpdate({
      target: [savedWords.userId, savedWords.headword],
      set: {
        deletedAt: null,
        updatedAt: now,
        createdAt: sql`CASE WHEN ${savedWords.deletedAt} IS NOT NULL THEN ${now} ELSE ${savedWords.createdAt} END`,
        ...(cleanedNote !== undefined ? { note: cleanedNote } : {}),
        ...contextColumns,
      },
    })
    .returning({ id: savedWords.id, note: savedWords.note });

  await tx
    .insert(cards)
    .values({ userId, headword, direction: "en_zh", due: now, state: 0 })
    .onConflictDoUpdate({
      target: [cards.userId, cards.headword, cards.direction],
      set: { deletedAt: null, updatedAt: now },
      setWhere: isNotNull(cards.deletedAt),
    });

  return saved;
}

/**
 * 收藏這個字，並讓它剛好屬於 wordbookIds 這幾本單字本（沒列到的會移出）。
 * 還沒收藏時會先收藏（並建立字卡）。單字本都必須屬於這個使用者。
 */
export async function saveToWordbooks(userId: string, rawHeadword: string, wordbookIds: string[]): Promise<void> {
  const headword = normalizeHeadword(rawHeadword);
  const ids = [...new Set(wordbookIds)];
  await db.transaction(async (tx) => {
    if (ids.length > 0) {
      const books = await tx
        .select({ id: wordbooks.id })
        .from(wordbooks)
        .where(and(activeWordbook(userId), inArray(wordbooks.id, ids)));
      if (books.length !== ids.length) throw new NotFoundError("wordbook");
    }

    const saved = await saveWordIn(tx, userId, headword, undefined);
    const now = new Date();
    await tx
      .update(wordbookItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(wordbookItems.userId, userId),
          eq(wordbookItems.savedWordId, saved.id),
          isNull(wordbookItems.deletedAt),
          ids.length > 0 ? notInArray(wordbookItems.wordbookId, ids) : undefined,
        ),
      );
    if (ids.length > 0) {
      await tx
        .insert(wordbookItems)
        .values(ids.map((wordbookId) => ({ wordbookId, savedWordId: saved.id, userId })))
        .onConflictDoUpdate({
          target: [wordbookItems.wordbookId, wordbookItems.savedWordId],
          set: { deletedAt: null, updatedAt: now },
          setWhere: isNotNull(wordbookItems.deletedAt),
        });
    }
  });
}

export type ImportResult = {
  added: number; // 新收藏（含曾取消收藏、這次恢復的）
  alreadySaved: number;
  converted: { from: string; to: string }[]; // 變化形轉成原形（went → go）
  notFound: string[];
};

/**
 * 匯入純文字單字清單（格式見 word-list.ts）：收藏字典裡有的字並建立字卡，可一併放進一本單字本。
 * 字典沒有的字先試著轉成原形，仍找不到就列在 notFound。已收藏的字不變動（但會放進指定的單字本）。
 * 新收藏的時間依清單順序遞增 1 毫秒，複習時新卡會照清單順序出現。
 */
export async function importWords(userId: string, text: string, wordbookId: string | null): Promise<ImportResult> {
  if (text.length > MAX_IMPORT_CHARS) throw new ValidationError("內容太長，請分批匯入");
  const words = parseWordList(text);
  if (words.length === 0) throw new ValidationError("沒有讀到任何單字");
  if (words.length > MAX_IMPORT_WORDS) throw new ValidationError(`一次最多匯入 ${MAX_IMPORT_WORDS} 個字（這次有 ${words.length} 個）`);

  return db.transaction(async (tx) => {
    if (wordbookId) {
      const [book] = await tx
        .select({ id: wordbooks.id })
        .from(wordbooks)
        .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)));
      if (!book) throw new NotFoundError("wordbook");
    }

    // 字典查詢：先找原字，找不到的再查變化形（同一個變化形對應多個原形時取最常用的）
    const inDict = new Set(
      (await tx.select({ h: entries.headword }).from(entries).where(inArray(entries.headword, words))).map((r) => r.h),
    );
    const missing = words.filter((w) => !inDict.has(w));
    const lemmaOf = new Map<string, string>();
    if (missing.length > 0) {
      const rows = await tx
        .select({ form: wordForms.form, lemma: wordForms.lemma })
        .from(wordForms)
        .innerJoin(entries, eq(entries.headword, wordForms.lemma))
        .where(inArray(wordForms.form, missing))
        .orderBy(sql`${entries.frequencyRank} ASC NULLS LAST`);
      for (const r of rows) if (!lemmaOf.has(r.form)) lemmaOf.set(r.form, r.lemma);
    }

    const result: ImportResult = { added: 0, alreadySaved: 0, converted: [], notFound: [] };
    const headwords: string[] = [];
    for (const w of words) {
      const h = inDict.has(w) ? w : lemmaOf.get(w);
      if (!h) {
        result.notFound.push(w);
        continue;
      }
      if (h !== w) result.converted.push({ from: w, to: h });
      if (!headwords.includes(h)) headwords.push(h);
    }
    if (headwords.length === 0) return result;

    const active = new Set(
      (
        await tx
          .select({ h: savedWords.headword })
          .from(savedWords)
          .where(and(activeSaved(userId), inArray(savedWords.headword, headwords)))
      ).map((r) => r.h),
    );
    const toSave = headwords.filter((h) => !active.has(h));
    result.alreadySaved = active.size;
    result.added = toSave.length;

    if (toSave.length > 0) {
      const base = Date.now();
      const at = (i: number) => new Date(base + i);
      await tx
        .insert(savedWords)
        .values(toSave.map((headword, i) => ({ userId, headword, origin: "import", createdAt: at(i), updatedAt: at(i) })))
        .onConflictDoUpdate({
          // 只會撞到曾取消收藏的字：恢復，收藏時間改為這次匯入
          target: [savedWords.userId, savedWords.headword],
          set: {
            deletedAt: null,
            updatedAt: sql`excluded.updated_at`,
            createdAt: sql`CASE WHEN ${savedWords.deletedAt} IS NOT NULL THEN excluded.created_at ELSE ${savedWords.createdAt} END`,
          },
        });
      await tx
        .insert(cards)
        .values(toSave.map((headword, i) => ({ userId, headword, direction: "en_zh" as const, due: at(0), state: 0, createdAt: at(i) })))
        .onConflictDoUpdate({
          // 曾取消收藏的字恢復原本的字卡與複習進度（同 saveWord）
          target: [cards.userId, cards.headword, cards.direction],
          set: { deletedAt: null, updatedAt: at(0) },
          setWhere: isNotNull(cards.deletedAt),
        });
    }

    if (wordbookId) {
      const saved = await tx
        .select({ id: savedWords.id })
        .from(savedWords)
        .where(and(activeSaved(userId), inArray(savedWords.headword, headwords)));
      const now = new Date();
      await tx
        .insert(wordbookItems)
        .values(saved.map((s) => ({ wordbookId, savedWordId: s.id, userId })))
        .onConflictDoUpdate({
          target: [wordbookItems.wordbookId, wordbookItems.savedWordId],
          set: { deletedAt: null, updatedAt: now },
          setWhere: isNotNull(wordbookItems.deletedAt),
        });
    }
    return result;
  });
}

/** 取消收藏：收藏與這個字的字卡都改為軟刪除 */
export async function unsaveWord(userId: string, rawHeadword: string): Promise<void> {
  const headword = normalizeHeadword(rawHeadword);
  await db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(savedWords)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(activeSaved(userId), eq(savedWords.headword, headword)))
      .returning({ id: savedWords.id });
    if (updated.length === 0) throw new NotFoundError("saved word");
    await tx
      .update(cards)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(cards.userId, userId), eq(cards.headword, headword), isNull(cards.deletedAt)));
  });
}

export async function updateNote(userId: string, rawHeadword: string, note: string | null): Promise<void> {
  const headword = normalizeHeadword(rawHeadword);
  const updated = await db
    .update(savedWords)
    .set({ note: cleanNote(note), updatedAt: new Date() })
    .where(and(activeSaved(userId), eq(savedWords.headword, headword)))
    .returning({ id: savedWords.id });
  if (updated.length === 0) throw new NotFoundError("saved word");
}

/** 這個字目前是否在收藏中（擴充元件的查字卡片用） */
export async function isSaved(userId: string, rawHeadword: string): Promise<boolean> {
  const [row] = await db
    .select({ id: savedWords.id })
    .from(savedWords)
    .where(and(activeSaved(userId), eq(savedWords.headword, normalizeHeadword(rawHeadword))));
  return Boolean(row);
}

/** 單字頁用：這個字是否已收藏、筆記、熟悉度，以及各單字本是否包含它 */
export async function getSaveState(userId: string, rawHeadword: string) {
  const headword = normalizeHeadword(rawHeadword);
  const [saved] = await db
    .select({ id: savedWords.id, note: savedWords.note })
    .from(savedWords)
    .where(and(activeSaved(userId), eq(savedWords.headword, headword)));

  const books = await db
    .select({
      id: wordbooks.id,
      name: wordbooks.name,
      contains: saved
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM ${wordbookItems} wi
            WHERE wi.wordbook_id = "wordbooks"."id"
              AND wi.saved_word_id = ${saved.id}
              AND wi.user_id = ${userId}
              AND wi.deleted_at IS NULL)`
        : sql<boolean>`false`,
    })
    .from(wordbooks)
    .where(activeWordbook(userId))
    .orderBy(asc(wordbooks.sortOrder), asc(wordbooks.createdAt));

  const [card] = saved
    ? await db
        .select({ state: cards.state, stability: cards.stability })
        .from(cards)
        .where(enZhCard(userId, headword))
    : [];

  return { saved: saved ?? null, familiarity: familiarityOf(card), wordbooks: books };
}

/** 這個字的 en_zh 字卡（熟悉度依據） */
const enZhCard = (userId: string, headword: string | typeof savedWords.headword) =>
  and(eq(cards.userId, userId), eq(cards.headword, headword), eq(cards.direction, "en_zh"), isNull(cards.deletedAt));

export type SavedSort = "recent" | "alpha";

/** 收藏字的第一筆中文釋義（列表顯示用；優先取一般釋義，專業領域釋義排後）。
 * 注意：select 欄位中的子查詢，Drizzle 會把 ${column} 輸出成不帶表名的欄位，關聯條件會錯，
 * 因此子查詢一律用別名寫出完整欄位名稱 */
const firstGloss = () => sql<string | null>`coalesce(
    ${modernGlossSql(sql`"saved_words"."headword"`)},
    (SELECT CASE WHEN d.pos IS NULL THEN d.text ELSE d.pos || ' ' || d.text END
    FROM ${definitions} d
    WHERE d.headword = "saved_words"."headword" AND d.lang = 'zh-TW'
    ORDER BY d.text ~ ${TECHNICAL_GLOSS_PATTERN}, d.sort_order LIMIT 1))`;

/** 收藏列表：可依單字本篩選、依收藏時間（新到舊）或字母排序 */
export async function listSavedWords(userId: string, options: { wordbookId?: string | null; sort?: SavedSort } = {}) {
  const { wordbookId, sort = "recent" } = options;
  const base = db
    .select({
      id: savedWords.id,
      headword: savedWords.headword,
      display: sql<string>`coalesce(${entries.display}, ${savedWords.headword})`,
      note: savedWords.note,
      savedAt: savedWords.createdAt,
      gloss: firstGloss(),
      cardState: cards.state,
      cardStability: cards.stability,
    })
    .from(savedWords)
    .leftJoin(entries, eq(entries.headword, savedWords.headword)) // 字典可能被替換，不用外鍵也不用 inner join
    .leftJoin(cards, enZhCard(userId, savedWords.headword));

  const query = wordbookId
    ? base.innerJoin(
        wordbookItems,
        and(
          eq(wordbookItems.savedWordId, savedWords.id),
          eq(wordbookItems.wordbookId, wordbookId),
          eq(wordbookItems.userId, userId),
          isNull(wordbookItems.deletedAt),
        ),
      )
    : base;

  const rows = await query
    .where(activeSaved(userId))
    .orderBy(...(sort === "alpha" ? [asc(savedWords.headword)] : [desc(savedWords.createdAt), asc(savedWords.headword)]));
  return rows.map(({ cardState, cardStability, ...row }) => ({
    ...row,
    familiarity: familiarityOf(cardState === null ? null : { state: cardState, stability: cardStability ?? 0 }),
  }));
}

export type NoteSort = "recent" | "alpha";

/**
 * 筆記庫：有筆記的收藏字。q 會比對筆記內容與單字（不分大小寫）。
 * 「最近」依收藏紀錄的 updated_at 排序（筆記沒有獨立的更新時間，重新收藏也會更新它）。
 */
export async function listNotes(userId: string, options: { q?: string | null; sort?: NoteSort } = {}) {
  const { sort = "recent" } = options;
  const q = options.q?.trim();
  // LIKE 的 \ % _ 要跳脫，搜尋字串裡的這些字元才會照字面比對
  const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;

  return db
    .select({
      id: savedWords.id,
      headword: savedWords.headword,
      display: sql<string>`coalesce(${entries.display}, ${savedWords.headword})`,
      note: sql<string>`${savedWords.note}`,
      updatedAt: savedWords.updatedAt,
      gloss: firstGloss(),
    })
    .from(savedWords)
    .leftJoin(entries, eq(entries.headword, savedWords.headword))
    .where(
      and(
        activeSaved(userId),
        isNotNull(savedWords.note),
        pattern ? or(ilike(savedWords.note, pattern), ilike(savedWords.headword, pattern)) : undefined,
      ),
    )
    .orderBy(...(sort === "alpha" ? [asc(savedWords.headword)] : [desc(savedWords.updatedAt), asc(savedWords.headword)]));
}

/** 目前收藏中的字數 */
export async function countSavedWords(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(savedWords)
    .where(and(eq(savedWords.userId, userId), isNull(savedWords.deletedAt)));
  return row?.n ?? 0;
}

// ---------------------------------------------------------------- 單字本

export async function listWordbooks(userId: string) {
  return db
    .select({
      id: wordbooks.id,
      name: wordbooks.name,
      description: wordbooks.description,
      count: sql<number>`(
        SELECT count(*)::int FROM ${wordbookItems} wi
        JOIN ${savedWords} sw ON sw.id = wi.saved_word_id
        WHERE wi.wordbook_id = "wordbooks"."id"
          AND wi.user_id = ${userId}
          AND wi.deleted_at IS NULL
          AND sw.deleted_at IS NULL)`,
    })
    .from(wordbooks)
    .where(activeWordbook(userId))
    .orderBy(asc(wordbooks.sortOrder), asc(wordbooks.createdAt));
}

export async function getWordbook(userId: string, wordbookId: string) {
  const [book] = await db
    .select({ id: wordbooks.id, name: wordbooks.name, description: wordbooks.description })
    .from(wordbooks)
    .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)));
  return book ?? null;
}

export async function createWordbook(userId: string, input: { name: string; description?: string | null }) {
  const values = cleanWordbookInput(input);
  const [book] = await db
    .insert(wordbooks)
    .values({ userId, ...values })
    .returning({ id: wordbooks.id, name: wordbooks.name });
  return book;
}

export async function updateWordbook(
  userId: string,
  wordbookId: string,
  input: { name: string; description?: string | null },
): Promise<void> {
  const values = cleanWordbookInput(input);
  const updated = await db
    .update(wordbooks)
    .set({ ...values, updatedAt: new Date() })
    .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)))
    .returning({ id: wordbooks.id });
  if (updated.length === 0) throw new NotFoundError("wordbook");
}

/** 刪除單字本（軟刪除），其中的項目一併軟刪除；收藏本身不受影響 */
export async function deleteWordbook(userId: string, wordbookId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(wordbooks)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)))
      .returning({ id: wordbooks.id });
    if (updated.length === 0) throw new NotFoundError("wordbook");
    await tx
      .update(wordbookItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(wordbookItems.userId, userId), eq(wordbookItems.wordbookId, wordbookId), isNull(wordbookItems.deletedAt)));
  });
}

/** 把已收藏的字放入或移出單字本；單字本與收藏都必須屬於這個使用者 */
export async function setWordbookMembership(
  userId: string,
  wordbookId: string,
  rawHeadword: string,
  member: boolean,
): Promise<void> {
  const headword = normalizeHeadword(rawHeadword);
  await db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: wordbooks.id })
      .from(wordbooks)
      .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)));
    if (!book) throw new NotFoundError("wordbook");
    const [saved] = await tx
      .select({ id: savedWords.id })
      .from(savedWords)
      .where(and(activeSaved(userId), eq(savedWords.headword, headword)));
    if (!saved) throw new NotFoundError("saved word");

    const now = new Date();
    if (member) {
      await tx
        .insert(wordbookItems)
        .values({ wordbookId: book.id, savedWordId: saved.id, userId })
        .onConflictDoUpdate({
          target: [wordbookItems.wordbookId, wordbookItems.savedWordId],
          set: { deletedAt: null, updatedAt: now },
          setWhere: isNotNull(wordbookItems.deletedAt),
        });
    } else {
      await tx
        .update(wordbookItems)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            eq(wordbookItems.userId, userId),
            eq(wordbookItems.wordbookId, book.id),
            eq(wordbookItems.savedWordId, saved.id),
            isNull(wordbookItems.deletedAt),
          ),
        );
    }
  });
}
