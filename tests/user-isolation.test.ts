/**
 * 階段 3 驗收：兩個帳號的資料完全隔離；刪除帳號後其資料全部 cascade 刪除。
 * 執行：npm test（使用 TEST_DATABASE_URL，會清空該資料庫）
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setupTestDatabase } from "./setup";

type Data = typeof import("../src/lib/user-data");
type Db = typeof import("../src/db");
type Schema = typeof import("../src/db/schema");
type Auth = typeof import("../src/lib/auth");

let data: Data;
let db: Db["db"];
let schema: Schema;
let auth: Auth["auth"];
let close: () => Promise<void>;

const A = { email: "a@example.com", password: "password-a-123", name: "A" };
const B = { email: "b@example.com", password: "password-b-123", name: "B" };
let userA: string;
let userB: string;
let cookieA: string;

/** 透過 Better Auth 註冊，回傳 user id 與 session cookie */
async function signUp(u: typeof A) {
  const { headers, response } = await auth.api.signUpEmail({ body: u, returnHeaders: true });
  const cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { id: response.user.id, cookie };
}

before(async () => {
  await setupTestDatabase();
  data = await import("../src/lib/user-data");
  schema = await import("../src/db/schema");
  ({ db } = await import("../src/db"));
  ({ auth } = await import("../src/lib/auth"));
  close = async () => {
    const pool = (db as unknown as { $client: { end: () => Promise<void> } }).$client;
    await pool.end();
  };

  // 最小的字典資料
  await db.insert(schema.entries).values(
    ["apple", "banana", "cherry"].map((headword) => ({ headword, display: headword, source: "test" })),
  );

  const a = await signUp(A);
  const b = await signUp(B);
  userA = a.id;
  userB = b.id;
  cookieA = a.cookie;
});

after(async () => {
  await close();
});

const isNotFound = (err: unknown) => err instanceof data.NotFoundError;

describe("資料隔離", () => {
  test("各自的收藏只看得到自己的", async () => {
    await data.saveWord(userA, "apple", "A 的筆記");
    await data.saveWord(userB, "banana", "B 的筆記");
    await data.saveWord(userB, "apple");

    const listA = await data.listSavedWords(userA);
    const listB = await data.listSavedWords(userB);
    assert.deepEqual(listA.map((w) => w.headword), ["apple"]);
    assert.deepEqual(listB.map((w) => w.headword).sort(), ["apple", "banana"]);
    // 兩人都收藏 apple，但筆記互不影響
    assert.equal(listA[0].note, "A 的筆記");
    assert.equal(listB.find((w) => w.headword === "apple")?.note, null);
  });

  test("A 無法讀取 B 的收藏狀態與筆記", async () => {
    const state = await data.getSaveState(userA, "banana");
    assert.equal(state.saved, null);
  });

  test("A 無法取消 B 的收藏、無法改 B 的筆記", async () => {
    await assert.rejects(data.unsaveWord(userA, "banana"), isNotFound);
    await assert.rejects(data.updateNote(userA, "banana", "竄改"), isNotFound);
    const stateB = await data.getSaveState(userB, "banana");
    assert.equal(stateB.saved?.note, "B 的筆記");
  });

  test("A 修改自己的 apple 不影響 B 的 apple", async () => {
    await data.updateNote(userA, "apple", "改過");
    await data.unsaveWord(userA, "apple");
    const stateB = await data.getSaveState(userB, "apple");
    assert.ok(stateB.saved, "B 的 apple 仍在");
    assert.equal(stateB.saved.note, null);
    await data.saveWord(userA, "apple"); // 恢復，供後續測試使用
  });

  test("A 看不到也動不了 B 的單字本", async () => {
    const bookB = await data.createWordbook(userB, { name: "B 的單字本" });
    await data.setWordbookMembership(userB, bookB.id, "banana", true);

    assert.equal((await data.listWordbooks(userA)).length, 0);
    assert.equal(await data.getWordbook(userA, bookB.id), null);
    // 用 B 的單字本篩選，A 只會得到空結果
    assert.deepEqual(await data.listSavedWords(userA, { wordbookId: bookB.id }), []);

    await assert.rejects(data.updateWordbook(userA, bookB.id, { name: "被改名" }), isNotFound);
    await assert.rejects(data.deleteWordbook(userA, bookB.id), isNotFound);
    // A 不能把自己的字放進 B 的單字本，也不能把 B 的字移出
    await assert.rejects(data.setWordbookMembership(userA, bookB.id, "apple", true), isNotFound);
    await assert.rejects(data.setWordbookMembership(userA, bookB.id, "banana", false), isNotFound);

    const booksB = await data.listWordbooks(userB);
    assert.equal(booksB[0].name, "B 的單字本");
    assert.equal(booksB[0].count, 1);
  });

  test("B 不能把 A 的收藏放進自己的單字本", async () => {
    const [bookB] = await data.listWordbooks(userB);
    await assert.rejects(data.setWordbookMembership(userB, bookB.id, "cherry", true), isNotFound);
    await data.saveWord(userA, "cherry");
    // A 收藏了 cherry，B 仍然不能把它放進自己的單字本（B 沒有收藏 cherry）
    await assert.rejects(data.setWordbookMembership(userB, bookB.id, "cherry", true), isNotFound);
  });
});

describe("收藏與字卡", () => {
  test("收藏時自動建立一張 en_zh 新卡", async () => {
    const before = Date.now();
    await data.saveWord(userB, "cherry");
    const { cards } = schema;
    const { and, eq } = await import("drizzle-orm");
    const [card] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.userId, userB), eq(cards.headword, "cherry")));
    assert.equal(card.direction, "en_zh");
    assert.equal(card.state, 0);
    assert.ok(Math.abs(card.due.getTime() - before) < 60_000, "due = 現在");
  });

  test("取消收藏為軟刪除，重新收藏清除 deleted_at 並恢復原字卡", async () => {
    const { cards, savedWords } = schema;
    const { and, eq } = await import("drizzle-orm");
    const where = (t: typeof cards | typeof savedWords) => and(eq(t.userId, userB), eq(t.headword, "cherry"));

    const [cardBefore] = await db.select().from(cards).where(where(cards));
    await data.unsaveWord(userB, "cherry");
    const [savedRow] = await db.select().from(savedWords).where(where(savedWords));
    assert.ok(savedRow.deletedAt, "收藏仍在資料表中，只是標記刪除");
    assert.equal((await data.listSavedWords(userB)).some((w) => w.headword === "cherry"), false);

    await data.saveWord(userB, "cherry");
    const [savedAgain] = await db.select().from(savedWords).where(where(savedWords));
    const [cardAfter] = await db.select().from(cards).where(where(cards));
    assert.equal(savedAgain.id, savedRow.id, "沿用同一筆收藏");
    assert.equal(savedAgain.deletedAt, null);
    assert.equal(cardAfter.id, cardBefore.id, "沿用同一張字卡");
    assert.equal(cardAfter.deletedAt, null);
  });

  test("收藏列表的中文釋義對應到正確的字", async () => {
    await db.insert(schema.definitions).values([
      { headword: "apple", lang: "zh-TW", pos: "n.", text: "蘋果", source: "test" },
      { headword: "banana", lang: "zh-TW", pos: "n.", text: "香蕉", source: "test", sortOrder: 0 },
      { headword: "banana", lang: "zh-TW", pos: null, text: "第二筆", source: "test", sortOrder: 1 },
    ]);
    const list = await data.listSavedWords(userB, { sort: "alpha" });
    assert.deepEqual(
      list.map((w) => [w.headword, w.gloss]),
      [
        ["apple", "n. 蘋果"],
        ["banana", "n. 香蕉"],
        ["cherry", null],
      ],
    );
  });

  test("saveToWordbooks：未收藏時一併收藏，並剛好放進勾選的單字本", async () => {
    const b1 = await data.createWordbook(userA, { name: "本一" });
    const b2 = await data.createWordbook(userA, { name: "本二" });
    const books = async () =>
      (await data.getSaveState(userA, "cherry")).wordbooks.filter((b) => b.contains).map((b) => b.name);

    await data.saveToWordbooks(userA, "cherry", [b1.id]);
    assert.ok((await data.getSaveState(userA, "cherry")).saved, "已收藏");
    assert.deepEqual(await books(), ["本一"], "只進勾選的那本");

    await data.saveToWordbooks(userA, "cherry", [b2.id]);
    assert.deepEqual(await books(), ["本二"], "沒勾的移出");

    await data.saveToWordbooks(userA, "cherry", []);
    assert.deepEqual(await books(), [], "可以都不勾");
    assert.ok((await data.getSaveState(userA, "cherry")).saved, "都不勾仍是收藏");
  });

  test("saveToWordbooks 不能放進別人的單字本", async () => {
    const bBook = await data.createWordbook(userB, { name: "B 的本" });
    await assert.rejects(data.saveToWordbooks(userA, "apple", [bBook.id]), isNotFound);
  });

  test("不存在於字典的字不能收藏", async () => {
    await assert.rejects(data.saveWord(userA, "notaword"), isNotFound);
  });
});

describe("刪除帳號", () => {
  test("透過 Better Auth 刪除 A 後，A 的所有資料被 cascade 刪除，B 不受影響", async () => {
    const s = schema;
    const { eq, count } = await import("drizzle-orm");

    // 讓 A 在每張使用者資料表都有資料
    const bookA = await data.createWordbook(userA, { name: "A 的單字本" });
    await data.setWordbookMembership(userA, bookA.id, "apple", true);
    const [cardA] = await db.select({ id: s.cards.id }).from(s.cards).where(eq(s.cards.userId, userA)).limit(1);
    await db.insert(s.reviewLogs).values({
      id: crypto.randomUUID(),
      userId: userA,
      cardId: cardA.id,
      rating: 3,
      state: 0,
      due: new Date(),
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      reviewedAt: new Date(),
    });
    await db.insert(s.userSettings).values({ userId: userA });

    const tables = {
      saved_words: s.savedWords,
      wordbooks: s.wordbooks,
      wordbook_items: s.wordbookItems,
      cards: s.cards,
      review_logs: s.reviewLogs,
      user_settings: s.userSettings,
      session: s.session,
      account: s.account,
    };
    const countFor = async (userId: string) => {
      const result: Record<string, number> = {};
      for (const [name, table] of Object.entries(tables)) {
        const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
        result[name] = row.n;
      }
      return result;
    };

    const beforeA = await countFor(userA);
    for (const [name, n] of Object.entries(beforeA)) assert.ok(n > 0, `刪除前 A 在 ${name} 應有資料`);
    const beforeB = await countFor(userB);

    await auth.api.deleteUser({ body: { password: A.password }, headers: new Headers({ cookie: cookieA }) });

    const [userRow] = await db.select({ n: count() }).from(s.user).where(eq(s.user.id, userA));
    assert.equal(userRow.n, 0, "user 已刪除");
    for (const [name, n] of Object.entries(await countFor(userA))) assert.equal(n, 0, `${name} 應已清空`);
    assert.deepEqual(await countFor(userB), beforeB, "B 的資料不受影響");
  });
});
