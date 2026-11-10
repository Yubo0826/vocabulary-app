/**
 * 匯出收藏的單字：純文字，每行一個字（可再匯入，也能貼進 Anki、Quizlet）。
 * 由「管理單字本」各單字本的「匯出」按鈕使用。
 * 參數：book（單字本 id，只接受自己的；省略則匯出全部收藏）、sort（recent | alpha，預設 recent）。
 */
import { getCurrentUser } from "@/lib/session";
import { listSavedWords, listWordbooks } from "@/lib/user-data";
import { isUuid } from "@/lib/uuid";

const dateStamp = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }); // YYYY-MM-DD

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("請先登入", { status: 401 });

  const params = new URL(request.url).searchParams;
  const bookParam = params.get("book");
  const book = isUuid(bookParam) ? ((await listWordbooks(user.id)).find((b) => b.id === bookParam) ?? null) : null;
  if (bookParam && !book) return new Response("找不到單字本", { status: 404 });

  const words = await listSavedWords(user.id, {
    wordbookId: book?.id ?? null,
    sort: params.get("sort") === "alpha" ? "alpha" : "recent",
  });
  const body = words.map((w) => w.display).join("\r\n") + (words.length ? "\r\n" : "");
  const filename = `單字-${book?.name ?? "全部"}-${dateStamp.format(new Date())}.txt`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="vocabulary.txt"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
