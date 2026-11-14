"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchBox } from "@/components/search-box";
import { SearchResultList } from "@/components/search-results";
import type { SearchResult } from "@/lib/dictionary";
import { normalizeHeadword } from "@/lib/headword";

/** 從 /word/xxx 取出使用者查的字；其他路徑回傳空字串 */
function queryFromPath(pathname: string) {
  const match = /^\/word\/([^/]+)$/.exec(pathname);
  if (!match) return "";
  try {
    return normalizeHeadword(decodeURIComponent(match[1]));
  } catch {
    return "";
  }
}

/**
 * 404 頁的內容。查不到單字時不是死路：搜尋框帶入原本的字，下面列出拼法相近的建議（模糊搜尋）。
 * not-found.tsx 拿不到網址參數，所以用 usePathname 在用戶端取得查詢字。
 */
export function WordNotFound() {
  const query = queryFromPath(usePathname());
  const [result, setResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then(setResult)
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      });
    return () => controller.abort();
  }, [query]);

  if (!query) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">找不到這個頁面</h1>
        <p className="text-muted-foreground">
          可以搜尋單字，或回到<Link href="/">首頁</Link>。
        </p>
        <SearchBox />
      </div>
    );
  }

  const suggestions = result?.items ?? [];
  return (
    <div className="flex flex-col gap-6">
      <SearchBox key={query} initialQuery={query} />
      <section className="flex flex-col gap-2" aria-live="polite">
        <h1 className="text-2xl font-semibold">字典裡沒有「{query}」</h1>
        {result && (
          <p className="text-sm text-muted-foreground">
            {suggestions.length > 0 ? "您是不是要找：" : "也沒有拼法相近的字，檢查一下拼字再查一次。"}
          </p>
        )}
      </section>
      {suggestions.length > 0 && <SearchResultList items={suggestions.slice(0, 8)} />}
    </div>
  );
}
