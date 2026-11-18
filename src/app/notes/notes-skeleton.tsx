import { Skeleton } from "@/components/ui/skeleton";

// 每則的標題、釋義、筆記行寬錯開，看起來比較像真的清單
const ROWS = [
  { title: "w-28", gloss: "w-1/2", lines: ["w-full", "w-3/4"] },
  { title: "w-20", gloss: "w-2/5", lines: ["w-5/6"] },
  { title: "w-32", gloss: "w-3/5", lines: ["w-full", "w-2/3"] },
  { title: "w-24", gloss: "w-1/3", lines: ["w-3/4"] },
];

/** 筆記清單的骨架（含上方的筆數、排序列）；切換排序、搜尋時也用這個 */
export function NotesListSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <div className="flex items-center justify-between gap-2 py-0.5">
        <Skeleton className="h-4 w-14 bg-foreground/10" />
        <Skeleton className="h-4 w-36 bg-foreground/10" />
      </div>
      <ul className="flex flex-col gap-3">
        {ROWS.map((r, i) => (
          <li key={i} className="surface flex flex-col gap-2 rounded-2xl px-4 py-3.5">
            {/* 單字、釋義、日期同一行，和實際清單一致 */}
            <span className="flex items-center gap-2">
              <Skeleton className={`h-5 ${r.title} shrink-0 bg-foreground/10`} />
              <span className="min-w-0 flex-1">
                <Skeleton className={`h-4 ${r.gloss} bg-foreground/10`} />
              </span>
              <Skeleton className="h-3 w-16 shrink-0 bg-foreground/10" />
            </span>
            {r.lines.map((w, j) => (
              <Skeleton key={j} className={`h-4 ${w} bg-foreground/10`} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 第一次進筆記頁時的整頁骨架：標題、搜尋列、清單 */
export function NotesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <Skeleton className="h-8 w-16 bg-foreground/10" />
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 bg-foreground/10" />
        <Skeleton className="h-10 w-16 rounded-full bg-foreground/10" />
      </div>
      <NotesListSkeleton />
    </div>
  );
}
