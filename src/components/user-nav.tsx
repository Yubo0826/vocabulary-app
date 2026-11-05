import Link from "next/link";
import { getCurrentUser } from "@/lib/session";

const navLink = "text-foreground hover:text-primary hover:no-underline";

/** 頁首右側：已登入顯示「複習」「我的單字」與帳號，未登入顯示登入連結。讀 session，需放在 Suspense 內 */
export async function UserNav() {
  const user = await getCurrentUser();
  return (
    <nav className="ml-auto flex min-w-0 items-center gap-4 text-[0.95rem]">
      {user ? (
        <>
          <Link href="/review" className={navLink}>
            複習
          </Link>
          <Link href="/saved" className={navLink}>
            我的單字
          </Link>
          <Link
            href="/account"
            className="max-w-[10em] truncate text-muted-foreground hover:text-primary hover:no-underline"
            title={user.email}
          >
            {user.name || user.email}
          </Link>
        </>
      ) : (
        <Link href="/login">登入</Link>
      )}
    </nav>
  );
}
