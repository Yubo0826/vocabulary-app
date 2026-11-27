/** 筆記標籤的共用規則與顏色（伺服器驗證與畫面都用，不可引入資料庫相關模組） */

export const MAX_TAGS_PER_NOTE = 10;
export const MAX_TAG_LENGTH = 20;

export type NoteTag = { id: string; name: string; color: TagColor };

/** 整理標籤名稱：去掉開頭的 #、頭尾與重複的空白；整理後是空字串代表不是有效名稱 */
export function normalizeTagName(raw: string): string {
  return raw.replace(/^[#＃]+/, "").trim().replace(/\s+/g, " ");
}

/** 標籤名稱是否相同（不分大小寫） */
export const tagKey = (name: string) => name.toLowerCase();

export const tagIds = (tags: NoteTag[]) => tags.map((t) => t.id);

/** 兩組標籤是否相同（同樣的標籤、同樣的順序），編輯視窗判斷有沒有改動用 */
export const sameTags = (a: NoteTag[], b: NoteTag[]) => a.length === b.length && a.every((t, i) => t.id === b[i].id);

/**
 * 標籤顏色（Notion 風格：淡底色＋深字）。class 要寫完整字串，Tailwind 才掃得到。
 * 新標籤依順序輪流配色（gray 留到最後，免得一開始都是灰的）
 */
export const TAG_COLORS = {
  blue: { label: "藍色", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-100" },
  green: { label: "綠色", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100" },
  orange: { label: "橘色", className: "bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-100" },
  purple: { label: "紫色", className: "bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100" },
  yellow: { label: "黃色", className: "bg-amber-100 text-amber-900 dark:bg-amber-800/50 dark:text-amber-100" },
  pink: { label: "粉紅色", className: "bg-pink-100 text-pink-900 dark:bg-pink-900/60 dark:text-pink-100" },
  brown: { label: "棕色", className: "bg-[#f1e6dd] text-[#5c3b23] dark:bg-[#4a3424] dark:text-[#f1e1d3]" },
  red: { label: "紅色", className: "bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100" },
  gray: { label: "灰色", className: "bg-stone-200/80 text-stone-800 dark:bg-stone-700/70 dark:text-stone-100" },
} as const;

export type TagColor = keyof typeof TAG_COLORS;

export const TAG_COLOR_NAMES = Object.keys(TAG_COLORS) as TagColor[];

export const isTagColor = (v: unknown): v is TagColor => typeof v === "string" && v in TAG_COLORS;

/** 資料庫裡不認得的顏色（例如日後拿掉的色）一律當灰色 */
export const tagColorClass = (color: string) => (isTagColor(color) ? TAG_COLORS[color] : TAG_COLORS.gray).className;
