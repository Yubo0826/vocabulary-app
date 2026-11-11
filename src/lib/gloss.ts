/**
 * ECDICT 中文釋義裡的專業領域釋義（以「[醫]」「[化]」等標記開頭的整行）。
 * 一般學習用不到，所以這個字還有一般釋義時就不顯示；只有專業釋義的字（kinase → [化] 激酶）照常顯示。
 * 資料庫不刪，只在顯示時過濾。用法標記（[俚]、[口]、[方言]）與類別標記（[人名]、[地名]）不算專業領域。
 */
const TECHNICAL_FIELDS = [
  "醫", "計", "法", "化", "經", "機", "電", "建", "植", "體", "動", "軍", "鳥", "宗", "魚", "天", "地", "地質",
  "樂", "紡", "心", "物", "律", "食", "宗教", "稅收", "汽", "網路", "鳥類", "心理", "商", "生態", "電信", "脊椎",
  "生物", "電子", "眼科", "昆", "昆蟲", "棒", "棒球", "籃", "美橄", "船舶", "生", "生化", "數", "史", "電腦",
  "植物", "微", "機械", "礦", "畫",
];

/** JavaScript 與 PostgreSQL 都能用的正規表示式（PostgreSQL 用 `~` 比對） */
export const TECHNICAL_GLOSS_PATTERN = `^\\s*\\[(${TECHNICAL_FIELDS.join("|")})\\]`;
const TECHNICAL_GLOSS = new RegExp(TECHNICAL_GLOSS_PATTERN);

export const isTechnicalGloss = (text: string) => TECHNICAL_GLOSS.test(text);

/** 有一般釋義時去掉專業領域釋義；全部都是專業釋義時原樣保留（這個字本身就是專業術語） */
export function withoutTechnicalGlosses<T extends { text: string }>(rows: T[]): T[] {
  const general = rows.filter((r) => !isTechnicalGloss(r.text));
  return general.length > 0 ? general : rows;
}
