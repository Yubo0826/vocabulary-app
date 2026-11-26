import { noteToPlainText } from "@/lib/note";
import { cn } from "@/lib/utils";

export const noteDateFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** 筆記類型的小標籤（論壇文章上方的分類）：單字筆記用主色，自由筆記用中性色 */
export function NoteKindLabel({ word }: { word: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-px text-[0.7rem] font-medium tracking-wide",
        word ? "bg-primary/12 text-primary-ink" : "bg-foreground/8 text-muted-foreground",
      )}
    >
      {word ? "單字筆記" : "自由筆記"}
    </span>
  );
}

const EXCERPT_LENGTH = 160;

/**
 * 清單的純文字摘要。搜尋時命中的字可能在後面，摘要改從命中處前一點開始，前面加「…」；
 * 長度只是上限，畫面上另外用 line-clamp 截成兩行
 */
export function noteExcerpt(markdown: string, q?: string): string {
  const text = noteToPlainText(markdown);
  const query = q?.trim().toLowerCase();
  const hit = query ? text.toLowerCase().indexOf(query) : -1;
  const start = hit > 40 ? hit - 20 : 0;
  const part = text.slice(start, start + EXCERPT_LENGTH);
  return (start > 0 ? "…" : "") + part + (start + EXCERPT_LENGTH < text.length ? "…" : "");
}
