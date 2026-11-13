# 字典資料來源與過濾條件

Moji 的字典資料（`dict_` 開頭的表）全部由 `scripts/import/` 的匯入腳本寫入，App 只讀不寫。
本文件記錄每個來源怎麼取得、用了哪些過濾條件，以及目前的資料量。過濾條件以腳本為準，改腳本時請一併更新本文件。

最後更新：2026-11-13

## 總覽

| 來源 | 授權 | 用途 | 資料表 | 腳本 |
|---|---|---|---|---|
| [ECDICT](https://github.com/skywind3000/ECDICT) | MIT | 詞條、音標、詞頻、考試標籤、中文釋義、詞形變化 | `dict_entries`、`dict_definitions`（zh-TW）、`dict_word_forms` | `import:ecdict` |
| [Open English WordNet 2025](https://github.com/globalwordnet/english-wordnet) | CC BY 4.0（需標示出處） | 英英釋義、近義字、詞性家族 | `dict_definitions`（en）、`dict_similar_words`、`dict_word_family` | `import:wordnet`、`import:similar`、`import:family` |
| [Tatoeba](https://tatoeba.org) | 多數 CC BY 2.0 FR，部分 CC0 | 真人例句與中文翻譯 | `dict_examples`（source = `tatoeba`）、`dict_example_words` | `import:tatoeba` |
| LLM 產生 | — | 補 Tatoeba 沒有或太少例句的字 | `dict_examples`（source = `llm`）、`dict_example_words` | `llm:examples` → `import:llm-examples` |
| LLM 產生 | — | 現代化詞條：詞義、中英釋義、常用程度、語域（以 ECDICT 與 OEWN 為參考） | `dict_entry_senses` | `generate-entries.ts` → `import:llm-entries` |
| 自行計算 | — | 易混淆字、部分詞性家族 | `dict_similar_words`、`dict_word_family`（source = `computed`） | `import:similar`、`import:family` |

**禁止使用**：Cambridge、Oxford、Merriam-Webster、Longman 等有著作權的字典內容。Wiktionary（CC BY-SA）暫不使用，要引入需先討論。

所有字典內容都記錄 `source`（適用時加 `source_ref`），使用者資料只用 `headword` 文字參照字典、不建外鍵，方便日後整批替換來源。headword 一律經過 `normalizeHeadword()`（小寫、去頭尾空白、片語保留單一空格）。

## 目前資料量（2026-11-11，本機與正式環境一致）

| 項目 | 數量 |
|---|---|
| 詞條（`dict_entries`） | 36,830 |
| 中文釋義 | 55,819 筆 |
| 英英釋義 | 74,524 筆（涵蓋 29,019 個詞條） |
| 詞形變化 | 42,257 筆 |
| 易混淆字／近義字 | 180,656／120,662 筆 |
| 詞性家族 | 22,259 筆 |
| 例句：Tatoeba | 40,634 句（英文為 CC0 的 201 句） |
| 例句：LLM（deepseek-flash） | 26,658 句 |
| 例句：LLM（claude-opus-5-5，試跑） | 100 句 |
| 例句與詞條的關聯 | 103,372 筆，涵蓋 22,059 個詞條 |

例句覆蓋率：

| 範圍 | 詞條數 | 沒有例句 | 只有 1 句 |
|---|---|---|---|
| 詞頻前 5,000 | 5,566 | 119 | 57 |
| 詞頻前 20,000 | 23,081 | 2,383 | 321 |
| TOEFL／IELTS／GRE | 12,847 | 2,622 | 201 |

剩下沒有例句的字，大多是被排除的專有名詞與縮寫，或詞頻在 20,000 名以外的考試字。

## ECDICT

- 原始檔：`data/raw/ecdict/ecdict.csv`（不進版控）
- **收錄條件**（符合任一）：
  - `frq` 或 `bnc` 詞頻排名取較好者，在 30,000 名以內（`--max-rank`）
  - 有 `toefl`、`ielts`、`gre` 任一標籤（`--tags`），排名較後也保留
- 同一個 headword 有大小寫不同的多筆時（例如 `polish` / `Polish`），優先保留小寫，其次保留排名較好的。
- `frequency_rank` 存兩種詞頻中較好的排名，用來排序搜尋結果與挑選常用字。
- 中文釋義由簡體轉台灣繁體（OpenCC `cn` → `twp`）。
- `exchange` 欄位轉成 `dict_word_forms`（過去式、過去分詞、現在分詞、第三人稱單數、比較級、最高級、複數）。
- 重新匯入會 TRUNCATE `dict_entries`（CASCADE），英英釋義、例句關聯、相似字等也會一起清空，必須重跑其他腳本（用 `npm run import:all`）。

## Open English WordNet 2025

- 原始檔：`data/raw/oewn/`（解壓 `english-wordnet-2025-json.zip`）
- **英英釋義**：只匯入已存在於 `dict_entries` 的字，`source_ref` 存 synset id。單字頁每個詞性預設顯示 8 筆，其餘收合。
- **近義字**（`import:similar`，source = `oewn`）：同 synset 成員 > similar/also > 上位詞 > 下位詞 > 同上位詞的其他字，依該字主要詞性前 4 個 sense 加權，每字最多 10 個。只收 WordNet 也有的字（排除人名與縮寫）。
- **詞性家族**（`import:family`）：sense 之間的 derivation 與 pertainym 關係。往外第二層的字只收開頭至少 4 個字母相同的；一律排除詞形變化。每字最多 12 個。
- 已定案用 OEWN，不用 Princeton WordNet 3.1。

## 自行計算

- **易混淆字**（`import:similar`，source = `computed`）：詞頻前 12,000 字裡拼法相近的字。分數為「1 − 編輯距離 ／ 較長字長」，開頭字母相同、結尾 3 個字母相同各加分。排除詞形變化（go/went）、同字根（negotiate/negotiation）、只差否定或 re- 等字首（happy/unhappy）。每字最多 5 個。
- **詞性家族補充**（`import:family`，source = `computed`）：WordNet 沒收到的，用準確度高的字尾規則補（success → successful）。衍生字和原字都要在字典裡，詞性也要符合規則；-al、-ic、-ous、-ive、-ion、-ize、-ance、-ment 誤判太多，不用規則補。

## Tatoeba 例句

- 原始檔：`data/raw/tatoeba/` 的 `eng_sentences_detailed.tsv`、`cmn_sentences_detailed.tsv`、`eng_sentences_CC0.tsv`、`cmn_sentences_CC0.tsv`、`eng-cmn_links.tsv`
- **只收有中文翻譯的英文句子**；一句英文有多個中文翻譯時，取 id 最小的一句。
- **超過 25 個英文字的句子不收**（`MAX_WORDS`）。Tatoeba 有整段日記式的長文（例如 seemingly 原本配到 224 字的段落），因此沒有例句的字改由 LLM 補。
- 斷詞後透過 `dict_word_forms` 還原原形，一句會關聯到句中所有字（例如含 preceding 的句子會同時掛在 precede 與 preceding 底下）。
- **計分**（0–100）：句長 5–15 字得 50 分、超出範圍每字扣 8 分；詞頻前 5,000 名的常用字比例最多 50 分。中文翻譯含大陸用語（「漲工資」等，清單與 LLM 檢查共用）扣 30 分。每個詞條保留分數最高的 20 句（`--per-headword`），同分時短句優先。
- **去除重複用法**：依分數依序挑選，若某句的實詞（去掉功能詞與該字本身，並還原成原形）和已選句子重疊 ≥ 50%，就視為重複（例如 raise 的多句「舉手」），排到所有不重複的句子之後（分數扣 100）。只排後、不刪除，每個詞條仍保留 20 句。
- 單字頁預設顯示前 8 句例句，其餘收在「顯示其餘 N 句」。
- 中文翻譯由簡體轉台灣繁體（OpenCC `cn` → `twp`）。
- **逐句記錄出處**：英文、中文各自的句子 id、作者與授權（CC BY 2.0 FR 或 CC0 1.0）。單字頁例句旁的 ⓘ 可查看。
- 重新匯入只刪除 `source = 'tatoeba'` 的例句，LLM 例句不受影響。

## LLM 產生的例句

### 挑字條件

由 `scripts/llm/generate-examples.ts` 直接查資料庫：

- 詞頻前 20,000 名
- 目前的例句數 ≤ `--max-existing`（預設 0；補強只有 1 句的字時用 1）
- headword 只含英文字母（片語可含空格或連字號）
- **排除專有名詞與縮寫**（符合任一就排除）：
  - ECDICT 原始寫法含大寫（BBC、Caroline、Victorian）
  - 中文釋義含「縮寫、abbr、人名、地名、男子名、女子名、姓氏」，或以括號標英文全名（「星期四（Thursday）」）
  - 沒有英英釋義，而且 4 個字母以內
- 已出現在 `data/llm/examples/` 任一檔案的字會跳過（中斷後重跑會接續）

變化形（astonishing、tailored）不排除，因為很多是獨立的形容詞。

### 產生方式

- 每個字 2 句，8–20 個英文字，用最常見的詞義；有兩個明顯不同的常用詞義時各示範一個。
- 提示會附 ECDICT 中文釋義與 OEWN 前 3 筆英英釋義，要求台灣繁體、台灣用語、全形標點、句型多變化。
- 避開血腥、色情、歧視與政治爭議；只有粗俗或冒犯性意思的字，模型回傳空陣列，這個字就略過不收。

### 自動檢查（`scripts/llm/validate.ts`）

沒通過的字會自動重送一次，仍失敗就不寫入：

- 每個字剛好 2 句
- 英文 6–22 個字
- 句中含有該字本身、`dict_word_forms` 記錄的變化形、常見字尾變化，或拉丁／希臘式不規則複數（prosthesis → prostheses）
- **沒有簡體字**：不在 Big5（常用＋次常用字）裡、而且 OpenCC 有對應繁體字的字，才算簡體字。只用 OpenCC 會把郁、岩、划、台這類台灣通用字誤判；只用 Big5 會把酶、肽這類罕用繁體字誤判。另外把「机、网」等常被當簡體使用的字列入黑名單。
- 沒有大陸用語（信息、軟件、網絡、視頻、屏幕…）
- 中文沒有半形標點

**中文不經過 OpenCC 轉換**：模型直接輸出台灣繁體，而 `cn` → `twp` 會把正確用語改錯（「支持」→「支援」、「文件」→「檔案」）。

### 資料檔與匯入

| 檔案 | 模型 | 內容 |
|---|---|---|
| `data/llm/examples/2026-11-11-pilot.json` | claude-opus-5-5 | 試跑 50 字 |
| `data/llm/examples/2026-11-11-deepseek.json` | deepseek-flash | 沒有例句的字，10,534 字 |
| `data/llm/examples/2026-11-11-deepseek-supplement.json` | deepseek-flash | 只有 1 句例句的字，2,795 字 |

- 檔案進版控，每個檔案記錄 `model`。匯入後寫入 `dict_examples.model`。
- `import:llm-examples` 每次刪除 `source = 'llm'` 的例句後全部重灌，每句只關聯到它所屬的詞條，排序分數固定 50（排在 Tatoeba 高分例句之後）。
- 前端不標示「AI 生成」，也不顯示出處按鈕；資料庫保留 `source` 與 `model`，方便日後找出來重跑或刪除。
- 依 CLAUDE.md 規定已人工抽查：opus 試跑 100 句、deepseek 隨機 100 句，皆通過。

## LLM 詞義分組與翻譯修正

詳見 `docs/SENSE-GROUPING.md`。由 `scripts/llm/generate-senses.ts` 產生、`import:llm-senses` 匯入：

- `dict_senses`：每個字 1–8 個粗分詞義（中文標籤、對應的 WordNet synset id、模型）
- `dict_example_words.sense_id`：例句屬於哪個詞義
- `dict_examples.text_zh_revised`：LLM 修正後的中文翻譯，前端優先顯示，`text_zh` 保留 Tatoeba 原文

Tatoeba 匯入另外把中文翻譯裡緊接在中文字後面的半形標點（, ? ! : ;）轉成全形。

## LLM 現代化詞條

ECDICT 與 WordNet 源自舊字典：收了古義（apprehensive「敏悟的」、awful「莊嚴的」）、排序不依現代用法、沒有語域標記。改由 LLM 以這兩者為參考，重新整理每個字。由 `scripts/llm/generate-entries.ts` 產生、`import:llm-entries` 匯入 `dict_entry_senses`：

- 每個詞義：詞性、中文標籤（`label_zh`）、一句中文說明（`def_zh`）、學習者風格的英英釋義（`def_en`）、常用程度（`usage`：common／less_common／rare）、語域（`register`：formal、informal、slang、literary、old、technical、offensive）、對應的 OEWN synset id
- 古義、罕用義放在 JSON 的 `omitted`（附原因），不進資料庫
- 提示要求補上現代網路、科技用法（stream「串流」、ghost「突然斷聯」），並以自己的話撰寫英英釋義、不照抄有著作權的字典
- 資料檔依字首分檔：`data/llm/entries/full/<字首>.json`；試跑與抽查對照在 `data/llm/entries/*.md`
- 目前進度（2026-11-13，deepseek-flash）：10,696 字、33,969 個詞義，涵蓋詞頻約前 9,600 名。計畫做到詞頻前 2 萬，其餘的字維持 ECDICT／WordNet
- 與 `dict_senses`（例句分組用）是兩套獨立資料

```bash
npx tsx --env-file=.env.local scripts/llm/generate-entries.ts --max-rank=20000 --concurrency=12   # 接續產生（已完成的字會跳過）
npm run import:llm-entries
```

## 重新匯入與同步正式環境

```bash
npm run import:all          # ECDICT → WordNet → 相似字 → 詞性家族 → Tatoeba → LLM 例句 → LLM 詞義 → LLM 詞條 → 統計
npm run llm:examples -- --limit=250            # 用 DeepSeek 產生例句（需要 .env.local 的 DEEPSEEK_API_KEY）
npm run llm:examples -- --max-existing=1       # 補強只有 1 句例句的字
npm run llm:check                              # 檢查 data/llm/examples/ 全部資料
```

字典資料不在部署流程裡。正式環境要從本機 `pg_dump --data-only` 匯出後灌進正式資料庫（需暫時開啟 Railway Postgres 的對外連線，用完關閉），任何寫入正式資料庫前都要先確認。字典查詢有 `use cache`，只同步資料、沒有部署新程式時，要到 Railway 手動 Redeploy 才會清掉快取。
