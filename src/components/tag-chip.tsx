import { tagColorClass } from "@/lib/note-tags";
import { cn } from "@/lib/utils";

/** 筆記標籤的彩色小膠囊（Notion 風格），顏色見 lib/note-tags.ts 的 TAG_COLORS */
export function TagChip({
  name,
  color,
  className,
  children,
}: {
  name: string;
  color: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-md px-1.5 py-px text-[0.8125rem] leading-5",
        tagColorClass(color),
        className,
      )}
    >
      <span className="truncate">{name}</span>
      {children}
    </span>
  );
}
