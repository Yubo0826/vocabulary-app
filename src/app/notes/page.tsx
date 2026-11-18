import Link from "next/link";
import { Suspense } from "react";
import { NoteContent } from "@/components/note-content";
import { NoteDialog } from "@/components/note-dialog";
import { PendingArea, PendingNavLink, PendingNavProvider } from "@/components/pending-nav";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { listNotes, type NoteSort } from "@/lib/user-data";
import { CollapsibleNote } from "./collapsible-note";
import { NotesSearch } from "./notes-search";
import { NotesListSkeleton, NotesSkeleton } from "./notes-skeleton";

export const metadata = { title: "筆記" };

const dateFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <Suspense fallback={<NotesSkeleton />}>
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
    <PendingNavProvider>
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">筆記</h1>

        <NotesSearch q={q} sort={sort} />

        <PendingArea fallback={<NotesListSkeleton />}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {q.trim() ? `找到 ${notes.length} 則` : `共 ${notes.length} 則`}
                {q.trim() && (
                  <>
                    {" · "}
                    <PendingNavLink href={sort === "recent" ? "/notes" : `/notes?sort=${sort}`} param="q" value="" active={false}>
                      清除搜尋
                    </PendingNavLink>
                  </>
                )}
              </span>
              <span className="flex gap-2.5">
                排序：
                {(["recent", "alpha"] as const).map((s) => (
                  <PendingNavLink
                    key={s}
                    href={href(s)}
                    param="sort"
                    value={s === "recent" ? "" : s}
                    active={sort === s}
                    activeClassName="font-semibold text-foreground"
                  >
                    {s === "recent" ? "最近更新" : "字母"}
                  </PendingNavLink>
                ))}
              </span>
            </div>

            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{q.trim() ? "沒有符合的筆記。" : "還沒有筆記。在單字頁按標題右側的筆記按鈕就可以寫。"}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id} className="surface flex flex-col gap-1 rounded-2xl px-4 py-3">
                    {/* 單字、釋義、日期擠在同一行，清單比較好掃；釋義太長時截斷 */}
                    <div className="flex items-baseline gap-2">
                      <Link href={wordHref(n.headword)} className="min-w-0 text-[1.05rem] font-semibold wrap-anywhere">
                        {n.display}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{n.gloss}</span>
                      <span className="-my-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {dateFormat.format(n.updatedAt)}
                        <NoteDialog headword={n.headword} note={n.note} compact={{ display: n.display }} />
                      </span>
                    </div>
                    {/* 搜尋時命中的字可能在截斷的段落裡，直接展開 */}
                    <CollapsibleNote key={q} defaultExpanded={!!q.trim()}>
                      <NoteContent markdown={n.note} className="text-sm" />
                    </CollapsibleNote>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PendingArea>
      </div>
    </PendingNavProvider>
  );
}
