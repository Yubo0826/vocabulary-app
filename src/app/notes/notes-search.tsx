"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePendingNav } from "@/components/pending-nav";

/**
 * 筆記搜尋列：送出時走 PendingNav，下方清單立刻換成骨架。
 * 輸入框以 q 當 key，清除搜尋或從其他地方換了 q 時，輸入框會重設成新的值。
 */
export function NotesSearch({ q, sort }: { q: string; sort: string }) {
  const { navigate } = usePendingNav();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const params = new URLSearchParams();
    const query = String(new FormData(e.currentTarget).get("q") ?? "").trim();
    if (query) params.set("q", query);
    if (sort !== "recent") params.set("sort", sort);
    const qs = params.toString();
    navigate(qs ? `/notes?${qs}` : "/notes");
  };

  return (
    <form action="/notes" onSubmit={submit} className="flex gap-2" role="search">
      <Input key={q} name="q" type="search" defaultValue={q} placeholder="搜尋筆記或單字" aria-label="搜尋筆記" className="h-9 flex-1" />
      <Button type="submit" variant="outline" size="lg">
        搜尋
      </Button>
    </form>
  );
}
