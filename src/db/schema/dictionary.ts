/**
 * 字典資料（唯讀）
 *
 * 原則：
 * - 以「詞頭 headword」作為對外的穩定鍵。使用者資料只存 headword 文字，
 *   不對字典表建立外鍵，這樣整批替換字典來源時，使用者的收藏與字卡不會失效。
 * - 每筆內容都帶 source（來源）與 sourceRef（來源內的原始 ID），方便標示出處與日後替換。
 * - 匯入腳本採「清空後重灌」，因此這些表的自動遞增 ID 只在字典內部使用。
 *
 * headword 一律存小寫正規化後的形式（片語保留空格），顯示用的大小寫放 display。
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  smallint,
  boolean,
  serial,
  primaryKey,
  index,
  uniqueIndex,
  check,
  timestamp,
} from "drizzle-orm/pg-core";

/** 詞條：每個 headword 一筆 */
export const entries = pgTable(
  "dict_entries",
  {
    headword: text("headword").primaryKey(),
    display: text("display").notNull(), // 原始大小寫，例如 "iPhone"、"Paris"
    phonetic: text("phonetic"), // IPA（ECDICT 的 phonetic 欄位）
    frequencyRank: integer("frequency_rank"), // 越小越常用，用來排序搜尋結果與篩常用字
    tags: text("tags").array(), // 例如 ['toefl', 'ielts', 'cet4']（ECDICT tag 欄位）
    source: text("source").notNull(), // 'ecdict'
    sourceRef: text("source_ref"),
  },
  (t) => [
    // 模糊搜尋（拼錯字）：需先 CREATE EXTENSION pg_trgm，見 drizzle/0000_enable_pg_trgm.sql
    index("dict_entries_headword_trgm_idx").using("gin", t.headword.op("gin_trgm_ops")),
    // 前綴搜尋（輸入時即時提示）
    index("dict_entries_headword_prefix_idx").on(t.headword.op("text_pattern_ops")),
    index("dict_entries_freq_idx").on(t.frequencyRank),
  ],
);

/** 釋義：一個詞頭可有多筆，中文（ECDICT）與英英（WordNet）都放這裡 */
export const definitions = pgTable(
  "dict_definitions",
  {
    id: serial("id").primaryKey(),
    headword: text("headword")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    lang: text("lang", { enum: ["zh-TW", "en"] }).notNull(),
    pos: text("pos"), // 詞性：n. v. adj. ...
    text: text("text").notNull(), // 中文已經過 OpenCC s2twp 轉換
    sortOrder: smallint("sort_order").notNull().default(0),
    source: text("source").notNull(), // 'ecdict' | 'wordnet'
    sourceRef: text("source_ref"), // 例如 WordNet synset id
  },
  (t) => [index("dict_definitions_headword_idx").on(t.headword, t.lang, t.sortOrder)],
);

/**
 * 詞形變化 → 原形對照（來自 ECDICT exchange 欄位）
 * 查 "went" 時先在這裡找到 "go" 再查詞條；瀏覽器擴充功能反白查字特別需要。
 * 一個變化形可能對應多個原形（例如 "left" → leave / left），所以用複合主鍵。
 */
export const wordForms = pgTable(
  "dict_word_forms",
  {
    form: text("form").notNull(),
    lemma: text("lemma").notNull(),
    // ECDICT 代碼：p 過去式、d 過去分詞、i 現在分詞、3 第三人稱單數、
    // r 比較級、t 最高級、s 複數
    kind: text("kind").notNull(),
  },
  (t) => [primaryKey({ columns: [t.form, t.lemma, t.kind] }), index("dict_word_forms_lemma_idx").on(t.lemma)],
);

/**
 * 例句（Tatoeba，CC BY 2.0 FR；部分為 CC0）
 * CC BY 要求標示每句的貢獻者，所以作者與授權逐句存。
 */
export const examples = pgTable(
  "dict_examples",
  {
    id: serial("id").primaryKey(),
    textEn: text("text_en").notNull(),
    textZh: text("text_zh"), // 已轉台灣繁體；沒有對應中文翻譯時為 null
    enSentenceId: integer("en_sentence_id").notNull(), // Tatoeba 句子 ID，可組出原始連結
    zhSentenceId: integer("zh_sentence_id"),
    enAuthor: text("en_author"),
    zhAuthor: text("zh_author"),
    enLicense: text("en_license").notNull(), // 'CC BY 2.0 FR' | 'CC0 1.0'
    zhLicense: text("zh_license"),
    source: text("source").notNull().default("tatoeba"),
  },
  (t) => [uniqueIndex("dict_examples_pair_idx").on(t.enSentenceId, t.zhSentenceId)],
);

/** 例句 ↔ 詞頭的多對多關聯（匯入時用詞形還原後的原形建立） */
export const exampleWords = pgTable(
  "dict_example_words",
  {
    headword: text("headword")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    exampleId: integer("example_id")
      .notNull()
      .references(() => examples.id, { onDelete: "cascade" }),
    // 例句品質分數（長度適中、常用字比例高者優先顯示），匯入時計算
    score: smallint("score").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.headword, t.exampleId] }),
    index("dict_example_words_rank_idx").on(t.headword, t.score),
  ],
);

/**
 * 相似字：單字頁「相似」區塊顯示的兩排字，由 scripts/import/similar.ts 預先算好。
 * - kind = 'confusable'：拼法相近、容易看錯的字（編輯距離計算，source = 'computed'）
 * - kind = 'synonym'：近義字（Open English WordNet 的同義、上下位、相似關係，source = 'oewn'）
 * 每個 headword 各存前幾名，rank 越小越前面。只列字，不附辨析。
 */
export const similarWords = pgTable(
  "dict_similar_words",
  {
    headword: text("headword")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["confusable", "synonym"] }).notNull(),
    word: text("word")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    rank: smallint("rank").notNull(),
    source: text("source").notNull(), // 'computed' | 'oewn'
  },
  (t) => [primaryKey({ columns: [t.headword, t.kind, t.word] })],
);

/**
 * 詞性家族：同字根、不同詞性的衍生字（diligent → diligence、diligently），由 scripts/import/family.ts 預先算好。
 * - source = 'oewn'：Open English WordNet 的 derivation / pertainym 關係
 * - source = 'computed'：字尾規則（-ly、-ness、-ful…）補 WordNet 缺漏，且衍生字須在字典中且詞性相符
 * pos 是 word 在這個家族中的詞性；rank 越小越前面（依詞頻）。
 */
export const wordFamily = pgTable(
  "dict_word_family",
  {
    headword: text("headword")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    word: text("word")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    pos: text("pos", { enum: ["n", "v", "adj", "adv"] }).notNull(),
    rank: smallint("rank").notNull(),
    source: text("source").notNull(), // 'oewn' | 'computed'
  },
  (t) => [primaryKey({ columns: [t.headword, t.word] })],
);

/**
 * 易混淆字組的辨析（目前未使用，保留給日後以 LLM 生成或人工撰寫的辨析說明）
 * 一律讓 headwordA < headwordB，避免同一組存兩次。
 */
export const confusables = pgTable(
  "dict_confusables",
  {
    id: serial("id").primaryKey(),
    headwordA: text("headword_a")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    headwordB: text("headword_b")
      .notNull()
      .references(() => entries.headword, { onDelete: "cascade" }),
    method: text("method", { enum: ["edit_distance", "metaphone", "manual"] }).notNull(),
    explanation: text("explanation"), // LLM 生成的辨析（繁體中文）
    model: text("model"), // 生成用的模型名稱，方便日後重新生成
    reviewed: boolean("reviewed").notNull().default(false), // 是否已人工抽查
    hidden: boolean("hidden").notNull().default(false), // 抽查後判定不適合的先隱藏，不刪
    source: text("source").notNull().default("generated"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("dict_confusables_pair_idx").on(t.headwordA, t.headwordB),
    index("dict_confusables_b_idx").on(t.headwordB),
    check("dict_confusables_order_chk", sql`${t.headwordA} < ${t.headwordB}`),
  ],
);
