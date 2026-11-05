/**
 * FSRS 複習：排程、今日佇列、評分、復原、統計、設定。
 *
 * - 演算法用 ts-fsrs 的 FSRS-6（明確指定，不用 v6 預設的 FSRS-7）；排程一律在伺服器計算。
 * - 跟 user-data.ts 一樣，第一個參數一律是 userId（由伺服器從 session 取得），每個查詢都以它過濾。
 * - review_logs 只新增；唯一的修改是復原時寫入 undone_at。統計一律排除已復原的紀錄。
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { DefaultScheduler, type DefaultSchedulerCard, type DefaultSchedulerRevlog, type Grade } from "ts-fsrs";
import { db } from "@/db";
import { cards, reviewLogs, userSettings } from "@/db/schema";
import { studyDateKey, studyDayStart } from "./study-day";
import { NotFoundError, ValidationError } from "./user-data";

export type CardRow = typeof cards.$inferSelect;
type ReviewLogRow = typeof reviewLogs.$inferSelect;
type Scheduler = DefaultScheduler<"FSRS-6">;
type SchedulerCard = DefaultSchedulerCard<"FSRS-6">;

/** 卡片狀態（與 ts-fsrs State 相同的數值） */
export const STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export const GRADES = [1, 2, 3, 4] as const satisfies readonly Grade[];

/** 學習中的卡片到期前多久可以提前出現（其他卡都做完時），同 Anki 預設 */
const LEARN_AHEAD_MS = 20 * 60_000;

// ---------------------------------------------------------------- 設定

export type ReviewSettings = {
  desiredRetention: number;
  maximumInterval: number;
  fsrsWeights: number[] | null;
  newCardsPerDay: number;
  dayStartsAtHour: number;
  timezone: string;
};

export const DEFAULT_SETTINGS: ReviewSettings = {
  desiredRetention: 0.9,
  maximumInterval: 36500,
  fsrsWeights: null,
  newCardsPerDay: 20,
  dayStartsAtHour: 4,
  timezone: "Asia/Taipei",
};

export const SETTINGS_LIMITS = {
  newCardsPerDay: { min: 0, max: 500 },
  desiredRetention: { min: 0.7, max: 0.97 },
  dayStartsAtHour: { min: 0, max: 23 },
} as const;

/** 使用者設定；還沒存過時回傳預設值（不寫入資料庫） */
export async function getSettings(userId: string): Promise<ReviewSettings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  if (!row) return DEFAULT_SETTINGS;
  return {
    desiredRetention: row.desiredRetention,
    maximumInterval: row.maximumInterval,
    fsrsWeights: row.fsrsWeights ?? null,
    newCardsPerDay: row.newCardsPerDay,
    dayStartsAtHour: row.dayStartsAtHour,
    timezone: row.timezone,
  };
}

export async function updateSettings(
  userId: string,
  input: { newCardsPerDay: number; desiredRetention: number; dayStartsAtHour: number },
): Promise<void> {
  const check = (value: number, key: keyof typeof SETTINGS_LIMITS, label: string, integer: boolean) => {
    const { min, max } = SETTINGS_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      throw new ValidationError(`${label}需介於 ${min} 到 ${max} 之間`);
    }
  };
  check(input.newCardsPerDay, "newCardsPerDay", "每日新卡數", true);
  check(input.desiredRetention, "desiredRetention", "目標記憶保留率", false);
  check(input.dayStartsAtHour, "dayStartsAtHour", "換日時間", true);

  const values = {
    newCardsPerDay: input.newCardsPerDay,
    desiredRetention: Math.round(input.desiredRetention * 100) / 100,
    dayStartsAtHour: input.dayStartsAtHour,
    updatedAt: new Date(),
  };
  await db
    .insert(userSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: userSettings.userId, set: values });
}

// ---------------------------------------------------------------- 排程器與型別轉換

const schedulers = new Map<string, Promise<Scheduler>>();

/** 依設定建立（並快取）FSRS-6 排程器；fsrsWeights 為 null 時用 ts-fsrs 預設參數 */
function getScheduler(settings: ReviewSettings): Promise<Scheduler> {
  const key = JSON.stringify([settings.fsrsWeights, settings.desiredRetention, settings.maximumInterval]);
  let scheduler = schedulers.get(key);
  if (!scheduler) {
    scheduler = DefaultScheduler({
      version: "FSRS-6",
      weights: settings.fsrsWeights ?? undefined,
      desiredRetention: settings.desiredRetention,
      maximumInterval: settings.maximumInterval,
      enableFuzz: true, // 以 cardId + reps 為種子，同一張卡的結果固定，預覽與實際評分一致
    });
    schedulers.set(key, scheduler);
  }
  return scheduler;
}

function scheduleStatus(state: number) {
  return state === STATE.New ? "new" : state === STATE.Review ? "review" : "learning";
}

function toSchedulerCard(row: CardRow): SchedulerCard {
  return {
    cardId: row.id,
    state: row.state as SchedulerCard["state"],
    scheduleStatus: scheduleStatus(row.state),
    dueAt: row.due,
    lastReviewAt: row.lastReview,
    stability: row.stability,
    difficulty: row.difficulty,
    scheduledDays: row.scheduledDays,
    learningStep: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
  };
}

function fromSchedulerCard(card: SchedulerCard) {
  return {
    due: new Date(card.dueAt),
    lastReview: card.lastReviewAt == null ? null : new Date(card.lastReviewAt),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningStep,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
  };
}

/** 四個評分各自的下次到期時間（翻面時顯示在按鈕上） */
export async function previewCard(row: CardRow, settings: ReviewSettings, now = new Date()) {
  const scheduler = await getScheduler(settings);
  const result = {} as Record<Grade, Date>;
  for (const item of scheduler.preview({ card: toSchedulerCard(row), now })) {
    result[item.grade] = new Date(item.card.dueAt);
  }
  return result;
}

// ---------------------------------------------------------------- 今日佇列

const activeCards = (userId: string) =>
  and(eq(cards.userId, userId), isNull(cards.deletedAt), isNull(cards.suspendedAt));

export type QueueCounts = { learning: number; review: number; new: number };

/**
 * 今日佇列：
 * - 學習中（Learning / Relearning）：due <= 現在
 * - 複習（Review）：due 在今天的學習日結束之前（以「天」為單位，同 Anki）
 * - 新卡：依收藏順序，數量受 newCardsPerDay 限制（扣掉今天已開始學的新卡）
 * 下一張的順序：學習中 → 複習 → 新卡；都沒有時，20 分鐘內到期的學習中卡片可以提前出現。
 */
export async function getQueue(userId: string, settings: ReviewSettings, now = new Date()) {
  const dayStart = studyDayStart(now, settings.timezone, settings.dayStartsAtHour);
  const dayEnd = studyDayStart(now, settings.timezone, settings.dayStartsAtHour, 1);
  const learnAhead = new Date(now.getTime() + LEARN_AHEAD_MS);

  const [counts] = await db
    .select({
      learning: sql<number>`count(*) filter (where ${cards.state} in (1, 3) and ${cards.due} <= ${now})`.mapWith(Number),
      review: sql<number>`count(*) filter (where ${cards.state} = 2 and ${cards.due} < ${dayEnd})`.mapWith(Number),
      newTotal: sql<number>`count(*) filter (where ${cards.state} = 0)`.mapWith(Number),
      laterToday: sql<Date | null>`min(${cards.due}) filter (where ${cards.state} in (1, 3) and ${cards.due} > ${now} and ${cards.due} < ${dayEnd})`,
    })
    .from(cards)
    .where(activeCards(userId));

  const [{ newToday }] = await db
    .select({ newToday: sql<number>`count(distinct ${reviewLogs.cardId})`.mapWith(Number) })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.userId, userId),
        isNull(reviewLogs.undoneAt),
        eq(reviewLogs.state, STATE.New),
        gte(reviewLogs.reviewedAt, dayStart),
      ),
    );
  const newCount = Math.min(counts.newTotal, Math.max(0, settings.newCardsPerDay - newToday));

  const pick = async (where: ReturnType<typeof and>, order = [asc(cards.due)]) =>
    (await db.select().from(cards).where(and(activeCards(userId), where)).orderBy(...order, asc(cards.id)).limit(1))[0];

  const next =
    (await pick(and(inArray(cards.state, [STATE.Learning, STATE.Relearning]), lte(cards.due, now)))) ??
    (await pick(and(eq(cards.state, STATE.Review), sql`${cards.due} < ${dayEnd}`))) ??
    (newCount > 0 ? await pick(eq(cards.state, STATE.New), [asc(cards.createdAt)]) : undefined) ??
    (await pick(and(inArray(cards.state, [STATE.Learning, STATE.Relearning]), lte(cards.due, learnAhead))));

  return {
    next: next ?? null,
    counts: { learning: counts.learning, review: counts.review, new: newCount } satisfies QueueCounts,
    /** 佇列做完後，今天稍晚還會到期的第一張學習中卡片 */
    nextLearningDue: counts.laterToday ? new Date(counts.laterToday) : null,
  };
}

/** 取得自己的一張字卡（復原後重新顯示用） */
export async function getCard(userId: string, cardId: string): Promise<CardRow> {
  const [row] = await db
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)));
  if (!row) throw new NotFoundError("card");
  return row;
}

// ---------------------------------------------------------------- 評分與復原

export type ReviewInput = { logId: string; cardId: string; rating: number; durationMs?: number | null };

/**
 * 評分一張卡：更新 cards，並新增一筆 review_log（id 由用戶端產生）。
 * 同一個 logId 重送時（ON CONFLICT DO NOTHING 沒寫入）不會重複套用評分。
 */
export async function reviewCard(userId: string, input: ReviewInput, now = new Date()) {
  const rating = input.rating as Grade;
  if (!GRADES.includes(rating)) throw new ValidationError("評分格式錯誤");
  const durationMs =
    typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? Math.min(Math.max(0, Math.round(input.durationMs)), 3_600_000)
      : null;
  const settings = await getSettings(userId);
  const scheduler = await getScheduler(settings);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(cards)
      .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId), isNull(cards.deletedAt)))
      .for("update");
    if (!row) throw new NotFoundError("card");

    const inserted = await tx
      .insert(reviewLogs)
      .values({
        id: input.logId,
        userId,
        cardId: row.id,
        rating,
        // 評分之前的卡片狀態
        state: row.state,
        due: row.due,
        stability: row.stability,
        difficulty: row.difficulty,
        scheduledDays: row.scheduledDays,
        learningSteps: row.learningSteps,
        lastReview: row.lastReview,
        reviewedAt: now,
        durationMs,
      })
      .onConflictDoNothing()
      .returning({ id: reviewLogs.id });
    if (inserted.length === 0) return { duplicate: true as const, card: row };

    const { card } = scheduler.review({ card: toSchedulerCard(row), grade: rating, now });
    const [updated] = await tx
      .update(cards)
      .set({ ...fromSchedulerCard(card), updatedAt: now })
      .where(eq(cards.id, row.id))
      .returning();
    return { duplicate: false as const, card: updated };
  });
}

/**
 * 復原今天最後一次評分：用該筆 review log 把卡片還原成評分前的狀態，並在 log 寫入 undone_at。
 * 可以連續復原，但只限今天（目前學習日）的評分。回傳被還原的卡片。
 */
export async function undoLastReview(userId: string, now = new Date()): Promise<CardRow> {
  const settings = await getSettings(userId);
  const scheduler = await getScheduler(settings);
  const dayStart = studyDayStart(now, settings.timezone, settings.dayStartsAtHour);

  return db.transaction(async (tx) => {
    const [log] = await tx
      .select()
      .from(reviewLogs)
      .where(and(eq(reviewLogs.userId, userId), isNull(reviewLogs.undoneAt), gte(reviewLogs.reviewedAt, dayStart)))
      .orderBy(desc(reviewLogs.reviewedAt), desc(reviewLogs.createdAt))
      .limit(1)
      .for("update");
    if (!log) throw new NotFoundError("review");

    const [row] = await tx
      .select()
      .from(cards)
      .where(and(eq(cards.id, log.cardId), eq(cards.userId, userId)))
      .for("update");
    if (!row) throw new NotFoundError("card");

    const restored = scheduler.rollback({ card: toSchedulerCard(row), revlog: toSchedulerRevlog(log) });
    const [updated] = await tx
      .update(cards)
      .set({ ...fromSchedulerCard(restored), updatedAt: now })
      .where(eq(cards.id, row.id))
      .returning();
    await tx.update(reviewLogs).set({ undoneAt: now }).where(eq(reviewLogs.id, log.id));
    return updated;
  });
}

function toSchedulerRevlog(log: ReviewLogRow): DefaultSchedulerRevlog<"FSRS-6"> {
  return {
    cardId: log.cardId,
    rating: log.rating as Grade,
    state: log.state as SchedulerCard["state"],
    scheduleStatus: scheduleStatus(log.state),
    dueAt: log.due,
    lastReviewAt: log.lastReview,
    reviewTime: log.reviewedAt,
    stability: log.stability,
    difficulty: log.difficulty,
    scheduledDays: log.scheduledDays,
    learningStep: log.learningSteps,
  };
}

// ---------------------------------------------------------------- 統計

export type ReviewStats = {
  reviewedToday: number;
  /** 連續有複習的天數（今天還沒複習時，算到昨天為止） */
  streak: number;
  studiedToday: boolean;
  /** 未來 7 天（含今天，今天包含已逾期）每天到期的卡片數 */
  forecast: { date: string; count: number }[];
};

export async function getReviewStats(userId: string, settings: ReviewSettings, now = new Date()): Promise<ReviewStats> {
  const { timezone, dayStartsAtHour } = settings;
  const dayStart = studyDayStart(now, timezone, dayStartsAtHour);
  const bounds = Array.from({ length: 8 }, (_, i) => studyDayStart(now, timezone, dayStartsAtHour, i));

  const studyDayExpr = sql<string>`to_char((${reviewLogs.reviewedAt} at time zone ${timezone}) - make_interval(hours => ${dayStartsAtHour}), 'YYYY-MM-DD')`;
  const notUndone = and(eq(reviewLogs.userId, userId), isNull(reviewLogs.undoneAt));

  const [[{ reviewedToday }], days, [forecastRow]] = await Promise.all([
    db
      .select({ reviewedToday: sql<number>`count(*)`.mapWith(Number) })
      .from(reviewLogs)
      .where(and(notUndone, gte(reviewLogs.reviewedAt, dayStart))),
    db
      .selectDistinct({ day: studyDayExpr })
      .from(reviewLogs)
      .where(notUndone)
      // 用欄位序號排序：Drizzle 在 select 與 order by 輸出的欄位名稱不一致（有無表名），DISTINCT 會判定不同
      .orderBy(sql`1 desc`)
      .limit(3660),
    db
      .select(
        Object.fromEntries(
          bounds.slice(1).map((end, i) => [
            `d${i}`,
            i === 0
              ? sql<number>`count(*) filter (where ${cards.due} < ${end})`.mapWith(Number)
              : sql<number>`count(*) filter (where ${cards.due} >= ${bounds[i]} and ${cards.due} < ${end})`.mapWith(Number),
          ]),
        ),
      )
      .from(cards)
      .where(and(activeCards(userId), ne(cards.state, STATE.New))),
  ]);

  const dayKeys = new Set(days.map((d) => d.day));
  const keyOf = (offset: number) => studyDateKey(new Date(dayStart.getTime() + (offset + 0.5) * 86_400_000), timezone, dayStartsAtHour);
  const studiedToday = dayKeys.has(keyOf(0));
  let streak = 0;
  for (let offset = studiedToday ? 0 : -1; dayKeys.has(keyOf(offset)); offset--) streak++;

  return {
    reviewedToday,
    streak,
    studiedToday,
    forecast: bounds.slice(0, 7).map((start, i) => ({
      date: studyDateKey(new Date(start.getTime() + 43_200_000), timezone, dayStartsAtHour),
      count: (forecastRow as Record<string, number>)[`d${i}`] ?? 0,
    })),
  };
}
