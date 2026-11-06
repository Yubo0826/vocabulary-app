import Link from "next/link";
import { Suspense } from "react";
import { NoteContent } from "@/components/note-content";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { listNotes, type NoteSort } from "@/lib/user-data";

export const metadata = { title: "筆記" };

const dateFormat = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric" });

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
      {searchParams.then(({ q, sort }) => (
        <NoteList q={typeof q === "string" ? q.slice(0, 100) : ""} sort={sort === "alpha" ? "alpha" : "recent"} />
      ))}
    </Suspense>
  );
}

async function NoteList({ q, sort }: { q: string; sort: NoteSort }) {
  const user = await requireUser("/notes");
  const notes = await listNotes(user.id, { q, sort });

  const href = (s: NoteSort) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (s !== "recent") params.set("sort", s);
    const qs = params.toString();
    return qs ? `/notes?${qs}` : "/notes";
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">筆記</h1>

      <form action="/notes" className="flex gap-2" role="search">
        <Input name="q" type="search" defaultValue={q} placeholder="搜尋筆記或單字" aria-label="搜尋筆記" className="h-9 flex-1" />
        {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
        <Button type="submit" variant="outline" size="lg">
          搜尋
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {q.trim() ? `找到 ${notes.length} 則` : `共 ${notes.length} 則`}
          {q.trim() && (
            <>
              {" · "}
              <Link href={sort === "recent" ? "/notes" : `/notes?sort=${sort}`}>清除搜尋</Link>
            </>
          )}
        </span>
        <span className="flex gap-2.5">
          排序：
          {(["recent", "alpha"] as const).map((s) => (
            <Link
              key={s}
              href={href(s)}
              aria-current={sort === s ? "true" : undefined}
              className="aria-[current]:font-semibold aria-[current]:text-foreground"
            >
              {s === "recent" ? "最近更新" : "字母"}
            </Link>
          ))}
        </span>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q.trim() ? "沒有符合的筆記。" : "還沒有筆記。在單字頁按標題右側的筆記按鈕就可以寫。"}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="flex flex-col gap-1.5 rounded-lg border bg-card px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={wordHref(n.headword)} className="text-[1.05rem] font-semibold wrap-anywhere">
                  {n.display}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(n.updatedAt)}</span>
              </div>
              {n.gloss && <p className="truncate text-sm text-muted-foreground">{n.gloss}</p>}
              <NoteContent markdown={n.note} className="text-sm" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
