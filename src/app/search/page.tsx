import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { searchDictionary } from "@/lib/dictionary";
import { wordHref } from "@/lib/urls";

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
      {items.length > 0 && (
        <ul className="surface divide-y-2 divide-background overflow-hidden rounded-2xl">
          {items.map((item) => (
            <li key={item.headword}>
              <Link
                href={wordHref(item.headword)}
                className="flex min-w-0 items-baseline gap-2 px-4 py-3 text-foreground hover:bg-accent hover:no-underline"
              >
                <span className="shrink-0 font-semibold">{item.display}</span>
                {item.via === "form" && (
                  <Badge variant="outline" className="shrink-0 border-primary text-primary">
                    {item.form} 的原形
                  </Badge>
                )}
                {item.gloss && <span className="min-w-0 truncate text-sm text-muted-foreground">{item.gloss}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
