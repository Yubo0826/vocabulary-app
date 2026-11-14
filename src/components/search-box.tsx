"use client";

import { History, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { recentLookupsAction, removeLookupAction } from "@/app/actions";
import type { SearchItem, SearchResult, WordSummary } from "@/lib/dictionary";
import { clearLocalLookups, readLocalLookups, removeLocalLookup } from "@/lib/lookup-history-local";
import { wordFromPath, wordHref } from "@/lib/urls";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

async function fetchSearch(q: string, signal?: AbortSignal): Promise<SearchResult> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error(`search failed: ${res.status}`);
  return res.json();
}

/** 在頁面任何地方（輸入框以外）按 / 跳到搜尋框 */
function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function SearchBox({
  initialQuery = "",
  autoFocus = false,
  size = "lg",
  hotkey = false,
  placeholder = "輸入英文單字或片語",
}: {
  initialQuery?: string;
  autoFocus?: boolean;
  /** lg：首頁、搜尋頁的 56px 搜尋列；md：單字頁頂端的 48px 精簡版 */
  size?: "lg" | "md";
  /** 啟用 / 快捷鍵（同一頁只能有一個搜尋框啟用） */
  hotkey?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [history, setHistory] = useState<WordSummary[] | null>(null); // 最近查過的字；聚焦時載入
  const inputRef = useRef<HTMLInputElement>(null);

  // Next.js（Cache Components）離開頁面時用 <Activity> 隱藏而不卸載，state 會被保留。
  // 隱藏時（effect cleanup）把輸入還原；再次顯示時（effect 重跑）重新聚焦，回到頁面就能直接打字。
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    return () => {
      setQuery(initialQuery);
      setResult(null);
      setOpen(false);
      setActive(-1);
      setHistory(null);
    };
  }, [autoFocus, initialQuery]);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  const trimmed = query.trim();
  const md = size === "md";

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

  // 輸入框是空的時候顯示查字歷史，有輸入時顯示即時提示
  const historyMode = !trimmed;
  const historyItems: SearchItem[] = (history ?? []).map((h) => ({ ...h, phonetic: null, via: "exact" }));
  const items = historyMode ? historyItems : result ? result.items : [];
  const showList = open && (historyMode ? historyItems.length > 0 : result !== null);

  /** 載入最近查過的字；順便把未登入時存在瀏覽器的歷史交給伺服器合併（合併成功就清掉暫存） */
  const loadHistory = () => {
    // 單字頁上不列出目前這個字。用 window.location 而不是 usePathname：後者在 Suspense 外會擋住預先渲染
    const exclude = wordFromPath(window.location.pathname);
    recentLookupsAction(readLocalLookups())
      .then(({ synced, items }) => {
        if (synced) clearLocalLookups();
        setHistory(items.filter((h) => h.headword !== exclude));
      })
      .catch(() => setHistory(null));
  };

  const removeFromHistory = (headword: string) => {
    setHistory((h) => h?.filter((x) => x.headword !== headword) ?? null);
    setActive(-1);
    removeLocalLookup(headword);
    removeLookupAction(headword).catch((err) => console.error(err));
    inputRef.current?.focus();
  };

  const go = (item: SearchItem) => {
    setOpen(false);
    router.push(wordHref(item.headword, item.via === "form" ? item.form : undefined));
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
    } else if (e.key === "Delete" && e.shiftKey && historyMode && items[active]) {
      // Shift+Delete：把選中的歷史項目移除（和瀏覽器網址列一樣）
      e.preventDefault();
      removeFromHistory(items[active].headword);
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
      <Search
        className={cn(
          "pointer-events-none absolute z-30 size-5 -translate-y-1/2 text-muted-foreground",
          md ? "top-6 left-4" : "top-7 left-4.5",
        )}
        aria-hidden
      />
      <Input
        ref={inputRef}
        className={cn(
          // Material 3 搜尋列沒有聚焦外框（游標就是聚焦提示）
          "relative z-20 rounded-full border-transparent bg-muted pr-5 focus-visible:border-transparent focus-visible:ring-0 dark:bg-muted",
          md ? "h-12 pl-11 text-base md:text-base" : "h-14 pl-12 text-[1.05rem] md:text-[1.05rem]",
          hotkey && "[@media(pointer:fine)]:pr-12",
        )}
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label="查詢單字"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
          if (!e.target.value.trim() && history === null) loadHistory();
        }}
        onKeyDown={onKeyDown}
        onFocus={() => {
          setOpen(true);
          if (!trimmed) loadHistory();
        }}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {hotkey && !query && (
        // 有實體鍵盤時提示快捷鍵；觸控裝置不顯示
        <kbd
          className={cn(
            "pointer-events-none absolute right-4 z-30 hidden -translate-y-1/2 rounded-sm border border-border px-1.5 font-mono text-xs leading-5 text-muted-foreground [@media(pointer:fine)]:block",
            md ? "top-6" : "top-7",
          )}
          aria-hidden
        >
          /
        </kbd>
      )}
      {showList && (
        // 清單卡片從輸入框頂端開始、墊在輸入框後面（同底色、同圓角），看起來是同一張卡片（Google 搜尋欄的做法）
        <div className={cn("absolute inset-x-0 top-0 z-10 overflow-hidden rounded-3xl bg-muted pb-2 text-foreground shadow-lg", md ? "pt-12" : "pt-14")}>
          <div className="mx-4 border-t" aria-hidden />
          {historyMode && <p className="px-4 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">最近查過</p>}
          {!historyMode && result?.matchType === "fuzzy" && (
            <p className="px-4 pt-2.5 pb-1 text-sm text-muted-foreground">找不到「{result.query}」，您是不是要找：</p>
          )}
          {!historyMode && items.length === 0 && <p className="px-4 pt-2.5 pb-1 text-sm text-muted-foreground">找不到相符的單字</p>}
          <ul id={listId} role="listbox">
            {items.map((item, i) => (
              <li
                key={item.headword}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // 選中列疊一層 state layer（Material 3 清單的 hover／選取樣式）
                className={cn(
                  "flex min-w-0 cursor-pointer items-baseline gap-2 px-4 py-2.5",
                  historyMode && "items-center py-1.5 pr-2",
                  i === active && "bg-foreground/8",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
              >
                {historyMode && <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="shrink-0 font-semibold">{item.display}</span>
                {item.via === "form" && (
                  <Badge variant="outline" className="shrink-0 border-primary text-primary">
                    {item.form} 的原形
                  </Badge>
                )}
                {item.gloss && <span className="min-w-0 truncate text-sm text-muted-foreground">{item.gloss}</span>}
                {historyMode && (
                  // 不進 Tab 順序（焦點要留在輸入框）；鍵盤用 Shift+Delete 移除
                  <button
                    type="button"
                    tabIndex={-1}
                    className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
                    aria-label={`從歷史移除「${item.display}」`}
                    title="從歷史移除"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item.headword);
                    }}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
