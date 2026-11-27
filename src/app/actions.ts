"use server";

/**
 * Server Actions：收藏、筆記、單字本、複習、設定、查字歷史。
 * 每個 action 都自己從 session 取得 user id（不接受用戶端傳入），參數在這裡做型別檢查。
 */
import { refresh } from "next/cache";
import { summarizeWords, type WordSummary } from "@/lib/dictionary";
import { normalizeHeadword } from "@/lib/headword";
import * as history from "@/lib/lookup-history";
import { isTagColor, type NoteTag, type TagColor } from "@/lib/note-tags";
import * as review from "@/lib/review";
import { getReviewState, type ReviewState } from "@/lib/review-session";
import { getCurrentUser } from "@/lib/session";
import * as data from "@/lib/user-data";
import { isUuid } from "@/lib/uuid";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function str(value: unknown, field: string): string {
  if (typeof value !== "string") throw new data.ValidationError(`${field} 格式錯誤`);
  return value;
}

function uuid(value: unknown, field: string): string {
  if (!isUuid(value)) throw new data.NotFoundError(field);
  return value;
}

/** 共用的 action 包裝；複習相關的 action 自己回傳最新狀態，用 { refresh: false } 避免整頁重新渲染 */
async function run<T>(fn: (userId: string) => Promise<T>, options = { refresh: true }): Promise<ActionResult<T>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "請先登入" };
  try {
    const result = await fn(user.id);
    if (options.refresh) refresh();
    return { ok: true, data: result };
  } catch (err) {
    if (err instanceof data.ValidationError) return { ok: false, error: err.message };
    if (err instanceof data.NotFoundError) return { ok: false, error: "找不到資料，請重新整理頁面" };
    console.error(err);
    return { ok: false, error: "發生錯誤，請稍後再試" };
  }
}

/**
 * 把字放入或移出一本單字本（收藏視窗的每一列）。放進第一本時收藏、移出最後一本時取消收藏；
 * 回傳操作後這個字是否仍是收藏中
 */
export async function setWordbookMembershipAction(
  wordbookId: unknown,
  headword: unknown,
  member: unknown,
): Promise<ActionResult<{ saved: boolean }>> {
  return run((userId) => {
    if (typeof member !== "boolean") throw new data.ValidationError("格式錯誤");
    return data.setWordbookMembership(userId, uuid(wordbookId, "wordbook"), str(headword, "headword"), member);
  });
}

/** 匯入純文字單字清單到一本單字本（一定要選單字本：收藏＝在單字本裡） */
export async function importWordsAction(text: unknown, wordbookId: unknown): Promise<ActionResult<data.ImportResult>> {
  return run((userId) => data.importWords(userId, str(text, "text"), uuid(wordbookId, "wordbook")));
}

/** 筆記的標籤 id 清單；數量上限在 user-data 檢查，這裡先擋掉格式不對或過大的輸入 */
function tagList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 50 || !value.every(isUuid)) {
    throw new data.ValidationError("標籤格式錯誤");
  }
  return value;
}

/** 儲存筆記（和收藏無關：沒收藏也能寫；空白＝清除筆記）。tags 省略＝不動標籤 */
export async function saveNoteAction(headword: unknown, note: unknown, tags?: unknown): Promise<ActionResult> {
  return run((userId) =>
    data.setNote(
      userId,
      str(headword, "headword"),
      note == null ? null : str(note, "筆記"),
      tags === undefined ? undefined : tagList(tags),
    ),
  );
}

/** 新增自由筆記（筆記頁的「新增筆記」）；標題必填，標籤可以不填 */
export async function createFreeNoteAction(title: unknown, note: unknown, tags: unknown): Promise<ActionResult<{ id: string }>> {
  return run((userId) =>
    data.createFreeNote(userId, { title: str(title, "標題"), note: str(note, "筆記"), tags: tagList(tags) }),
  );
}

/** 修改自由筆記 */
export async function updateFreeNoteAction(id: unknown, title: unknown, note: unknown, tags: unknown): Promise<ActionResult> {
  return run((userId) =>
    data.updateFreeNote(userId, uuid(id, "note"), { title: str(title, "標題"), note: str(note, "筆記"), tags: tagList(tags) }),
  );
}

/** 所有標籤（編輯視窗的標籤選單打開時取得）；只讀，不重新渲染頁面 */
export async function listNoteTagsAction(): Promise<ActionResult<(NoteTag & { count: number })[]>> {
  return run((userId) => data.listNoteTags(userId), { refresh: false });
}

/** 建立標籤（標籤選單的「建立」）；同名已存在就回傳那個。要等筆記儲存才會掛到筆記上，所以不重新渲染 */
export async function createNoteTagAction(name: unknown): Promise<ActionResult<NoteTag>> {
  return run((userId) => data.createNoteTag(userId, str(name, "標籤")), { refresh: false });
}

/** 改標籤名稱或顏色（所有筆記上的這個標籤一起變） */
export async function updateNoteTagAction(id: unknown, change: unknown): Promise<ActionResult<NoteTag>> {
  return run((userId) => {
    const c = (change ?? {}) as { name?: unknown; color?: unknown };
    if (c.color !== undefined && !isTagColor(c.color)) throw new data.ValidationError("顏色格式錯誤");
    return data.updateNoteTag(userId, uuid(id, "tag"), {
      name: c.name === undefined ? undefined : str(c.name, "標籤"),
      color: c.color as TagColor | undefined,
    });
  });
}

/** 刪除標籤：所有筆記上的這個標籤一併拿掉 */
export async function deleteNoteTagAction(id: unknown): Promise<ActionResult> {
  return run((userId) => data.deleteNoteTag(userId, uuid(id, "tag")));
}

/** 刪除自由筆記（軟刪除） */
export async function deleteFreeNoteAction(id: unknown): Promise<ActionResult> {
  return run((userId) => data.deleteFreeNote(userId, uuid(id, "note")));
}

/** 調整熟悉度（0–3）；只有收藏的字可以調整。等級格式在 setFamiliarity 檢查 */
export async function setFamiliarityAction(headword: unknown, level: unknown): Promise<ActionResult<number>> {
  return run((userId) => review.setFamiliarity(userId, str(headword, "headword"), level));
}

export async function createWordbookAction(name: unknown, description?: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async (userId) => {
    const book = await data.createWordbook(userId, {
      name: str(name, "名稱"),
      description: description == null ? null : str(description, "說明"),
    });
    return { id: book.id };
  });
}

export async function updateWordbookAction(
  wordbookId: unknown,
  name: unknown,
  description?: unknown,
): Promise<ActionResult> {
  return run((userId) =>
    data.updateWordbook(userId, uuid(wordbookId, "wordbook"), {
      name: str(name, "名稱"),
      description: description == null ? null : str(description, "說明"),
    }),
  );
}

/** 刪除單字本；回傳只在這本裡、因此一併取消收藏的字數 */
export async function deleteWordbookAction(wordbookId: unknown): Promise<ActionResult<number>> {
  return run((userId) => data.deleteWordbook(userId, uuid(wordbookId, "wordbook")));
}

// ---------------------------------------------------------------- 複習

const noRefresh = { refresh: false };

export async function getReviewStateAction(): Promise<ActionResult<ReviewState>> {
  return run((userId) => getReviewState(userId), noRefresh);
}

/** 評分後回傳下一張卡；logId 由用戶端產生，重送同一個 logId 不會重複評分 */
export async function reviewCardAction(input: {
  logId: unknown;
  cardId: unknown;
  rating: unknown;
  durationMs?: unknown;
}): Promise<ActionResult<ReviewState>> {
  return run(async (userId) => {
    if (!isUuid(input.logId)) throw new data.ValidationError("logId 格式錯誤");
    await review.reviewCard(userId, {
      logId: input.logId,
      cardId: uuid(input.cardId, "card"),
      rating: typeof input.rating === "number" ? input.rating : NaN,
      durationMs: typeof input.durationMs === "number" ? input.durationMs : null,
    });
    return getReviewState(userId);
  }, noRefresh);
}

/** 復原今天最後一次評分，並回傳被還原的那張卡 */
export async function undoReviewAction(): Promise<ActionResult<ReviewState>> {
  return run(async (userId) => {
    const card = await review.undoLastReview(userId);
    return getReviewState(userId, card.id);
  }, noRefresh);
}

export async function updateSettingsAction(input: {
  newCardsPerDay: unknown;
  desiredRetention: unknown;
  dayStartsAtHour: unknown;
  frontExample: unknown;
}): Promise<ActionResult> {
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);
  return run((userId) =>
    review.updateSettings(userId, {
      newCardsPerDay: num(input.newCardsPerDay),
      desiredRetention: num(input.desiredRetention),
      dayStartsAtHour: num(input.dayStartsAtHour),
      frontExample: typeof input.frontExample === "boolean" ? input.frontExample : undefined,
    }),
  );
}

// ── 查字歷史 ───────────────────────────────────────────────
// 這幾個 action 不呼叫 refresh()：記錄與讀取歷史不應讓目前頁面重新渲染。未登入不算錯誤，回傳 synced: false 讓用戶端改存瀏覽器。

/** 解析用戶端送來的瀏覽器暫存歷史；格式不對的項目直接略過 */
function lookupEntries(value: unknown): history.LookupEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is history.LookupEntry =>
        typeof v === "object" && v !== null && typeof v.headword === "string" && typeof v.at === "number",
    )
    .slice(0, history.MAX_MERGE);
}

/** 單字頁打開時呼叫：登入時寫進資料庫；未登入回傳 synced: false */
export async function recordLookupAction(headword: unknown): Promise<{ synced: boolean }> {
  if (typeof headword !== "string" || !headword.trim()) return { synced: false };
  const user = await getCurrentUser();
  if (!user) return { synced: false };
  try {
    await history.recordLookups(user.id, [{ headword, at: Date.now() }]);
    return { synced: true };
  } catch (err) {
    console.error(err);
    return { synced: false };
  }
}

/**
 * 搜尋框聚焦時呼叫，取得最近查過的字。local = 瀏覽器暫存的歷史：
 * 登入時先合併進資料庫再讀（synced: true，用戶端可清掉暫存）；未登入時只替暫存的字補上釋義。
 */
export async function recentLookupsAction(local: unknown): Promise<{ synced: boolean; items: WordSummary[] }> {
  const entries = lookupEntries(local);
  const user = await getCurrentUser();
  try {
    if (user) {
      if (entries.length > 0) await history.recordLookups(user.id, entries);
      return { synced: true, items: await summarizeWords(await history.listRecentLookups(user.id)) };
    }
    const recent = [...entries].sort((a, b) => b.at - a.at).map((e) => normalizeHeadword(e.headword));
    return { synced: false, items: await summarizeWords([...new Set(recent)].slice(0, history.RECENT_LOOKUPS)) };
  } catch (err) {
    console.error(err);
    return { synced: false, items: [] };
  }
}

/** 從歷史移除一個字；未登入時回傳 synced: false，由用戶端從暫存移除 */
export async function removeLookupAction(headword: unknown): Promise<{ synced: boolean }> {
  if (typeof headword !== "string") return { synced: false };
  const user = await getCurrentUser();
  if (!user) return { synced: false };
  await history.removeLookup(user.id, headword);
  return { synced: true };
}
