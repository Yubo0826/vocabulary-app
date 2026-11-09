/**
 * 使用者資料（需同步）
 *
 * 原則：
 * - 每張表都帶 userId，並對 user 設 onDelete: cascade → 刪帳號時資料一併清除。
 * - 主鍵用 UUID，且允許「由用戶端產生」：離線時先在 IndexedDB 建立，
 *   上線後原樣送到伺服器，不會撞號，重送也能靠主鍵做到冪等。
 * - 可修改的資料帶 updatedAt + deletedAt（軟刪除墓碑），同步時用
 *   「updatedAt > 上次同步時間」拉增量，刪除也能被同步到其他裝置。
 * - 複習紀錄 reviewLogs 只新增不修改（append-only），同步不會衝突，
 *   也是日後最佳化 FSRS 個人參數的原始資料。
 * - 與字典的關聯只存 headword 文字，不建外鍵（理由見 dictionary.ts）。
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  smallint,
  doublePrecision,
  real,
  jsonb,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/** 同步用的共用欄位 */
const syncColumns = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  deletedAt: ts("deleted_at"),
};

const userIdColumn = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/** 收藏：使用者收藏過的字，一人一字一筆 */
export const savedWords = pgTable(
  "saved_words",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userIdColumn(),
    headword: text("headword").notNull(),
    note: text("note"), // 個人筆記
    // 從哪裡收藏的：'search' | 'extension' | 'import'（純文字清單匯入）；擴充功能可另存出處網址與原句
    origin: text("origin"),
    contextUrl: text("context_url"),
    contextSentence: text("context_sentence"),
    ...syncColumns,
  },
  (t) => [
    uniqueIndex("saved_words_user_headword_idx").on(t.userId, t.headword),
    index("saved_words_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

/** 單字本 */
export const wordbooks = pgTable(
  "wordbooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userIdColumn(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...syncColumns,
  },
  (t) => [index("wordbooks_user_updated_idx").on(t.userId, t.updatedAt)],
);

/** 單字本 ↔ 收藏（多對多：同一個字可放進多本） */
export const wordbookItems = pgTable(
  "wordbook_items",
  {
    wordbookId: uuid("wordbook_id")
      .notNull()
      .references(() => wordbooks.id, { onDelete: "cascade" }),
    savedWordId: uuid("saved_word_id")
      .notNull()
      .references(() => savedWords.id, { onDelete: "cascade" }),
    userId: userIdColumn(), // 冗餘存一份，同步查詢與權限檢查較簡單
    ...syncColumns,
  },
  (t) => [
    primaryKey({ columns: [t.wordbookId, t.savedWordId] }),
    index("wordbook_items_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

/**
 * 字卡（FSRS 卡片狀態）
 * 欄位對應 ts-fsrs 的 Card 型別；state 與 rating 存整數，對應 ts-fsrs 的 enum：
 *   State:  0 New, 1 Learning, 2 Review, 3 Relearning
 *   Rating: 1 Again, 2 Hard, 3 Good, 4 Easy
 * direction 讓同一個字可以有「英→中」「中→英」兩張卡，之後想加拼字卡也只是多一種值。
 */
export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userIdColumn(),
    headword: text("headword").notNull(),
    direction: text("direction", { enum: ["en_zh", "zh_en", "spelling"] })
      .notNull()
      .default("en_zh"),

    // --- ts-fsrs Card ---
    due: ts("due").notNull(),
    stability: doublePrecision("stability").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: smallint("state").notNull().default(0),
    lastReview: ts("last_review"),

    suspendedAt: ts("suspended_at"), // 暫停複習（不刪卡、保留歷史）
    ...syncColumns,
  },
  (t) => [
    uniqueIndex("cards_user_headword_dir_idx").on(t.userId, t.headword, t.direction),
    // 「今天要複習哪些卡」的主要查詢
    index("cards_user_due_idx").on(t.userId, t.due),
    index("cards_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

/**
 * 複習紀錄（append-only）
 * 欄位對應 ts-fsrs 的 ReviewLog；記錄的是「這次複習之前」的卡片狀態與評分。
 * id 由用戶端產生，伺服器用 ON CONFLICT DO NOTHING 寫入，離線重送也不會重複。
 * 唯一的例外是「復原上一張」：只寫入一次 undone_at，紀錄本身保留；
 * 統計與日後最佳化參數時要排除 undone_at 不為 null 的紀錄。
 */
export const reviewLogs = pgTable(
  "review_logs",
  {
    id: uuid("id").primaryKey(),
    userId: userIdColumn(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    state: smallint("state").notNull(),
    due: ts("due").notNull(),
    stability: doublePrecision("stability").notNull(),
    difficulty: doublePrecision("difficulty").notNull(),
    scheduledDays: integer("scheduled_days").notNull(),
    learningSteps: integer("learning_steps").notNull().default(0),
    lastReview: ts("last_review"), // 這次複習之前卡片的 last_review，復原時還原用
    reviewedAt: ts("reviewed_at").notNull(), // 用戶端的實際作答時間，不是寫入時間
    durationMs: integer("duration_ms"), // 作答花費時間，可做統計
    createdAt: ts("created_at").notNull().defaultNow(), // 伺服器收到的時間
    undoneAt: ts("undone_at"), // 被「復原上一張」撤銷的時間
  },
  (t) => [
    index("review_logs_card_idx").on(t.cardId, t.reviewedAt),
    index("review_logs_user_reviewed_idx").on(t.userId, t.reviewedAt),
    index("review_logs_user_created_idx").on(t.userId, t.createdAt),
  ],
);

/** 使用者設定（含 FSRS 參數），一人一筆 */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  desiredRetention: real("desired_retention").notNull().default(0.9),
  maximumInterval: integer("maximum_interval").notNull().default(36500),
  fsrsWeights: jsonb("fsrs_weights").$type<number[]>(), // null = 使用 ts-fsrs 預設參數
  newCardsPerDay: integer("new_cards_per_day").notNull().default(20),
  dayStartsAtHour: smallint("day_starts_at_hour").notNull().default(4), // 凌晨 4 點換日
  timezone: text("timezone").notNull().default("Asia/Taipei"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
