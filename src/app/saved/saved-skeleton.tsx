import { Skeleton } from "@/components/ui/skeleton";

// 每列標題、釋義的寬度錯開，看起來比較像真的列表
const ROWS = [
  ["w-28", "w-3/5"],
  ["w-20", "w-2/3"],
  ["w-36", "w-1/2"],
  ["w-24", "w-3/4"],
  ["w-32", "w-2/5"],
  ["w-24", "w-3/5"],
];

/** 「我的單字」列表的骨架（含上方的字數、排序列） */
export function SavedWordsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <div className="flex items-center justify-between gap-2 py-0.5">
        <Skeleton className="h-4 w-16 bg-foreground/10" />
        <Skeleton className="h-4 w-36 bg-foreground/10" />
      </div>
      <ul className="surface divide-y-2 divide-background overflow-hidden rounded-2xl">
        {ROWS.map(([title, gloss], i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3.5">
            <span className="flex items-center justify-between gap-2">
              <Skeleton className={`h-5 ${title} bg-foreground/10`} />
              <Skeleton className="h-3 w-16 bg-foreground/10" />
            </span>
            <Skeleton className={`h-4 ${gloss} bg-foreground/10`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 第一次進頁面時的整頁骨架 */
export function SavedPageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <div className="flex h-9 items-center justify-between gap-2">
        <Skeleton className="h-7 w-28 bg-foreground/10" />
        <Skeleton className="h-8 w-40 bg-foreground/10" />
      </div>
      <div className="flex flex-wrap gap-2">
        {["w-14", "w-24", "w-20", "w-28"].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w} rounded-full bg-foreground/10`} />
        ))}
      </div>
      <SavedWordsSkeleton />
    </div>
  );
}
