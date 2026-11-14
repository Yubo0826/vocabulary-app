import { normalizeHeadword } from "./headword";

/** 單字頁網址；from = 使用者實際輸入的變化形（went → go），單字頁會顯示「went 是 go 的過去式」 */
export const wordHref = (headword: string, from?: string) =>
  `/word/${encodeURIComponent(headword)}${from ? `?from=${encodeURIComponent(from)}` : ""}`;

/** 從 /word/xxx 路徑取出單字（正規化後）；不是單字頁時回傳空字串 */
export function wordFromPath(pathname: string): string {
  const match = /^\/word\/([^/]+)$/.exec(pathname);
  if (!match) return "";
  try {
    return normalizeHeadword(decodeURIComponent(match[1]));
  } catch {
    return "";
  }
}

/** 登入後要回到的路徑：只接受站內相對路徑，避免 open redirect */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}

export const tatoebaSentenceUrl = (id: number) => `https://tatoeba.org/zh-tw/sentences/show/${id}`;

export const tatoebaUserUrl = (username: string) =>
  `https://tatoeba.org/zh-tw/user/profile/${encodeURIComponent(username)}`;
