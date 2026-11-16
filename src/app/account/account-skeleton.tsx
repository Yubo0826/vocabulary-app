import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** 帳號頁載入中的骨架：標題與欄位名稱是固定文字直接顯示，只有使用者資料與按鈕是佔位 */
export function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="載入中">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">帳號</h1>
        <Skeleton className="ml-auto h-8 w-16 rounded-full bg-foreground/10" />
      </div>
      <Card className="px-4">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-base">
          <dt className="text-muted-foreground">暱稱</dt>
          <dd className="flex h-8 items-center">
            <Skeleton className="h-5 w-28 bg-foreground/10" />
          </dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="flex h-6 items-center">
            <Skeleton className="h-5 w-48 max-w-full bg-foreground/10" />
          </dd>
          <dt className="text-muted-foreground">登入方式</dt>
          <dd className="flex h-6 items-center">
            <Skeleton className="h-5 w-24 bg-foreground/10" />
          </dd>
        </dl>
      </Card>
      <Card className="gap-3 px-4">
        <h2 className="text-[1.05rem] font-semibold">刪除帳號</h2>
        <p className="text-sm text-muted-foreground">刪除後，你的收藏、筆記、單字本、字卡與複習紀錄會全部永久刪除，無法復原。</p>
        <Skeleton className="h-10 w-32 rounded-full bg-foreground/10" />
      </Card>
    </div>
  );
}
