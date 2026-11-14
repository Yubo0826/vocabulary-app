import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { SearchResultList } from "@/components/search-results";
import { searchDictionary } from "@/lib/dictionary";

export const metadata = { title: "搜尋" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">搜尋中…</p>}>
      {searchParams.then(({ q }) => {
        const query = typeof q === "string" ? q : "";
        return (
          <div className="flex flex-col gap-5">
            <SearchBox key={query} initialQuery={query} />
            <Results query={query} />
          </div>
        );
      })}
    </Suspense>
  );
}

async function Results({ query }: { query: string }) {
  if (!query.trim()) return null;
  const { query: normalized, matchType, items } = await searchDictionary(query, 30);

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {matchType === null && `找不到「${normalized}」相關的單字。`}
        {matchType === "fuzzy" && `找不到「${normalized}」，您是不是要找：`}
        {matchType && matchType !== "fuzzy" && `「${normalized}」的搜尋結果`}
      </p>
      {items.length > 0 && <SearchResultList items={items} />}
    </section>
  );
}
