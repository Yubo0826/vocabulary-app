/**
 * 使用者資料存取層：收藏、筆記、單字本、字卡。
 *
 * 規則：
 * - 第一個參數一律是 userId，只能由伺服器端從 session 取得（見 session.ts），不可來自用戶端。
 * - 每個查詢都以 userId 過濾；操作別人的資料一律視為「找不到」（NotFoundError），不透露資料是否存在。
 * - 不做硬刪除：取消收藏、刪除單字本都是設定 deleted_at（軟刪除）。
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, definitions, entries, savedWords, wordbookItems, wordbooks } from "@/db/schema";
import { normalizeHeadword } from "./headword";

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

/**
 * 收藏一個字：重新收藏時清除 deleted_at（並把收藏時間更新為現在）。
 * 同時確保有一張 en_zh 字卡（新卡 due = 現在、state = New；曾取消收藏則恢復原本的字卡與複習進度）。
 */
export async function saveWord(userId: string, rawHeadword: string, note?: string | null) {
  const headword = normalizeHeadword(rawHeadword);
  const cleanedNote = note === undefined ? undefined : cleanNote(note);
  return db.transaction((tx) => saveWordIn(tx, userId, headword, cleanedNote));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** saveWord 的本體，在呼叫端的 transaction 裡執行。headword 須已正規化 */
async function saveWordIn(tx: Tx, userId: string, headword: string, cleanedNote: string | null | undefined) {
  const [entry] = await tx.select({ h: entries.headword }).from(entries).where(eq(entries.headword, headword));
  if (!entry) throw new NotFoundError("headword");

  const now = new Date();
  const [saved] = await tx
    .insert(savedWords)
    .values({ userId, headword, note: cleanedNote ?? null, origin: "search" })
    .onConflictDoUpdate({
      target: [savedWords.userId, savedWords.headword],
      set: {
        deletedAt: null,
        updatedAt: now,
        createdAt: sql`CASE WHEN ${savedWords.deletedAt} IS NOT NULL THEN ${now} ELSE ${savedWords.createdAt} END`,
        ...(cleanedNote !== undefined ? { note: cleanedNote } : {}),
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

/** 單字頁用：這個字是否已收藏、筆記，以及各單字本是否包含它 */
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

  return { saved: saved ?? null, wordbooks: books };
}

export type SavedSort = "recent" | "alpha";

/** 收藏列表：可依單字本篩選、依收藏時間（新到舊）或字母排序 */
export async function listSavedWords(userId: string, options: { wordbookId?: string | null; sort?: SavedSort } = {}) {
  const { wordbookId, sort = "recent" } = options;
  // 注意：select 欄位中的子查詢，Drizzle 會把 ${column} 輸出成不帶表名的欄位，關聯條件會錯，
  // 因此子查詢一律用別名寫出完整欄位名稱
  const gloss = sql<string | null>`(
    SELECT CASE WHEN d.pos IS NULL THEN d.text ELSE d.pos || ' ' || d.text END
    FROM ${definitions} d
    WHERE d.headword = "saved_words"."headword" AND d.lang = 'zh-TW'
    ORDER BY d.sort_order LIMIT 1)`;

  const base = db
    .select({
      id: savedWords.id,
      headword: savedWords.headword,
      display: sql<string>`coalesce(${entries.display}, ${savedWords.headword})`,
      note: savedWords.note,
      savedAt: savedWords.createdAt,
      gloss,
    })
    .from(savedWords)
    .leftJoin(entries, eq(entries.headword, savedWords.headword)); // 字典可能被替換，不用外鍵也不用 inner join

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

  return query
    .where(activeSaved(userId))
    .orderBy(...(sort === "alpha" ? [asc(savedWords.headword)] : [desc(savedWords.createdAt), asc(savedWords.headword)]));
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
