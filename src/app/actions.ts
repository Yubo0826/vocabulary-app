"use server";

/**
 * Server Actions：收藏、筆記、單字本、複習、設定。
 * 每個 action 都自己從 session 取得 user id（不接受用戶端傳入），參數在這裡做型別檢查。
 */
import { refresh } from "next/cache";
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

export async function saveWordAction(headword: unknown): Promise<ActionResult> {
  return run(async (userId) => {
    await data.saveWord(userId, str(headword, "headword"));
  });
}

/** 收藏並設定這個字屬於哪些單字本（沒勾的會移出） */
export async function saveToWordbooksAction(headword: unknown, wordbookIds: unknown): Promise<ActionResult> {
  return run(async (userId) => {
    if (!Array.isArray(wordbookIds)) throw new data.ValidationError("單字本格式錯誤");
    await data.saveToWordbooks(userId, str(headword, "headword"), wordbookIds.map((id) => uuid(id, "wordbook")));
  });
}

export async function unsaveWordAction(headword: unknown): Promise<ActionResult> {
  return run((userId) => data.unsaveWord(userId, str(headword, "headword")));
}

/** 儲存筆記；這個字還沒收藏時會一併收藏（並建立字卡） */
export async function saveNoteAction(headword: unknown, note: unknown): Promise<ActionResult> {
  return run(async (userId) => {
    await data.saveWord(userId, str(headword, "headword"), note == null ? null : str(note, "筆記"));
  });
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

export async function deleteWordbookAction(wordbookId: unknown): Promise<ActionResult> {
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
}): Promise<ActionResult> {
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);
  return run((userId) =>
    review.updateSettings(userId, {
      newCardsPerDay: num(input.newCardsPerDay),
      desiredRetention: num(input.desiredRetention),
      dayStartsAtHour: num(input.dayStartsAtHour),
    }),
  );
}
