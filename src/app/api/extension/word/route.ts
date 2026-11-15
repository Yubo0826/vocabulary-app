import { quickLookup } from "@/lib/dictionary";
import { forbidden, isExtensionRequest } from "@/lib/extension";

/**
 * 擴充元件的查字卡片：GET /api/extension/word?q=went
 * → { word: QuickLookup | null }（word 為 null 表示查無此字）。只查字，不需要登入；收藏在網站上做
 */
export async function GET(request: Request) {
  if (!isExtensionRequest(request)) return forbidden(request);
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const word = await quickLookup(q);
  return Response.json({ word }, { headers: { "Cache-Control": "no-store" } });
}
