"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { SearchItem, SearchResult } from "@/lib/dictionary";
import { wordHref } from "@/lib/urls";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

async function fetchSearch(q: string, signal?: AbortSignal): Promise<SearchResult> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json();
}

export function SearchBox({ initialQuery = "", autoFocus = false }: { initialQuery?: string; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim();

  // 輸入停頓 200ms 後才查詢；新的輸入會取消前一個請求
  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchSearch(trimmed, controller.signal)
        .then((r) => {
          setResult(r);
          setActive(-1);
        })
        .catch((err) => {
          if (err.name !== "AbortError") console.error(err);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const items = trimmed && result ? result.items : [];
  const showList = open && trimmed.length > 0 && result !== null;

  const go = (item: SearchItem) => {
    setOpen(false);
    router.push(wordHref(item.headword));
  };

  // Enter：選了提示就去那個字；完全符合或可還原原形時直接進單字頁；否則到搜尋結果頁
  const submit = async () => {
    if (active >= 0 && items[active]) return go(items[active]);
    if (!trimmed) return;
    const r = result?.query === trimmed.toLowerCase() ? result : await fetchSearch(trimmed).catch(() => null);
    const first = r?.items[0];
    if (first && (r.matchType === "exact" || r.matchType === "form")) return go(first);
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Input
        className="h-12 bg-card px-4 text-[1.05rem] md:text-[1.05rem]"
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder="輸入英文單字或片語"
        aria-label="查詢單字"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {showList && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-10 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
          {result.matchType === "fuzzy" && <p className="px-4 pt-2.5 pb-1 text-sm text-muted-foreground">找不到「{result.query}」，您是不是要找：</p>}
          {items.length === 0 && <p className="px-4 pt-2.5 pb-1 text-sm text-muted-foreground">找不到相符的單字</p>}
          <ul id={listId} role="listbox">
            {items.map((item, i) => (
              <li
                key={item.headword}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={cn("flex min-w-0 cursor-pointer items-baseline gap-2 px-4 py-2.5", i === active && "bg-accent")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
              >
                <span className="shrink-0 font-semibold">{item.display}</span>
                {item.via === "form" && (
                  <Badge variant="outline" className="shrink-0 border-primary text-primary">
                    {item.form} 的原形
                  </Badge>
                )}
                {item.gloss && <span className="min-w-0 truncate text-sm text-muted-foreground">{item.gloss}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
