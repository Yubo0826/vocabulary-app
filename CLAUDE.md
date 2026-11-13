# Moji（暫定名稱）

名稱取自日文「文字（moji）」，暗藏學字的意思，聽起來也像寵物名。UI 上的 App 名稱一律用「Moji」。

個人使用為主、未來可能公開上線的英文單字 App。解決的痛點：現有單字 App 沒有雲端同步，字典網站的複習功能陽春。

開發計畫與目前進度見 `docs/PLAN.md`。一次只做一個階段，完成驗收條件後再進下一階段。

## 技術棧

- Next.js（App Router、TypeScript strict），先做 PWA，不上架 App Store
- UI：Tailwind CSS v4 + shadcn/ui（Radix 版），元件在 `src/components/ui/`（用 `npx shadcn add` 新增）；配色是 `globals.css` 的 CSS 變數，深色模式由 `<html class="dark">` 決定（預設跟隨系統，頁首按鈕可切換並記在 localStorage）
- 部署：Railway Hobby 方案，區域選 Singapore（使用者在台灣）
- 資料庫：Railway Postgres，啟用 `pg_trgm`
- ORM：Drizzle（drizzle-orm + drizzle-kit）
- 登入：Better Auth（已定案，不使用 Auth.js / NextAuth）
- 間隔重複：ts-fsrs
- 繁簡轉換：opencc-js，使用 `cn` → `twp`（等同 OpenCC s2twp）
- 發音：瀏覽器 Web Speech API（初期不用錄音檔）

## 專案結構

- `src/db/schema/` — Drizzle schema，分為 `auth.ts`、`dictionary.ts`、`user-data.ts`，由 `index.ts` 匯出
- `drizzle/` — migrations（由 drizzle-kit 產生，第一個是啟用 pg_trgm 的 custom migration）
- `scripts/import/` — 字典資料匯入腳本（一次性、可重複執行）
- `data/raw/` — 下載的原始資料檔，已加入 `.gitignore`，不進版控

## 設計原則（不可違反）

1. **多使用者架構**：所有使用者資料表都有 `user_id`，且外鍵設 `onDelete: cascade`。任何讀寫使用者資料的查詢都必須以目前登入者的 `user_id` 過濾，不可信任用戶端傳來的 user_id。
2. **字典與使用者資料分離**：字典表（`dict_` 開頭）唯讀，只由匯入腳本寫入。使用者資料表只用 `headword` 文字參照字典，**不建立外鍵**，以便日後整批替換字典來源。
3. **headword 正規化**：一律小寫、去頭尾空白，片語保留單一空格。寫一個共用的 `normalizeHeadword()` 函式，匯入與查詢都用它。
4. **出處追蹤**：每筆字典內容都記錄 `source`（與適用時的 `source_ref`）。
5. **同步友善**：使用者資料主鍵為 UUID，允許由用戶端產生；可修改的表用 `updated_at` + `deleted_at`（軟刪除），不做硬刪除。`review_logs` 只新增不修改，寫入時用 `ON CONFLICT DO NOTHING`。
6. **Schema 變更一律透過 migration**：修改 schema 後執行 `drizzle-kit generate`，不要用 `drizzle-kit push` 改正式資料庫。

## 資料來源與授權

| 來源 | 授權 | 用途 |
|---|---|---|
| ECDICT | MIT | 英中釋義、音標、詞頻、詞形變化（exchange 欄位） |
| Open English WordNet 2025 | CC BY 4.0（需標示出處） | 英英釋義（`source = 'oewn'`，已定案不用 Princeton WordNet 3.1） |
| Tatoeba | 多數 CC BY 2.0 FR，部分 CC0 | 例句；**必須逐句記錄作者與授權** |
| LLM 生成 | — | 補 Tatoeba 沒有或太少例句的字（`data/llm/examples/`）；現代化詞條（`data/llm/entries/`，以 ECDICT 與 OEWN 為參考，去古義、依現代用法排序）。需記錄模型名稱並人工抽查 |

各來源的匯入方式、過濾條件與目前資料量見 `docs/DATA-SOURCES.md`，改匯入腳本時一併更新。

**禁止**：抓取或使用 Cambridge、Oxford、Merriam-Webster、Longman 等有著作權字典的內容。Wiktionary（CC BY-SA）暫不使用，若要引入需先討論。

## 工作規則

- 新增 npm 套件前先說明用途並徵詢同意。
- 每完成一個小功能就執行 `tsc --noEmit` 與 lint，確認通過再繼續。
- 不確定的設計決定先提出選項詢問，不要自行假設。
- 機密（`DATABASE_URL`、`BETTER_AUTH_SECRET`、OAuth 金鑰）只放 `.env.local`，並維護一份不含真實值的 `.env.example`。
- UI 文字使用台灣繁體中文。
- 完成一個階段後，更新 `docs/PLAN.md` 的進度勾選。
