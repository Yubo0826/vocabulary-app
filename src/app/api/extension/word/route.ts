import { quickLookup } from "@/lib/dictionary";
import { forbidden, isExtensionRequest } from "@/lib/extension";
import { getCurrentUser } from "@/lib/session";
import { isSaved } from "@/lib/user-data";

/**
 * 擴充元件的查字卡片：GET /api/extension/word?q=went
 * → { word: QuickLookup | null, loggedIn, saved }（word 為 null 表示查無此字）
 */
export async function GET(request: Request) {
  if (!isExtensionRequest(request)) return forbidden(request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const [word, user] = await Promise.all([quickLookup(q), getCurrentUser()]);
  const saved = word && user ? await isSaved(user.id, word.headword) : false;
  return Response.json({ word, loggedIn: user !== null, saved }, { headers: { "Cache-Control": "no-store" } });
}
