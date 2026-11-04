# 開發計畫

每個階段完成「驗收條件」後再進入下一階段。完成的項目把 `[ ]` 改成 `[x]`。

---

## 階段 0：專案骨架

- [x] 建立 Next.js 專案（App Router、TypeScript strict、ESLint）
- [x] 安裝 drizzle-orm、drizzle-kit、pg（或 postgres.js）、better-auth
- [x] 將既有 schema 檔放入 `src/db/schema/`，建立 `drizzle.config.ts`
- [x] 建立 `src/db/index.ts`（資料庫連線，使用 `DATABASE_URL`）
- [x] Migration 順序：
  1. `npx drizzle-kit generate --custom --name enable_pg_trgm`，在產生的檔案寫入 `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  2. `npx drizzle-kit generate --name init`
  3. `npx drizzle-kit migrate`
- [x] 用 Better Auth CLI 重新產生 `auth.ts`，確認與手寫版差異，保留 `user` 匯出名稱
- [x] 建立 `.env.example`、`.gitignore`（含 `data/raw/`）
- [x] 本機開發可用 Docker 跑 Postgres 16

**驗收條件**：本機 `npm run dev` 可啟動；migration 在乾淨資料庫上能完整執行；`tsc --noEmit` 通過。

**備註**（2026-11-04 完成）：
- 本機 Postgres 走 `docker compose up -d`，port 5434（5432/5433 已被其他服務占用）；dev server 用 port 3001（3000 被其他服務占用）。
- 型別檢查用 `npm run typecheck`（先 `next typegen` 產生 `LayoutProps` 等路由型別，再 `tsc --noEmit`）。
- `@better-auth/cli` 已標為 deprecated（停在 1.4.21）；加外掛後若要重新產生 auth schema，需先確認新版 CLI 的官方套件名稱。

---

## 階段 1：字典資料匯入

腳本放在 `scripts/import/`，每支腳本可重複執行（先清空對應的表再寫入，包在單一 transaction 裡）。原始檔下載到 `data/raw/`。

- [x] `normalizeHeadword()` 共用函式
- [x] **ECDICT** → `dict_entries`、`dict_definitions`（lang = zh-TW）、`dict_word_forms`
  - 篩選常用字：以 `frq` / `bnc` 詞頻排名取前 3–5 萬，另外保留有考試 tag（如 toefl、ielts、gre）的字。篩選門檻做成參數。
  - 中文釋義用 opencc-js（`cn` → `twp`）轉台灣繁體。
  - ECDICT 的 `translation` 欄位以換行分隔多筆，依行拆成多筆 definitions 並保留順序，嘗試解析開頭的詞性（如 `n.`、`vt.`）。
  - 解析 `exchange` 欄位（格式如 `p:went/d:gone/i:going/3:goes`）寫入 `dict_word_forms`。
- [x] **WordNet** → `dict_definitions`（lang = en），只匯入已存在於 `dict_entries` 的字，`source_ref` 存 synset id
- [x] **Tatoeba** → `dict_examples`、`dict_example_words`
  - 先確認 Tatoeba 目前的匯出檔名與格式（句子、翻譯連結、含作者的詳細檔、CC0 句子清單），不要假設。
  - 取英文句與中文（cmn）翻譯配對，中文用 OpenCC 轉台灣繁體。
  - 逐句記錄作者與授權（CC0 清單內的標 CC0，其餘標 CC BY 2.0 FR）。
  - 例句斷詞後透過 `dict_word_forms` 還原成原形，建立 `dict_example_words`。
  - 計算 `score`：句長適中（約 5–15 字）、句中常用字比例高者分數高。每個 headword 最多保留約 20 句。
- [x] 匯入完成後印出統計（詞條數、釋義數、例句數、無釋義的詞條數）

**驗收條件**：可查到 `go`、`run`、`apple` 等常見字的中英釋義與例句；`went` 能透過 word_forms 找到 `go`；中文釋義為台灣用語（例如「軟體」而非「軟件」）。

**備註**（2026-11-04 完成）：
- 執行：`npm run import:all`（依序 ECDICT → WordNet → Tatoeba → 統計）。ECDICT 會以 CASCADE 清空 `dict_entries`，單獨重跑它之後必須重跑另外兩支。
- 原始檔（放在 `data/raw/`，下載網址也寫在各腳本開頭）：
  - `ecdict/ecdict.csv`：https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
  - `oewn/`：解壓 https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip
  - `tatoeba/`：從 https://downloads.tatoeba.org/exports/per_language/ 下載 `eng_sentences_detailed`、`eng_sentences_CC0`、`eng-cmn_links`（eng 目錄）與 `cmn_sentences_detailed`、`cmn_sentences_CC0`（cmn 目錄）的 `.tsv.bz2`，以 bunzip2 解壓
- 英英釋義採用 Open English WordNet 2025（CC BY 4.0），`source = 'oewn'`。
- 預設篩選：排名 ≤ 30000 或 tag 含 toefl/ielts/gre → 36,830 詞條；可用 `--max-rank`、`--tags` 調整。
- 結果：中文釋義 55,819、英英釋義 74,524（7,811 詞條無英英）、例句 42,345（24,789 詞條無例句，Tatoeba 英中配對只有約 7 萬組）。
- 約 2,000 句 CC BY 例句在 Tatoeba 上沒有作者（帳號已刪除），出處顯示時改連到 Tatoeba 原句頁。

---

## 階段 2：查詢

- [x] 查詢 API / Server Action，流程：
  1. 正規化輸入
  2. 完全符合 headword → 直接回傳
  3. 查 `dict_word_forms` 還原原形
  4. 前綴搜尋（`LIKE 'xxx%'`），依 `frequency_rank` 排序
  5. 前面都沒有結果時，用 pg_trgm `similarity()` 做模糊搜尋（拼錯字建議）
- [x] 輸入即時提示（debounce 約 200ms，最多 10 筆）
- [x] 單字頁 `/word/[headword]`：音標、發音按鈕（Web Speech API，en-US / en-GB 可切換）、中文釋義、英英釋義、例句
- [x] 例句下方標示出處（Tatoeba 句子連結與作者）
- [x] 頁尾或「關於」頁列出所有資料來源與授權

**驗收條件**：輸入 `recieve` 能建議 `receive`；輸入 `mice` 能找到 `mouse`；單字頁在手機寬度下正常顯示。

**備註**（2026-11-04 完成）：
- 查詢邏輯在 `src/lib/dictionary.ts`（`searchDictionary`、`getWord`、`findLemma`），以 `"use cache"` + `cacheLife("days")` 快取；**重新匯入字典後要重啟伺服器**才會看到新資料。
- 即時提示走 `GET /api/search?q=`；按 Enter 時，完全符合或可還原原形就直接進單字頁，否則到 `/search?q=`。
- 模糊搜尋：pg_trgm 只用來撈候選（門檻 0.2），再依 Damerau 編輯距離 → 詞頻 → 相似度排序。只用 trigram 相似度時 `recieve` 會排出 `relieve` 而非 `receive`。
- `/word/[headword]` 不用 `generateStaticParams`（Cache Components 要求至少回傳一筆，會讓 build 依賴資料庫）；大小寫或空白不同時轉到正規網址，輸入變化形（went）時轉到原形（go）。
- 驗證：手機寬度 375px 以 Chrome DevTools Protocol 截圖確認無水平溢出；`npm run build` 通過。

---

## 階段 3：登入、收藏、單字本

- [x] Better Auth：Email + 密碼，再加 Google 登入（需先詢問是否要加）
- [x] 登入／註冊／登出頁面；未登入可查字，收藏時引導登入
- [x] 收藏／取消收藏（`saved_words`，取消為軟刪除；重新收藏時清除 `deleted_at`）
- [x] 收藏時可加個人筆記
- [x] 單字本 CRUD，一個字可放入多本
- [x] 收藏列表頁：可依單字本篩選、依收藏時間或字母排序
- [x] 收藏時自動建立一張 `en_zh` 字卡（`due` = 現在、state = New）

**驗收條件**：兩個不同帳號的資料完全隔離（寫一個測試驗證 A 帳號無法讀寫 B 帳號的收藏）；刪除帳號後其所有資料被 cascade 刪除。

**備註**（2026-11-04 完成）：
- 已決定加入 Google 登入。程式已完成，但**需要在 `.env.local` 填入 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 後實際測試**（未設定時登入頁不顯示 Google 按鈕）。重新導向 URI：`http://localhost:3001/api/auth/callback/google`。
- 使用者資料存取集中在 `src/lib/user-data.ts`，第一個參數一律是 userId；Server Actions（`src/app/actions.ts`）自己從 session 取得 userId，不接受用戶端傳入。操作別人的資料一律回「找不到」。
- 測試：`npm test`（`tests/user-isolation.test.ts`，用 Node 內建 test runner + tsx，使用 `TEST_DATABASE_URL` 指向的 `vocab_test`，每次執行會清空）。涵蓋資料隔離、軟刪除與重新收藏、自動建卡，以及透過 Better Auth API 刪除帳號後 8 張表的 cascade。
- 取消收藏時，該字的字卡也一併軟刪除；重新收藏會恢復原本的字卡與複習進度，收藏時間更新為重新收藏的時間。單字本中的項目保留，重新收藏後會回到原本的單字本。
- 尚未串接寄信服務：註冊不需 Email 驗證，也沒有「忘記密碼」。只用 Google 登入的帳號要刪除時，需在登入 1 天內操作（Better Auth 的 freshAge）。
- 注意 Drizzle 的坑：select 欄位裡的 `sql` 子查詢，`${table.column}` 會輸出成不帶表名的欄位，關聯條件會錯。子查詢一律用別名寫完整欄位名稱（見 `user-data.ts`）。

---

## 階段 4：FSRS 字卡複習

- [ ] 讀取 `user_settings` 建立 FSRS 實例（`fsrsWeights` 為 null 時用預設參數）
- [ ] 今日佇列：到期的複習卡（`due <= 現在`，排除 suspended 與 deleted）＋ 今日新卡（受 `newCardsPerDay` 限制）。「今天」的界線依 `timezone` 與 `dayStartsAtHour` 計算。
- [ ] 複習介面：顯示英文 → 點擊翻面顯示中文釋義與例句 → 四個評分按鈕（Again / Hard / Good / Easy），按鈕上顯示下次間隔
- [ ] 支援鍵盤快捷鍵（空白鍵翻面、1–4 評分）
- [ ] 評分後：更新 `cards`，並新增一筆 `review_logs`（id 由用戶端產生）
- [ ] 復原上一張（undo）：用最後一筆 review log 還原卡片狀態
- [ ] 設定頁：每日新卡數、目標記憶保留率、換日時間
- [ ] 簡單統計：今日已複習數、連續天數、未來 7 天到期數

**驗收條件**：同一張卡連續評 Good，間隔遞增；評 Again 後進入 Relearning；重送同一筆 review log 不會重複寫入。

---

## 階段 5：易混淆字

- [ ] 腳本找候選：常用字範圍內，編輯距離 ≤ 2 或 Double Metaphone 編碼相同的字對；排除互為詞形變化的字對（例如 `go`/`goes`）
- [ ] 以 LLM 批次生成繁體中文辨析（先詢問要用哪個 API 與預算上限），記錄 `model`
- [ ] 管理用頁面（僅限自己的帳號）：抽查、標記 `reviewed`、隱藏不適合的字對
- [ ] 單字頁顯示「容易混淆」區塊（只顯示未隱藏的）

---

## 階段 6：PWA 與營運

- [ ] PWA manifest、圖示、可加入主畫面
- [ ] （需先討論）離線複習：IndexedDB 暫存卡片與 review logs，上線後依 `updated_at` 增量同步
- [ ] 備份：GitHub Actions 每日 `pg_dump` 使用者資料表，上傳到 Railway 以外的儲存空間（如 Cloudflare R2）
- [ ] Railway 設定 usage limit 與用量通知
- [ ] 隱私權政策頁、帳號資料匯出（JSON）、刪除帳號功能

---

## 加分項目（暫緩）

- CSV 匯入收藏（欄位對應：headword、筆記、單字本）
- 瀏覽器擴充功能：反白查字與收藏，使用 Better Auth bearer token 外掛處理跨來源登入，收藏時記錄 `origin = 'extension'`、來源網址與原句

## 待決定

- 前端是否之後搬到 Vercel（若 Railway 用量超標；資料庫仍在 Railway，Functions 區域需設在新加坡附近）
- 是否支援離線複習
- ~~是否加入 Google 登入~~ → 已決定加入（階段 3）
