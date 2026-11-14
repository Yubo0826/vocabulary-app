---
name: Moji 單字本
description: 查字、收藏、複習一條龍的個人英文單字 App，Material 3 規則、長春花藍主色
colors:
  periwinkle: "#4263eb"
  periwinkle-night: "#b9c3ff"
  on-periwinkle: "#ffffff"
  on-periwinkle-night: "#102a8f"
  mist-container: "#dee1f9"
  on-mist-container: "#2e3245"
  mist-container-night: "#424659"
  on-mist-container-night: "#dee1f9"
  paper: "#fbf8ff"
  paper-raised: "#f2f0f8"
  paper-high: "#e8e6ee"
  menu-paper: "#efedf4"
  ink: "#1b1b21"
  ink-soft: "#5d5e67"
  hairline: "#c6c5d0"
  field-outline: "#767680"
  night: "#131318"
  night-raised: "#1f1f25"
  night-high: "#2a292f"
  night-ink: "#e4e1e9"
  night-ink-soft: "#b4b3be"
  night-hairline: "#46464f"
  night-field-outline: "#90909a"
  highlighter: "#fdf0c4"
  highlighter-night: "#4a3f1a"
  forgot-red: "#ba1a1a"
  hard-orange: "#c0601d"
  good-green: "#2f8a55"
typography:
  word-display:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "clamp(2rem, 8vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
  hero:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "2.6rem"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  body-small:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  section-label:
    fontFamily: "Roboto Flex, Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "0.1em"
  phonetic:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
  full: "9999px"
spacing:
  gutter: "16px"
  card-pad: "16px"
  card-pad-wide: "20px"
  stack: "16px"
  container: "720px"
components:
  button-filled:
    backgroundColor: "{colors.periwinkle}"
    textColor: "{colors.on-periwinkle}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 10px"
  button-tonal:
    backgroundColor: "{colors.mist-container}"
    textColor: "{colors.on-mist-container}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 10px"
  button-outlined:
    textColor: "{colors.periwinkle}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0 10px"
  button-text:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "32px"
  icon-button-tonal:
    backgroundColor: "{colors.mist-container}"
    textColor: "{colors.on-mist-container}"
    rounded: "{rounded.full}"
    size: "36px"
  search-bar:
    backgroundColor: "{colors.paper-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "56px"
    padding: "0 20px 0 48px"
  search-bar-compact:
    backgroundColor: "{colors.paper-high}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "48px"
    padding: "0 48px 0 44px"
  text-field:
    textColor: "{colors.ink}"
    rounded: "{rounded.xs}"
    height: "32px"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  nav-item:
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  nav-item-active:
    backgroundColor: "{colors.mist-container}"
    textColor: "{colors.on-mist-container}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  tab-active:
    textColor: "{colors.periwinkle}"
    height: "48px"
  segmented-selected:
    backgroundColor: "{colors.mist-container}"
    textColor: "{colors.on-mist-container}"
    rounded: "{rounded.full}"
  dialog:
    backgroundColor: "{colors.menu-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: Moji 單字本

## Overview

**Creative North Star: "安靜的工具"（The Quiet Instrument）**

Moji 像 Google 自家的工具 App：不搶戲、一眼看懂，每個按鈕都在預期的位置。畫面的主角是單字、釋義和例句，介面本身退到後面。系統建立在 Material 3 的規則上（色彩角色、表面色階、state layer、圓角尺度），只有一個品牌色：長春花藍。品牌感不靠裝飾，靠精準的細節。

氣氛是**乾淨俐落、專注安靜、溫和友善**。乾淨來自留白和「不加東西」：沒有漸層、沒有浮起的陰影卡片、沒有裝飾動畫。專注來自層次扁平：區塊只靠底色深淺區分，複習與閱讀時視線不會被框線和陰影打斷。溫和來自偏藍紫的中性色（不是冷灰）、全圓角的按鈕，以及帶寵物感的名字。

這套系統明確拒絕上一版的「AI 模板感」：淡藍漸層的 hero 卡片、白卡片加帶色柔和陰影、到處都是大圓角膠囊、Nunito 圓體字。

**Key Characteristics:**
- 單一品牌色（長春花藍 #4263eb），其他顏色都是由它推出的中性色與 secondary container
- 扁平：用表面色階分層，不用陰影或邊框
- Material 3 元件語彙：filled／tonal／outlined／text 按鈕、primary tabs、segmented button、膠囊搜尋列
- Roboto Flex 英文＋系統中文字型，單字本身用最大最粗的字
- 單欄、最寬 720px，手機與桌面同一套版面

## Colors

一個長春花藍主色，搭配帶一點藍紫的中性表面；顏色是用來「指出可以按的東西和目前的位置」，不是用來裝飾。

### Primary
- **Periwinkle 長春花藍**（淺色 periwinkle／深色 periwinkle-night）：實心主要按鈕、連結、分頁選中文字與指示條、發音按鈕圖示、複習進度條、聚焦外框。白字在上面對比約 5:1。

### Secondary
- **Mist Container 霧藍容器**（mist-container／mist-container-night）：淡色實心按鈕（單字頁的收藏、筆記、熟悉度圓鈕）、頁首導航目前位置的膠囊、美式／英式與熟悉度分段按鈕的選中格、單字本磚塊、複習題目卡。

### Neutral
- **Paper 紙面**（paper／night）：頁面底色，也是頁首底色。
- **Paper Raised 抬高的紙**（paper-raised／night-raised）：卡片與清單容器，比頁面深一階。
- **Paper High 更高的紙**（paper-high／night-high）：搜尋列與展開的搜尋清單、次要填色區塊（筆記預覽、進度條軌道）。
- **Menu Paper 選單紙**（menu-paper）：彈出選單、對話框；深色模式用 night-high。
- **Ink 墨色**（ink／night-ink）：主要文字，帶藍紫的近黑，不用純黑。
- **Ink Soft 淡墨**（ink-soft／night-ink-soft）：次要文字、區塊標題、音標旁的說明。
- **Hairline 細線**（hairline／night-hairline）：分頁列底線、外框按鈕的框、頁尾分隔線。
- **Field Outline 欄位外框**（field-outline／night-field-outline）：輸入框外框、分段按鈕外框。

### 功能色
- **Highlighter 螢光筆**（highlighter／highlighter-night）：例句中目前單字的標記。
- **複習評分**：忘記 forgot-red、困難 hard-orange、記得 good-green、簡單用主色；按鈕是 10% 淡底＋彩色字，按下時實心。
- **熟悉度圓點**：無＝淡墨空心、低＝紫、中＝琥珀、高＝翠綠（Tailwind violet／amber／emerald 500）。

### Named Rules
**The One Blue Rule.** 品牌色只有長春花藍一個。新功能需要強調時，先用 mist container 或字重，不要加新的色相。

**The No-Gradient Rule.** 背景、按鈕、文字、圖示都不用漸層。

## Typography

**Display / Body Font:** Roboto Flex（後援 Noto Sans TC、PingFang TC、微軟正黑體）
**Mono Font:** Geist Mono（音標、程式碼、快捷鍵）

**Character:** Roboto Flex 是 Material 的預設字型，中性、清楚、不帶情緒；中文交給系統字型，兩者都不搶內容的戲。

### Hierarchy
- **Word Display**（700，clamp(2rem, 8vw, 2.6rem)，1.25）：單字頁標題、複習卡上的單字。全站最大最粗的字，只給英文單字。
- **Hero**（400，2rem → 2.6rem，1.25）：首頁「查單字」。大但不粗，安靜。
- **Headline**（600，1.5rem）：各頁的頁面標題（我的單字、複習、筆記、設定）。
- **Title**（600，1.05rem）：區塊內的小標題、對話框標題。
- **Body**（400，1rem，1.625）：釋義、例句、筆記。中文行高要寬鬆。
- **Body Small**（400，0.875rem）：清單內容、按鈕、說明文字。
- **Section Label**（600，0.75rem，字距 0.1em，淡墨色）：單字頁卡片的區塊標題（釋義、例句…）。

### Named Rules
**The Word Is the Hero Rule.** 粗體大字只給英文單字本身；介面標題用 600 以下的字重，不和單字搶。

## Layout

單欄版面，內容最寬 720px、左右各 16px 留白，頁首、內容、頁尾共用同一個寬度。手機與桌面是同一套版面，只有頁首的導航在手機上換到第二列。區塊之間的間距以 16px 為主（`gap-4`），卡片內距 16px、寬螢幕 20px。首頁搜尋區上方留空（約 4vh＋32–56px），讓搜尋列落在視線高度。

## Elevation & Depth

扁平系統：靜止時沒有任何陰影（`--surface-shadow: none`）。層次完全靠表面色階：paper（頁面）→ paper-raised（卡片）→ paper-high（搜尋列、填色區塊）→ menu-paper（彈出層）。陰影只出現在兩個地方：會浮在內容上方的彈出層（選單、popover、展開的搜尋清單），以及實心主要按鈕的 hover 狀態。

### Named Rules
**The Flat-At-Rest Rule.** 卡片和區塊不加陰影也不加框；需要區分時，換深一階的表面色。

**The Gap-Not-Line Rule.** 清單項目之間用 2px 的頁面底色間隔分開，不畫分隔線。

## Shapes

圓角使用 Material 3 的固定尺度：輸入框 4px、選單項目 8px、彈出層 12px、卡片與清單容器 16px、對話框與展開的搜尋清單 28px。所有按鈕、導航項目、晶片、分段按鈕、搜尋列都是全圓膠囊。這個對比本身就是形狀語言：**可以按的東西是膠囊，容器是圓角矩形**。

## Components

### Buttons
安靜、可預期：四種強度，從實心到純文字，一個畫面只有一個實心按鈕。
- **Shape:** 全圓膠囊（9999px），預設高 32px、大尺寸 40px。
- **Filled（default）:** 長春花藍底、白字。用在一頁最主要的動作（顯示答案、儲存）。
- **Tonal（secondary／soft）:** 霧藍容器底。用在次要但常用的動作，以及單字頁標題列的圓形圖示按鈕。
- **Outlined（outline）:** 細線外框＋主色字，沒有底色。用在發音按鈕等輔助動作。
- **Text（ghost）:** 沒有底色也沒有框，只有 state layer。用在工具列圖示、清單內的小動作。
- **Hover / Active:** 疊一層前景色 state layer：hover 8%、按下 12%；filled 按鈕 hover 另加一點陰影。沒有按下位移、沒有縮放。
- **Focus:** 3px 主色半透明外環。

### Cards / Containers
- **Corner Style:** 16px。
- **Background:** paper-raised。
- **Shadow Strategy:** 無（見 Flat-At-Rest Rule）。
- **Border:** 無。
- **Internal Padding:** 16px，寬螢幕 20px；卡片頂端用 Section Label 當區塊標題。

### Inputs / Fields
- **Style:** 透明底、1px field-outline 外框、4px 圓角（Material outlined text field）。
- **Focus:** 外框換主色＋3px 半透明主色外環。
- **Error:** 外框換 destructive 色＋淡紅外環。

### Search Bar（招牌元件）
56px 高的全圓膠囊，paper-high 底、沒有框也沒有聚焦外環（游標就是聚焦提示），左側放大鏡圖示。輸入時下方展開同底色、28px 圓角的清單，看起來和搜尋列是同一張卡片，選中列疊 8% state layer。聚焦但還沒輸入時，同一張清單改列「最近查過」：每列左邊歷史圖示、右邊 32px 的 × 移除鈕（不進 Tab 順序，鍵盤用 Shift+Delete）。

單字頁頂端用 48px 的精簡版（placeholder「查其他單字」），讓人不必回首頁就能查下一個字；按 `/` 聚焦，有實體鍵盤時右側顯示 `/` 提示（觸控裝置隱藏）。一頁只有一個搜尋框啟用 `/`。

### Navigation
- **頁首:** 與頁面同底色、沒有陰影（Material top app bar）。左邊「Moji 單字本」logo，右邊導航連結與深淺色切換。
- **導航項目:** 膠囊形；hover 疊 8% state layer；目前所在區塊填霧藍容器並加粗。
- **手機:** 導航換到頁首第二列（是否改成底部導航列尚未決定）。

### Tabs
Material 3 primary tabs：整排 48px 高、底部一條細線；選中的分頁文字變主色，下方 3px 寬 56px 的圓頭指示條；hover 疊 state layer。

### Segmented Buttons
美式／英式、熟悉度選擇：field-outline 外框的膠囊，格與格之間細線分隔，選中格填霧藍容器。熟悉度的選中底色會以 200ms 滑動到新的格子（減少動態時關閉）。

## Do's and Don'ts

### Do:
- **Do** 用表面色階（paper → paper-raised → paper-high）區分層次。
- **Do** 讓可以按的東西是膠囊、容器是圓角矩形。
- **Do** 一個畫面只放一個 filled 按鈕，其餘用 tonal、outlined 或 text。
- **Do** 互動回饋用 state layer（hover 8%、按下 12%）。
- **Do** 動畫只用在狀態變化（滑動的選中格、展開收合），並尊重「減少動態」設定。
- **Do** 圖示一律用 lucide 線條圖示。

### Don't:
- **Don't** 使用漸層（背景、按鈕、文字都不行）。
- **Don't** 用陰影讓卡片浮起來，或用帶色的柔和陰影。
- **Don't** 加裝飾性、花俏的動畫（彈跳、浮動、hover 位移或縮放）。
- **Don't** 用 emoji 當圖示。
- **Don't** 回到上一版的樣子：淡藍漸層 hero 卡片、白卡片＋藍色陰影、到處大圓角、圓體字。
- **Don't** 加入長春花藍以外的品牌色。
