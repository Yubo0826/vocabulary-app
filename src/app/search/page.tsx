import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { searchDictionary } from "@/lib/dictionary";
import { wordHref } from "@/lib/urls";
import styles from "./page.module.css";

export const metadata = { title: "搜尋" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={<p className={styles.muted}>搜尋中…</p>}>
      {searchParams.then(({ q }) => {
        const query = typeof q === "string" ? q : "";
        return (
          <div className={styles.page}>
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
    <section>
      <p className={styles.muted}>
        {matchType === null && `找不到「${normalized}」相關的單字。`}
        {matchType === "fuzzy" && `找不到「${normalized}」，您是不是要找：`}
        {matchType && matchType !== "fuzzy" && `「${normalized}」的搜尋結果`}
      </p>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.headword}>
            <Link href={wordHref(item.headword)} className={styles.item}>
              <span className={styles.word}>{item.display}</span>
              {item.via === "form" && <span className={styles.badge}>{item.form} 的原形</span>}
              {item.gloss && <span className={styles.gloss}>{item.gloss}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
