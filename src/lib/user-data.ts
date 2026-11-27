/**
 * 使用者資料存取層：收藏、筆記、單字本、字卡。
 *
 * 收藏的定義：至少在一本單字本裡。放進第一本時收藏（並建立字卡），從最後一本移出、
 * 或刪掉它唯一所在的單字本時取消收藏（字卡移出複習）。筆記獨立存放，和收藏無關。
 *
 * 規則：
 * - 第一個參數一律是 userId，只能由伺服器端從 session 取得（見 session.ts），不可來自用戶端。
 * - 每個查詢都以 userId 過濾；操作別人的資料一律視為「找不到」（NotFoundError），不透露資料是否存在。
 * - 不做硬刪除：取消收藏、刪除單字本都是設定 deleted_at（軟刪除）。
 */
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cards,
  definitions,
  entries,
  noteTags,
  savedWords,
  wordbookItems,
  wordbooks,
  wordForms,
  wordNotes,
  wordNoteTags,
} from "@/db/schema";
import { modernGlossSql, TECHNICAL_GLOSS_PATTERN } from "@/lib/gloss";
import { familiarityOf } from "./familiarity";
import { normalizeHeadword } from "./headword";
import {
  isTagColor,
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_NOTE,
  type NoteTag,
  normalizeTagName,
  TAG_COLOR_NAMES,
  type TagColor,
  tagKey,
} from "./note-tags";
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
const MAX_NOTE_TITLE_LENGTH = 100;
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

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 收藏一個字（在呼叫端的 transaction 裡，headword 須已正規化）：重新收藏時清除 deleted_at
 * 並把收藏時間更新為現在；同時確保有一張 en_zh 字卡（曾取消收藏則恢復原本的字卡與複習進度）。
 * 只由「放進單字本」呼叫，維持「收藏＝至少在一本單字本裡」。
 */
async function saveWordIn(tx: Tx, userId: string, headword: string) {
  const [entry] = await tx.select({ h: entries.headword }).from(entries).where(eq(entries.headword, headword));
  if (!entry) throw new NotFoundError("headword");

  const now = new Date();
  const [saved] = await tx
    .insert(savedWords)
    .values({ userId, headword, origin: "search" })
    .onConflictDoUpdate({
      target: [savedWords.userId, savedWords.headword],
      set: {
        deletedAt: null,
        updatedAt: now,
        createdAt: sql`CASE WHEN ${savedWords.deletedAt} IS NOT NULL THEN ${now} ELSE ${savedWords.createdAt} END`,
      },
    })
    .returning({ id: savedWords.id });

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

/** 取消收藏（在呼叫端的 transaction 裡）：收藏、它在各單字本的項目、字卡都改為軟刪除 */
async function unsaveIn(tx: Tx, userId: string, savedWordIds: string[], now: Date) {
  if (savedWordIds.length === 0) return;
  const rows = await tx
    .update(savedWords)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(activeSaved(userId), inArray(savedWords.id, savedWordIds)))
    .returning({ headword: savedWords.headword });
  await tx
    .update(wordbookItems)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(wordbookItems.userId, userId), inArray(wordbookItems.savedWordId, savedWordIds), isNull(wordbookItems.deletedAt)));
  if (rows.length === 0) return;
  await tx
    .update(cards)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(cards.userId, userId),
        inArray(
          cards.headword,
          rows.map((r) => r.headword),
        ),
        isNull(cards.deletedAt),
      ),
    );
}

/** 這些收藏是否還在任何（未刪除的）單字本裡；回傳已經不在任何一本的 id */
async function orphanedIn(tx: Tx, userId: string, savedWordIds: string[]): Promise<string[]> {
  if (savedWordIds.length === 0) return [];
  const rows = await tx
    .select({ id: savedWords.id })
    .from(savedWords)
    .where(
      and(
        activeSaved(userId),
        inArray(savedWords.id, savedWordIds),
        sql`NOT EXISTS (
          SELECT 1 FROM ${wordbookItems} wi
          JOIN ${wordbooks} w ON w.id = wi.wordbook_id AND w.deleted_at IS NULL
          WHERE wi.saved_word_id = "saved_words"."id" AND wi.user_id = ${userId} AND wi.deleted_at IS NULL)`,
      ),
    );
  return rows.map((r) => r.id);
}

export type ImportResult = {
  added: number; // 新收藏（含曾取消收藏、這次恢復的）
  alreadySaved: number;
  converted: { from: string; to: string }[]; // 變化形轉成原形（went → go）
  notFound: string[];
};

/**
 * 匯入純文字單字清單（格式見 word-list.ts）：把字典裡有的字放進指定的單字本（未收藏的字一併收藏並建立字卡）。
 * 字典沒有的字先試著轉成原形，仍找不到就列在 notFound。已收藏的字不變動，只會多放進這本單字本。
 * 新收藏的時間依清單順序遞增 1 毫秒，複習時新卡會照清單順序出現。
 */
export async function importWords(userId: string, text: string, wordbookId: string): Promise<ImportResult> {
  if (text.length > MAX_IMPORT_CHARS) throw new ValidationError("內容太長，請分批匯入");
  const words = parseWordList(text);
  if (words.length === 0) throw new ValidationError("沒有讀到任何單字");
  if (words.length > MAX_IMPORT_WORDS) throw new ValidationError(`一次最多匯入 ${MAX_IMPORT_WORDS} 個字（這次有 ${words.length} 個）`);

  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: wordbooks.id })
      .from(wordbooks)
      .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)));
    if (!book) throw new NotFoundError("wordbook");

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
    return result;
  });
}

// ---------------------------------------------------------------- 筆記

const activeTag = (userId: string) => and(eq(noteTags.userId, userId), isNull(noteTags.deletedAt));

/** 整理標籤名稱並檢查長度 */
function cleanTagName(raw: string): string {
  const name = normalizeTagName(raw);
  if (!name) throw new ValidationError("請輸入標籤名稱");
  if (name.length > MAX_TAG_LENGTH) throw new ValidationError(`標籤最多 ${MAX_TAG_LENGTH} 字`);
  return name;
}

/** 這位使用者未刪除、名稱相同（不分大小寫）的標籤 */
async function findTagByName(tx: Tx | typeof db, userId: string, name: string) {
  const [row] = await tx
    .select({ id: noteTags.id, name: noteTags.name, color: noteTags.color })
    .from(noteTags)
    .where(and(activeTag(userId), eq(sql`lower(${noteTags.name})`, tagKey(name))));
  return row ? toNoteTag(row) : null;
}

const toNoteTag = (row: { id: string; name: string; color: string }): NoteTag => ({
  ...row,
  color: isTagColor(row.color) ? row.color : "gray",
});

/**
 * 建立標籤（筆記編輯視窗的標籤選單「建立」）；已有同名（不分大小寫）的就回傳那個。
 * 顏色依目前標籤數輪流配
 */
export async function createNoteTag(userId: string, rawName: string): Promise<NoteTag> {
  const name = cleanTagName(rawName);
  return db.transaction(async (tx) => {
    const existing = await findTagByName(tx, userId, name);
    if (existing) return existing;
    // 和標籤選單「建立」預覽的顏色算法一致（未刪除的標籤數）
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(noteTags).where(activeTag(userId));
    const color = TAG_COLOR_NAMES[n % TAG_COLOR_NAMES.length];
    const [row] = await tx
      .insert(noteTags)
      .values({ userId, name, color })
      .returning({ id: noteTags.id, name: noteTags.name, color: noteTags.color });
    return toNoteTag(row);
  });
}

/** 改標籤名稱或顏色（所有用到它的筆記一起變）；改成和別的標籤同名時報錯 */
export async function updateNoteTag(userId: string, id: string, input: { name?: string; color?: TagColor }): Promise<NoteTag> {
  const name = input.name === undefined ? undefined : cleanTagName(input.name);
  return db.transaction(async (tx) => {
    if (name !== undefined) {
      const same = await findTagByName(tx, userId, name);
      if (same && same.id !== id) throw new ValidationError(`已經有「${same.name}」這個標籤`);
    }
    const [row] = await tx
      .update(noteTags)
      .set({ ...(name !== undefined && { name }), ...(input.color && { color: input.color }), updatedAt: new Date() })
      .where(and(activeTag(userId), eq(noteTags.id, id)))
      .returning({ id: noteTags.id, name: noteTags.name, color: noteTags.color });
    if (!row) throw new NotFoundError("tag");
    return toNoteTag(row);
  });
}

/** 刪除標籤（軟刪除）：所有筆記上的這個標籤一併拿掉 */
export async function deleteNoteTag(userId: string, id: string): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(noteTags)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(activeTag(userId), eq(noteTags.id, id)))
      .returning({ id: noteTags.id });
    if (rows.length === 0) return;
    await tx
      .update(wordNoteTags)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(wordNoteTags.userId, userId), eq(wordNoteTags.tagId, id), isNull(wordNoteTags.deletedAt)));
  });
}

/** 整理筆記的標籤 id 清單：去重、檢查數量上限（是否屬於這位使用者在 setNoteTags 裡檢查） */
function cleanTagIds(ids: string[]): string[] {
  const out = [...new Set(ids)];
  if (out.length > MAX_TAGS_PER_NOTE) throw new ValidationError(`每則筆記最多 ${MAX_TAGS_PER_NOTE} 個標籤`);
  return out;
}

/**
 * 把一則筆記的標籤設成 ids（須先經 cleanTagIds）：只採用這位使用者未刪除的標籤（別人的、已刪除的略過），
 * 補上缺的連結（之前拿掉過的清掉 deletedAt），不在清單裡的連結軟刪除。呼叫端須確認筆記屬於這位使用者
 */
async function setNoteTags(tx: Tx, userId: string, noteId: string, ids: string[]): Promise<void> {
  const now = new Date();
  let tagIds: string[] = [];
  if (ids.length > 0) {
    const tags = await tx
      .select({ id: noteTags.id })
      .from(noteTags)
      .where(and(activeTag(userId), inArray(noteTags.id, ids)));
    tagIds = tags.map((t) => t.id);
  }
  if (tagIds.length > 0) {
    await tx
      .insert(wordNoteTags)
      .values(tagIds.map((tagId) => ({ noteId, tagId, userId })))
      .onConflictDoUpdate({
        target: [wordNoteTags.noteId, wordNoteTags.tagId],
        set: { deletedAt: null, updatedAt: now },
      });
  }
  await tx
    .update(wordNoteTags)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(wordNoteTags.userId, userId),
        eq(wordNoteTags.noteId, noteId),
        isNull(wordNoteTags.deletedAt),
        tagIds.length > 0 ? notInArray(wordNoteTags.tagId, tagIds) : undefined,
      ),
    );
}

/**
 * 寫入這個字的筆記（沒收藏也可以）；空字串＝清除筆記（軟刪除，標籤一併拿掉）。
 * tags 是標籤 id，省略＝不動標籤
 */
export async function setNote(userId: string, rawHeadword: string, note: string | null, tags?: string[]): Promise<void> {
  const headword = normalizeHeadword(rawHeadword);
  const cleaned = cleanNote(note);
  const tagIds = tags && cleanTagIds(tags);
  const now = new Date();
  if (cleaned === null) {
    await db.transaction(async (tx) => {
      const removed = await tx
        .update(wordNotes)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(wordNotes.userId, userId), eq(wordNotes.headword, headword), isNull(wordNotes.deletedAt)))
        .returning({ id: wordNotes.id });
      for (const { id } of removed) await setNoteTags(tx, userId, id, []);
    });
    return;
  }
  const [entry] = await db.select({ h: entries.headword }).from(entries).where(eq(entries.headword, headword));
  if (!entry) throw new NotFoundError("headword");
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(wordNotes)
      .values({ userId, headword, note: cleaned })
      .onConflictDoUpdate({
        target: [wordNotes.userId, wordNotes.headword],
        set: { note: cleaned, deletedAt: null, updatedAt: now },
      })
      .returning({ id: wordNotes.id });
    if (tagIds) await setNoteTags(tx, userId, row.id, tagIds);
  });
}

function cleanNoteTitle(title: string): string {
  const v = title.trim().replace(/\s+/g, " ");
  if (!v) throw new ValidationError("請輸入標題");
  if (v.length > MAX_NOTE_TITLE_LENGTH) throw new ValidationError(`標題最多 ${MAX_NOTE_TITLE_LENGTH} 字`);
  return v;
}

/** 這位使用者、這個 id、尚未刪除的自由筆記 */
const activeFreeNote = (userId: string, id: string) =>
  and(eq(wordNotes.userId, userId), eq(wordNotes.id, id), isNull(wordNotes.headword), isNull(wordNotes.deletedAt));

/** tags 是標籤 id（標籤先在標籤選單建立） */
type FreeNoteInput = { title: string; note: string; tags: string[] };

/** 新增自由筆記（不屬於任何單字，例如文法筆記）：標題必填，內容與標籤可以空白 */
export async function createFreeNote(userId: string, input: FreeNoteInput): Promise<{ id: string }> {
  const title = cleanNoteTitle(input.title);
  const note = cleanNote(input.note) ?? "";
  const tags = cleanTagIds(input.tags);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(wordNotes).values({ userId, title, note }).returning({ id: wordNotes.id });
    await setNoteTags(tx, userId, row.id, tags);
    return row;
  });
}

/** 修改自由筆記的標題、內容與標籤 */
export async function updateFreeNote(userId: string, id: string, input: FreeNoteInput): Promise<void> {
  const title = cleanNoteTitle(input.title);
  const note = cleanNote(input.note) ?? "";
  const tags = cleanTagIds(input.tags);
  await db.transaction(async (tx) => {
    const rows = await tx
      .update(wordNotes)
      .set({ title, note, updatedAt: new Date() })
      .where(activeFreeNote(userId, id))
      .returning({ id: wordNotes.id });
    if (rows.length === 0) throw new NotFoundError("note");
    await setNoteTags(tx, userId, id, tags);
  });
}

/** 刪除自由筆記（軟刪除） */
export async function deleteFreeNote(userId: string, id: string): Promise<void> {
  const now = new Date();
  await db.update(wordNotes).set({ deletedAt: now, updatedAt: now }).where(activeFreeNote(userId, id));
}

/** 單字頁用：這個字是否已收藏、筆記、熟悉度，以及各單字本是否包含它 */
export async function getSaveState(userId: string, rawHeadword: string) {
  const headword = normalizeHeadword(rawHeadword);
  const [saved] = await db
    .select({ id: savedWords.id })
    .from(savedWords)
    .where(and(activeSaved(userId), eq(savedWords.headword, headword)));

  const [noteRow] = await db
    .select({ note: wordNotes.note, tags: noteTagsSql() })
    .from(wordNotes)
    .where(and(eq(wordNotes.userId, userId), eq(wordNotes.headword, headword), isNull(wordNotes.deletedAt)));

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

  // 最近用過的單字本＝最近放字進去的那本（點星號直接收藏用）；都沒放過字就用清單第一本
  const [recent] = await db
    .select({ id: wordbookItems.wordbookId })
    .from(wordbookItems)
    .innerJoin(wordbooks, eq(wordbooks.id, wordbookItems.wordbookId))
    .where(and(eq(wordbookItems.userId, userId), isNull(wordbookItems.deletedAt), activeWordbook(userId)))
    .orderBy(desc(wordbookItems.updatedAt))
    .limit(1);

  const [card] = saved
    ? await db
        .select({ state: cards.state, stability: cards.stability })
        .from(cards)
        .where(enZhCard(userId, headword))
    : [];

  return {
    saved: Boolean(saved),
    note: noteRow?.note ?? null,
    noteTags: noteRow?.tags ?? [],
    familiarity: familiarityOf(card),
    wordbooks: books,
    recentWordbookId: recent?.id ?? books[0]?.id ?? null,
  };
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
      note: wordNotes.note,
      savedAt: savedWords.createdAt,
      gloss: firstGloss(),
      cardState: cards.state,
      cardStability: cards.stability,
    })
    .from(savedWords)
    .leftJoin(entries, eq(entries.headword, savedWords.headword)) // 字典可能被替換，不用外鍵也不用 inner join
    .leftJoin(cards, enZhCard(userId, savedWords.headword))
    .leftJoin(
      wordNotes,
      and(eq(wordNotes.userId, userId), eq(wordNotes.headword, savedWords.headword), isNull(wordNotes.deletedAt)),
    );

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

/** 列表的第一筆中文釋義（同 firstGloss，給筆記庫用：主表是 word_notes） */
const noteGloss = () => sql<string | null>`coalesce(
    ${modernGlossSql(sql`"word_notes"."headword"`)},
    (SELECT CASE WHEN d.pos IS NULL THEN d.text ELSE d.pos || ' ' || d.text END
    FROM ${definitions} d
    WHERE d.headword = "word_notes"."headword" AND d.lang = 'zh-TW'
    ORDER BY d.text ~ ${TECHNICAL_GLOSS_PATTERN}, d.sort_order LIMIT 1))`;

/**
 * 一則筆記的標籤（依名稱排序），沒有標籤是空陣列。子查詢的欄位同 firstGloss 要寫出完整名稱。
 * 顏色照資料庫原樣，不認得的顏色畫面上用 tagColorClass 當灰色
 */
const noteTagsSql = () => sql<NoteTag[]>`coalesce((
    SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY lower(t.name))
    FROM ${wordNoteTags} wnt JOIN ${noteTags} t ON t.id = wnt.tag_id
    WHERE wnt.note_id = "word_notes"."id" AND wnt.deleted_at IS NULL AND t.deleted_at IS NULL), '[]'::json)`;

/** 筆記內頁：一筆筆記（單字筆記或自由筆記），找不到或已刪除時回傳 null */
export async function getNote(userId: string, id: string) {
  const [row] = await db
    .select({
      id: wordNotes.id,
      headword: wordNotes.headword,
      title: wordNotes.title,
      display: sql<string>`coalesce(${wordNotes.title}, ${entries.display}, ${wordNotes.headword})`,
      note: wordNotes.note,
      createdAt: wordNotes.createdAt,
      updatedAt: wordNotes.updatedAt,
      gloss: noteGloss(),
      tags: noteTagsSql(),
    })
    .from(wordNotes)
    .leftJoin(entries, eq(entries.headword, wordNotes.headword))
    .where(and(eq(wordNotes.userId, userId), eq(wordNotes.id, id), isNull(wordNotes.deletedAt)));
  return row ?? null;
}

/** 筆記頁的內建篩選：全部、單字筆記（有 headword）、自由筆記（沒有 headword） */
export type NoteKind = "all" | "word" | "free";

/** 這則筆記有符合 condition 的標籤（t 是標籤表的別名） */
const hasNoteTag = (condition: SQL) => sql`EXISTS (
    SELECT 1 FROM ${wordNoteTags} wnt JOIN ${noteTags} t ON t.id = wnt.tag_id
    WHERE wnt.note_id = "word_notes"."id" AND wnt.deleted_at IS NULL AND t.deleted_at IS NULL AND ${condition})`;

/**
 * 筆記庫：單字筆記（不論是否收藏）與自由筆記。q 會比對筆記內容、單字、標題與標籤（不分大小寫）；
 * tag 只留下有這個標籤的筆記（不分大小寫）。「最近」依筆記更新時間，「字母」依標題（單字筆記的標題就是單字）
 */
export async function listNotes(
  userId: string,
  options: { q?: string | null; sort?: NoteSort; kind?: NoteKind; tag?: string | null } = {},
) {
  const { sort = "recent", kind = "all" } = options;
  const titleSql = sql<string>`coalesce(${wordNotes.title}, ${wordNotes.headword})`;
  const q = options.q?.trim();
  const tag = options.tag?.trim();
  // LIKE 的 \ % _ 要跳脫，搜尋字串裡的這些字元才會照字面比對
  const pattern = q ? `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%` : null;

  return db
    .select({
      id: wordNotes.id,
      headword: wordNotes.headword,
      title: wordNotes.title,
      display: sql<string>`coalesce(${wordNotes.title}, ${entries.display}, ${wordNotes.headword})`,
      note: wordNotes.note,
      updatedAt: wordNotes.updatedAt,
      gloss: noteGloss(),
      tags: noteTagsSql(),
    })
    .from(wordNotes)
    .leftJoin(entries, eq(entries.headword, wordNotes.headword))
    .where(
      and(
        eq(wordNotes.userId, userId),
        isNull(wordNotes.deletedAt),
        kind === "word" ? isNotNull(wordNotes.headword) : kind === "free" ? isNull(wordNotes.headword) : undefined,
        pattern
          ? or(
              // 去掉顏色語法 `{red|…}` 與底線的 <u></u> 再比對（見 lib/note-color.ts），搜 red、blue 這類字才不會命中所有上色的筆記。
              // 表格裡的 | 會被跳脫成 \|，先換回來；反斜線用 chr(92) 表示，免得在 SQL 字串裡被誤解
              ilike(
                sql`regexp_replace(replace(${wordNotes.note}, chr(92) || '|', '|'), '[{](bg-)?[a-z]+[|]|[}]|</?u>', '', 'gi')`,
                pattern,
              ),
              ilike(wordNotes.headword, pattern),
              ilike(wordNotes.title, pattern),
              hasNoteTag(sql`t.name ILIKE ${pattern}`),
            )
          : undefined,
        tag ? hasNoteTag(sql`lower(t.name) = lower(${tag})`) : undefined,
      ),
    )
    .orderBy(
      ...(sort === "alpha"
        ? [asc(sql`lower(${titleSql})`), asc(wordNotes.id)]
        : [desc(wordNotes.updatedAt), asc(titleSql)]),
    );
}

/**
 * 這位使用者所有未刪除的標籤（依名稱排序）與各自的筆記數（不含已刪除的筆記）。
 * 編輯視窗的標籤選單列出全部；筆記頁的標籤篩選只顯示 count > 0 的
 */
export async function listNoteTags(userId: string): Promise<(NoteTag & { count: number })[]> {
  const rows = await db
    .select({
      id: noteTags.id,
      name: noteTags.name,
      color: noteTags.color,
      count: sql<number>`count(${wordNotes.id})::int`,
    })
    .from(noteTags)
    .leftJoin(wordNoteTags, and(eq(wordNoteTags.tagId, noteTags.id), isNull(wordNoteTags.deletedAt)))
    .leftJoin(wordNotes, and(eq(wordNotes.id, wordNoteTags.noteId), isNull(wordNotes.deletedAt)))
    .where(activeTag(userId))
    .groupBy(noteTags.id)
    .orderBy(asc(sql`lower(${noteTags.name})`));
  return rows.map((r) => ({ ...toNoteTag(r), count: r.count }));
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
      // 只在這本裡的字：刪除這本單字本時會一併取消收藏
      exclusiveCount: sql<number>`(
        SELECT count(*)::int FROM ${wordbookItems} wi
        JOIN ${savedWords} sw ON sw.id = wi.saved_word_id
        WHERE wi.wordbook_id = "wordbooks"."id"
          AND wi.user_id = ${userId}
          AND wi.deleted_at IS NULL
          AND sw.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM ${wordbookItems} other
            JOIN ${wordbooks} ow ON ow.id = other.wordbook_id AND ow.deleted_at IS NULL
            WHERE other.saved_word_id = wi.saved_word_id
              AND other.wordbook_id <> wi.wordbook_id
              AND other.deleted_at IS NULL))`,
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

/**
 * 刪除單字本（軟刪除），其中的項目一併軟刪除。只在這本裡的字會一併取消收藏（字卡移出複習）。
 * 回傳一併取消收藏的字數。
 */
export async function deleteWordbook(userId: string, wordbookId: string): Promise<number> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const updated = await tx
      .update(wordbooks)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)))
      .returning({ id: wordbooks.id });
    if (updated.length === 0) throw new NotFoundError("wordbook");
    const items = await tx
      .update(wordbookItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(wordbookItems.userId, userId), eq(wordbookItems.wordbookId, wordbookId), isNull(wordbookItems.deletedAt)))
      .returning({ savedWordId: wordbookItems.savedWordId });
    const orphans = await orphanedIn(
      tx,
      userId,
      items.map((i) => i.savedWordId),
    );
    await unsaveIn(tx, userId, orphans, now);
    return orphans.length;
  });
}

/**
 * 把字放入或移出一本單字本（收藏視窗每點一列就呼叫一次）。
 * 放入：還沒收藏時一併收藏並建立字卡。移出：已經不在任何單字本時一併取消收藏（字卡移出複習）。
 * 回傳操作後這個字是否仍是收藏中。
 */
export async function setWordbookMembership(
  userId: string,
  wordbookId: string,
  rawHeadword: string,
  member: boolean,
): Promise<{ saved: boolean }> {
  const headword = normalizeHeadword(rawHeadword);
  return db.transaction(async (tx) => {
    const [book] = await tx
      .select({ id: wordbooks.id })
      .from(wordbooks)
      .where(and(activeWordbook(userId), eq(wordbooks.id, wordbookId)));
    if (!book) throw new NotFoundError("wordbook");

    const now = new Date();
    if (member) {
      const saved = await saveWordIn(tx, userId, headword);
      await tx
        .insert(wordbookItems)
        .values({ wordbookId: book.id, savedWordId: saved.id, userId })
        .onConflictDoUpdate({
          target: [wordbookItems.wordbookId, wordbookItems.savedWordId],
          set: { deletedAt: null, updatedAt: now },
          setWhere: isNotNull(wordbookItems.deletedAt),
        });
      return { saved: true };
    }

    const [saved] = await tx
      .select({ id: savedWords.id })
      .from(savedWords)
      .where(and(activeSaved(userId), eq(savedWords.headword, headword)));
    if (!saved) return { saved: false }; // 本來就沒收藏：視為已移出
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
    const orphans = await orphanedIn(tx, userId, [saved.id]);
    await unsaveIn(tx, userId, orphans, now);
    return { saved: orphans.length === 0 };
  });
}
