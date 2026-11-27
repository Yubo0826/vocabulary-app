"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePendingNav } from "@/components/pending-nav";

/**
 * 筆記搜尋列：送出時走 PendingNav，下方清單立刻換成骨架；保留目前的類型、標籤篩選與排序。
 * 輸入框以 q 當 key，清除搜尋或從其他地方換了 q 時，輸入框會重設成新的值。
 */
export function NotesSearch({ q, sort, kind, tag }: { q: string; sort: string; kind: string; tag: string }) {
  const { navigate } = usePendingNav();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (query) params.set("q", query);
    if (kind !== "all") params.set("kind", kind);
    if (tag) params.set("tag", tag);
    if (sort !== "recent") params.set("sort", sort);
    const qs = params.toString();
    navigate(qs ? `/notes?${qs}` : "/notes");
  };

  return (
    <form action="/notes" onSubmit={submit} className="flex gap-2" role="search">
      {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
      {tag && <input type="hidden" name="tag" value={tag} />}
      {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
      <Input
        key={q}
        name="q"
        type="search"
        defaultValue={q}
        placeholder="搜尋筆記、單字、標題或標籤"
        aria-label="搜尋筆記"
        className="h-9 flex-1"
      />
      <Button type="submit" variant="outline" size="lg">
        搜尋
      </Button>
    </form>
  );
}
