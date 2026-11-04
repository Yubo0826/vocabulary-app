import { searchDictionary } from "@/lib/dictionary";

/** 即時提示：GET /api/search?q=recieve → SearchResult（最多 10 筆） */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const result = await searchDictionary(q, 10);
  return Response.json(result);
}
