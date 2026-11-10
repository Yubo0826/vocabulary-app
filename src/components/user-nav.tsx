import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

const navLink = "shrink-0 text-foreground hover:text-primary hover:no-underline";

/**
 * 頁首：已登入顯示「複習」「我的單字」「筆記」與帳號，未登入顯示登入連結。讀 session，需放在 Suspense 內。
 * 回傳兩個元素，直接排在頁首的 flex-wrap 容器裡：
 * - 手機：導航用 order-last + 滿寬換到第二列，帳號留在第一列右側（與 Logo 同列）
 * - sm 以上：導航、帳號、明暗切換排成一列
 */
export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="ml-auto">
        登入
      </Link>
    );
  }
  return (
    <>
      <nav
        aria-label="主要"
        className="order-last flex basis-full items-center gap-5 pb-2.5 text-[0.95rem] sm:order-none sm:ml-auto sm:basis-auto sm:gap-4 sm:pb-0"
      >
        <Link href="/review" className={navLink}>
          複習
        </Link>
        <Link href="/saved" className={navLink}>
          我的單字
        </Link>
        <Link href="/notes" className={navLink}>
          筆記
        </Link>
      </nav>
      <Link
        href="/account"
        className="ml-auto max-w-[10em] min-w-0 truncate text-[0.95rem] text-muted-foreground hover:text-primary hover:no-underline sm:ml-1"
        title={user.email}
      >
        {user.name || user.email}
      </Link>
    </>
  );
}
