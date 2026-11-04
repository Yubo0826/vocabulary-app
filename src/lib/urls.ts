export const wordHref = (headword: string) => `/word/${encodeURIComponent(headword)}`;

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
