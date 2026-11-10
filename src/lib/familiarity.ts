/**
 * 熟悉度（無／低／中／高）：不另外存欄位，一律由 en_zh 字卡的 FSRS 狀態換算，
 * 所以複習答對答錯會自動反映。單字頁手動調整時，會把字卡排程改成對應等級（見 review.ts 的 setFamiliarity）。
 *
 * 換算（stability ≒ 記憶保留 90% 的天數）：
 * - 無：沒收藏，或還是新卡
 * - 低：stability < 3 天（包含學習中、剛答錯）
 * - 中：3–21 天
 * - 高：≥ 21 天（同 Anki 的「熟練」）
 */
export const FAMILIARITY_LEVELS = [0, 1, 2, 3] as const;
export type Familiarity = (typeof FAMILIARITY_LEVELS)[number];

export const FAMILIARITY_LABELS: Record<Familiarity, string> = { 0: "無", 1: "低", 2: "中", 3: "高" };

/** 一眼看出等級的顏色（Tailwind 文字色，圓點用 fill-current）：無 = 灰、低 = 紫、中 = 黃、高 = 綠 */
export const FAMILIARITY_COLORS: Record<Familiarity, string> = {
  0: "text-muted-foreground",
  1: "text-violet-500",
  2: "text-amber-500",
  3: "text-emerald-500",
};

/** 手動調成某個等級時，字卡的 stability 與下次複習間隔（天）。低 = 今天就複習 */
export const FAMILIARITY_SCHEDULE: Record<Exclude<Familiarity, 0>, { stability: number; intervalDays: number }> = {
  1: { stability: 1, intervalDays: 0 },
  2: { stability: 7, intervalDays: 7 },
  3: { stability: 30, intervalDays: 30 },
};

const MEDIUM_FROM = 3;
const HIGH_FROM = 21;

export function familiarityOf(card: { state: number; stability: number } | null | undefined): Familiarity {
  if (!card || card.state === 0) return 0;
  if (card.stability >= HIGH_FROM) return 3;
  if (card.stability >= MEDIUM_FROM) return 2;
  return 1;
}

export function isFamiliarity(value: unknown): value is Familiarity {
  return FAMILIARITY_LEVELS.includes(value as Familiarity);
}
