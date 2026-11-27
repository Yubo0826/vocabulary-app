import Link from "next/link";
import { TagChip } from "@/components/tag-chip";
import { noteToPlainText } from "@/lib/note";
import type { NoteTag } from "@/lib/note-tags";
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

/** 筆記頁依標籤篩選的網址 */
export const noteTagHref = (tag: string) => `/notes?tag=${encodeURIComponent(tag)}`;

/**
 * 筆記的標籤（#文法 #片語），點了到筆記頁篩選這個標籤。
 * 清單卡片整張是連結（stretched link），標籤要 relative z-10 才點得到自己
 */
export function NoteTagLinks({ tags, className }: { tags: NoteTag[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 flex-wrap gap-1.5", className)}>
      {tags.map((t) => (
        <Link
          key={t.id}
          href={noteTagHref(t.name)}
          title={`篩選「${t.name}」`}
          className="relative z-10 flex max-w-full rounded-md hover:no-underline hover:brightness-95 dark:hover:brightness-125"
        >
          <TagChip name={t.name} color={t.color} />
        </Link>
      ))}
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
