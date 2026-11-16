import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// 未來 7 天長條的高度錯開，看起來比較像真的圖表
const BARS = ["h-[55%]", "h-[30%]", "h-[42%]", "h-[18%]", "h-[36%]", "h-[24%]", "h-[12%]"];

/** 複習頁載入中的骨架：今日剩餘、進度條、題目卡與統計卡，版面與 ReviewSession 對齊 */
export function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="載入中">
      <div className="flex min-h-8 items-center gap-3.5">
        <Skeleton className="h-4 w-14 bg-foreground/10" />
        <Skeleton className="h-4 w-16 bg-foreground/10" />
        <Skeleton className="h-4 w-14 bg-foreground/10" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-1.5 flex-1 rounded-full bg-foreground/10" />
        <Skeleton className="h-3 w-8 bg-foreground/10" />
      </div>

      <Card className="gap-5 p-3 sm:p-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-accent px-3 py-9">
          <Skeleton className="h-5 w-12 rounded-full bg-accent-foreground/10" />
          <Skeleton className="h-12 w-48 bg-accent-foreground/10" />
          <Skeleton className="h-5 w-32 bg-accent-foreground/10" />
        </div>
        <Skeleton className="h-12 w-full rounded-full bg-foreground/10" />
      </Card>

      <Card className="gap-4 px-4">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20 bg-foreground/10" />
              <Skeleton className="h-7 w-10 bg-foreground/10" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 bg-foreground/10" />
          <div className="grid h-30 grid-cols-7 items-end gap-1.5">
            {BARS.map((h, i) => (
              <Skeleton key={i} className={`mx-auto w-full max-w-7 rounded-b-none bg-foreground/10 ${h}`} />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
