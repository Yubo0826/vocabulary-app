import { forbidden, isExtensionRequest } from "@/lib/extension";
import { getCurrentUser } from "@/lib/session";
import { NotFoundError, saveWord, unsaveWord, ValidationError } from "@/lib/user-data";

/**
 * 擴充元件的收藏按鈕：POST /api/extension/save
 * body: { headword, saved: true, contextUrl?, contextSentence? } 收藏（並記錄出處）／{ headword, saved: false } 取消收藏
 * user id 一律從 session 取得。
 */
export async function POST(request: Request) {
  if (!isExtensionRequest(request)) return forbidden(request);
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "請先登入 Moji" }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "格式錯誤" }, { status: 400 });
  const { headword, saved, contextUrl, contextSentence } = body as Record<string, unknown>;
  if (typeof headword !== "string" || typeof saved !== "boolean") {
    return Response.json({ error: "格式錯誤" }, { status: 400 });
  }
  const optional = (v: unknown) => (typeof v === "string" ? v : null);

  try {
    if (saved) {
      await saveWord(user.id, headword, undefined, { url: optional(contextUrl), sentence: optional(contextSentence) });
    } else {
      await unsaveWord(user.id, headword).catch((err) => {
        if (!(err instanceof NotFoundError)) throw err; // 本來就沒收藏：視為成功
      });
    }
    return Response.json({ saved });
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 });
    if (err instanceof NotFoundError) return Response.json({ error: "字典裡沒有這個字" }, { status: 404 });
    console.error(err);
    return Response.json({ error: "發生錯誤，請稍後再試" }, { status: 500 });
  }
}
