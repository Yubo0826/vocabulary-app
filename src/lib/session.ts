/**
 * 伺服器端取得目前登入者。所有讀寫使用者資料的地方都必須透過這裡取得 user id，
 * 不可使用用戶端傳來的 user id。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "./auth";

export type CurrentUser = { id: string; name: string; email: string; image: string | null };

/** 目前登入者；未登入回傳 null */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Better Auth 檢查 session 時會用到 new Date()；先宣告這裡要等到實際請求才執行，
  // 否則 Cache Components 預先渲染時會回報「unstable value new Date()」
  await connection();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, image } = session.user;
  return { id, name, email, image: image ?? null };
}

/** 頁面用：未登入時導向登入頁，登入後回到 next */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
