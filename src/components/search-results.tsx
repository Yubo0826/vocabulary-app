import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { SearchItem } from "@/lib/dictionary";
import { wordHref } from "@/lib/urls";

/** 搜尋結果清單：搜尋結果頁與「找不到單字」頁共用 */
export function SearchResultList({ items }: { items: SearchItem[] }) {
  return (
    <ul className="surface divide-y-2 divide-background overflow-hidden rounded-2xl">
      {items.map((item) => (
        <li key={item.headword}>
          <Link
            href={wordHref(item.headword, item.via === "form" ? item.form : undefined)}
            className="flex min-w-0 items-baseline gap-2 px-4 py-3 text-foreground hover:bg-foreground/8 hover:no-underline"
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
  );
}
