/**
 * 階段 4 驗收：連續評 Good 間隔遞增；評 Again 進入 Relearning；重送同一筆 review log 不會重複寫入。
 * 另外驗證復原、每日新卡上限、資料隔離與換日界線。
 * 執行：npm test（使用 TEST_DATABASE_URL，會清空該資料庫）
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import { setupTestDatabase } from "./setup";

type Review = typeof import("../src/lib/review");
type Data = typeof import("../src/lib/user-data");
type Schema = typeof import("../src/db/schema");
type Db = typeof import("../src/db");
type StudyDay = typeof import("../src/lib/study-day");

let review: Review;
let data: Data;
let schema: Schema;
let db: Db["db"];
let studyDay: StudyDay;
let eq: typeof import("drizzle-orm").eq;

const userA = "user-a";
const userB = "user-b";
const DAY = 86_400_000;

before(async () => {
  await setupTestDatabase();
  review = await import("../src/lib/review");
  data = await import("../src/lib/user-data");
  schema = await import("../src/db/schema");
  studyDay = await import("../src/lib/study-day");
  ({ db } = await import("../src/db"));
  ({ eq } = await import("drizzle-orm"));

  await db.insert(schema.entries).values(
    ["apple", "banana", "cherry"].map((headword) => ({ headword, display: headword, source: "test" })),
  );
  await db.insert(schema.user).values(
    [userA, userB].map((id) => ({ id, name: id, email: `${id}@example.com`, emailVerified: false })),
  );
});

beforeEach(async () => {
  await db.delete(schema.reviewLogs);
  await db.delete(schema.cards);
  await db.delete(schema.savedWords);
  await db.delete(schema.userSettings);
});

after(async () => {
  await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
});

async function cardOf(userId: string, headword: string) {
  await data.saveWord(userId, headword);
  const [card] = await db
    .select()
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId));
  assert.ok(card);
  assert.equal(card.headword, headword);
  return card;
}

const rate = (userId: string, cardId: string, rating: number, now: Date, logId: string = randomUUID()) =>
  review.reviewCard(userId, { logId, cardId, rating }, now);

describe("FSRS 排程", () => {
  test("同一張卡連續評 Good，間隔遞增", async () => {
    const card = await cardOf(userA, "apple");
    let now = new Date("2026-11-05T02:00:00Z");
    const intervals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const { card: next } = await rate(userA, card.id, 3, now);
      intervals.push(next.due.getTime() - now.getTime());
      now = next.due;
    }
    // 新卡先走學習步驟（10 分鐘），畢業後每次都比上次長
    assert.equal(intervals[0], 10 * 60_000);
    for (let i = 1; i < intervals.length; i++) {
      assert.ok(intervals[i] > intervals[i - 1], `第 ${i + 1} 次間隔 ${intervals[i]} 應大於 ${intervals[i - 1]}`);
    }
    assert.ok(intervals.at(-1)! > 100 * DAY);
  });

  test("Review 狀態評 Again 後進入 Relearning", async () => {
    const card = await cardOf(userA, "apple");
    let now = new Date("2026-11-05T02:00:00Z");
    let current = card;
    while (current.state !== review.STATE.Review) {
      current = (await rate(userA, card.id, 3, now)).card;
      now = current.due;
    }
    const { card: lapsed } = await rate(userA, card.id, 1, now);
    assert.equal(lapsed.state, review.STATE.Relearning);
    assert.equal(lapsed.lapses, 1);
    assert.equal(lapsed.due.getTime() - now.getTime(), 10 * 60_000); // 重新學習步驟 10 分鐘
  });

  test("重送同一筆 review log 不會重複寫入、也不會重複評分", async () => {
    const card = await cardOf(userA, "apple");
    const now = new Date("2026-11-05T02:00:00Z");
    const logId = randomUUID();
    const first = await rate(userA, card.id, 3, now, logId);
    const second = await rate(userA, card.id, 3, new Date(now.getTime() + 60_000), logId);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);

    const logs = await db.select().from(schema.reviewLogs).where(eq(schema.reviewLogs.cardId, card.id));
    assert.equal(logs.length, 1);
    const [stored] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id));
    assert.equal(stored.reps, 1);
    assert.deepEqual(stored.due, first.card.due);
  });

  test("評分格式錯誤會被拒絕", async () => {
    const card = await cardOf(userA, "apple");
    for (const rating of [0, 5, 2.5, NaN]) {
      await assert.rejects(rate(userA, card.id, rating, new Date()), data.ValidationError);
    }
  });
});

describe("復原上一張", () => {
  test("還原成評分前的卡片狀態，log 標記 undone_at 並保留", async () => {
    const card = await cardOf(userA, "apple");
    const now = new Date();
    const afterGood = (await rate(userA, card.id, 3, now)).card;
    const afterGood2 = (await rate(userA, card.id, 3, new Date(now.getTime() + 11 * 60_000))).card;
    assert.equal(afterGood2.state, review.STATE.Review);

    const restored = await review.undoLastReview(userA, new Date(now.getTime() + 12 * 60_000));
    for (const key of ["state", "due", "stability", "difficulty", "scheduledDays", "learningSteps", "reps", "lapses", "lastReview"] as const) {
      assert.deepEqual(restored[key], afterGood[key], key);
    }

    const restored2 = await review.undoLastReview(userA, new Date(now.getTime() + 13 * 60_000));
    for (const key of ["state", "due", "stability", "difficulty", "scheduledDays", "learningSteps", "reps", "lapses", "lastReview"] as const) {
      assert.deepEqual(restored2[key], card[key], key);
    }

    const logs = await db.select().from(schema.reviewLogs).where(eq(schema.reviewLogs.cardId, card.id));
    assert.equal(logs.length, 2);
    assert.ok(logs.every((l) => l.undoneAt));
    await assert.rejects(review.undoLastReview(userA), data.NotFoundError);
  });

  test("已復原的新卡不計入今日新卡數", async () => {
    await cardOf(userA, "apple");
    await review.updateSettings(userA, { newCardsPerDay: 1, desiredRetention: 0.9, dayStartsAtHour: 4 });
    const settings = await review.getSettings(userA);
    const now = new Date();
    const q1 = await review.getQueue(userA, settings, now);
    assert.equal(q1.counts.new, 1);
    await rate(userA, q1.next!.id, 3, now);
    assert.equal((await review.getQueue(userA, settings, now)).counts.new, 0);
    await review.undoLastReview(userA, now);
    assert.equal((await review.getQueue(userA, settings, now)).counts.new, 1);
  });
});

describe("今日佇列", () => {
  test("新卡受 newCardsPerDay 限制，依收藏順序出現", async () => {
    await cardOf(userA, "apple");
    await data.saveWord(userA, "banana");
    await data.saveWord(userA, "cherry");
    await review.updateSettings(userA, { newCardsPerDay: 2, desiredRetention: 0.9, dayStartsAtHour: 4 });
    const settings = await review.getSettings(userA);
    const now = new Date();

    const q1 = await review.getQueue(userA, settings, now);
    assert.equal(q1.counts.new, 2);
    assert.equal(q1.next?.headword, "apple");
    await rate(userA, q1.next!.id, 4, now); // Easy：直接進入 Review，明天以後才到期

    const q2 = await review.getQueue(userA, settings, now);
    assert.equal(q2.counts.new, 1);
    assert.equal(q2.next?.headword, "banana");
    await rate(userA, q2.next!.id, 4, now);

    const q3 = await review.getQueue(userA, settings, now);
    assert.equal(q3.counts.new, 0);
    assert.equal(q3.next, null);
  });

  test("學習中的卡片到期才出現；20 分鐘內到期的可在佇列空了之後提前出現", async () => {
    const card = await cardOf(userA, "apple");
    const settings = await review.getSettings(userA);
    const now = new Date();
    await rate(userA, card.id, 1, now); // Again：1 分鐘後
    const q = await review.getQueue(userA, { ...settings, newCardsPerDay: 0 }, now);
    assert.equal(q.counts.learning, 0);
    assert.equal(q.next?.id, card.id); // 提前出現
  });

  test("取消收藏的字卡不會出現在佇列", async () => {
    await cardOf(userA, "apple");
    await data.unsaveWord(userA, "apple");
    const q = await review.getQueue(userA, await review.getSettings(userA));
    assert.equal(q.next, null);
    assert.equal(q.counts.new, 0);
  });
});

describe("資料隔離", () => {
  test("無法評分或復原別人的字卡", async () => {
    const cardA = await cardOf(userA, "apple");
    await assert.rejects(rate(userB, cardA.id, 3, new Date()), data.NotFoundError);
    await rate(userA, cardA.id, 3, new Date());
    await assert.rejects(review.undoLastReview(userB), data.NotFoundError);
    await assert.rejects(review.getCard(userB, cardA.id), data.NotFoundError);
    const qB = await review.getQueue(userB, await review.getSettings(userB));
    assert.equal(qB.next, null);
  });

  test("用別人的 logId 重送不會影響對方的紀錄", async () => {
    const cardA = await cardOf(userA, "apple");
    const logId = randomUUID();
    await rate(userA, cardA.id, 3, new Date(), logId);
    const cardB = await cardOf(userB, "apple");
    const res = await rate(userB, cardB.id, 3, new Date(), logId);
    assert.equal(res.duplicate, true);
    const [log] = await db.select().from(schema.reviewLogs).where(eq(schema.reviewLogs.id, logId));
    assert.equal(log.userId, userA);
  });
});

describe("統計與換日", () => {
  test("學習日界線依時區與換日時間計算", () => {
    // 台灣 11/6 03:00（UTC 11/5 19:00），凌晨 4 點換日 → 仍是 11/5，開始於台灣 11/5 04:00 = UTC 11/4 20:00
    const now = new Date("2026-11-05T19:00:00Z");
    assert.equal(studyDay.studyDateKey(now, "Asia/Taipei", 4), "2026-11-05");
    assert.equal(studyDay.studyDayStart(now, "Asia/Taipei", 4).toISOString(), "2026-11-04T20:00:00.000Z");
    assert.equal(studyDay.studyDayStart(now, "Asia/Taipei", 4, 1).toISOString(), "2026-11-05T20:00:00.000Z");
    // 台灣 11/6 05:00 → 11/6
    assert.equal(studyDay.studyDateKey(new Date("2026-11-05T21:00:00Z"), "Asia/Taipei", 4), "2026-11-06");
    // 夏令時間：紐約 2026-03-08 換日（凌晨 4 點時已是 EDT，UTC-4）
    assert.equal(studyDay.studyDayStart(new Date("2026-03-08T12:00:00Z"), "America/New_York", 4).toISOString(), "2026-03-08T08:00:00.000Z");
  });

  test("今日複習數、連續天數、未來 7 天到期數", async () => {
    const card = await cardOf(userA, "apple");
    const settings = await review.getSettings(userA);
    const now = new Date();
    // 前天、昨天、今天各複習一次（直接寫 log，模擬過去的紀錄）
    for (const daysAgo of [2, 1]) {
      await db.insert(schema.reviewLogs).values({
        id: randomUUID(),
        userId: userA,
        cardId: card.id,
        rating: 3,
        state: 0,
        due: now,
        stability: 0,
        difficulty: 0,
        scheduledDays: 0,
        reviewedAt: new Date(now.getTime() - daysAgo * DAY),
      });
    }
    let stats = await review.getReviewStats(userA, settings, now);
    assert.equal(stats.studiedToday, false);
    assert.equal(stats.streak, 2);
    assert.equal(stats.reviewedToday, 0);

    await rate(userA, card.id, 3, now); // Good → 10 分鐘後到期，算在今天
    stats = await review.getReviewStats(userA, settings, now);
    assert.equal(stats.studiedToday, true);
    assert.equal(stats.streak, 3);
    assert.equal(stats.reviewedToday, 1);
    assert.equal(stats.forecast.length, 7);
    assert.equal(stats.forecast.reduce((n, d) => n + d.count, 0), 1);
    assert.equal(stats.forecast[0].date, studyDay.studyDateKey(now, settings.timezone, settings.dayStartsAtHour));
  });
});
