import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

// 單字本名稱的寬度錯開，看起來比較像真的磚塊
const NAMES = ["w-20", "w-24", "w-16", "w-28", "w-20"];

/** 管理單字本頁載入中的骨架：返回連結與標題是固定內容直接顯示，按鈕與單字本磚塊是佔位 */
export function WordbooksSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <p>
        <Link href="/saved">← 我的單字</Link>
      </p>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">管理單字本</h1>
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="size-10 rounded-full bg-foreground/10" />
          <Skeleton className="size-10 rounded-full bg-foreground/10" />
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {/* 第一格是「全部收藏」，用主色；其餘是單字本 */}
        <li className="flex min-h-26 flex-col gap-2 rounded-2xl bg-primary/25 p-4">
          <Skeleton className="h-5 w-20 bg-primary/30" />
          <Skeleton className="h-3 w-12 bg-primary/30" />
        </li>
        {NAMES.map((w, i) => (
          <li key={i} className="flex min-h-26 flex-col gap-2 rounded-2xl bg-accent p-4">
            <Skeleton className={`h-5 ${w} bg-accent-foreground/10`} />
            <Skeleton className="h-3 w-12 bg-accent-foreground/10" />
          </li>
        ))}
      </ul>
    </div>
  );
}
