import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import styles from "./user-nav.module.css";

/** 頁首右側：已登入顯示「我的單字」與帳號，未登入顯示登入連結。讀 session，需放在 Suspense 內 */
export async function UserNav() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <nav className={styles.nav}>
        <Link href="/login">登入</Link>
      </nav>
    );
  }
  return (
    <nav className={styles.nav}>
      <Link href="/review">複習</Link>
      <Link href="/saved">我的單字</Link>
      <Link href="/account" className={styles.account} title={user.email}>
        {user.name || user.email}
      </Link>
    </nav>
  );
}
