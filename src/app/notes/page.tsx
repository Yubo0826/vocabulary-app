import Link from "next/link";
import { Suspense } from "react";
import { FreeNoteDialog } from "@/components/free-note-dialog";
import { NoteContent } from "@/components/note-content";
import { NoteDialog } from "@/components/note-dialog";
import { PendingArea, PendingNavLink, PendingNavProvider } from "@/components/pending-nav";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { listNotes, type NoteKind, type NoteSort } from "@/lib/user-data";
import { cn } from "@/lib/utils";
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

const KINDS: { value: NoteKind; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "word", label: "單字筆記" },
  { value: "free", label: "自由筆記" },
];

type Params = { q: string; sort: NoteSort; kind: NoteKind };

/** 筆記頁網址：預設值（recent、all、空搜尋）不放進網址 */
function notesHref({ q, sort, kind }: Params) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (kind !== "all") params.set("kind", kind);
  if (sort !== "recent") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/notes?${qs}` : "/notes";
}

export default function NotesPage({ searchParams }: PageProps<"/notes">) {
  return (
    <Suspense fallback={<NotesSkeleton />}>
      {searchParams.then(({ q, sort, kind }) => (
        <NoteList
          q={typeof q === "string" ? q.slice(0, 100) : ""}
          sort={sort === "alpha" ? "alpha" : "recent"}
          kind={kind === "word" || kind === "free" ? kind : "all"}
        />
      ))}
    </Suspense>
  );
}

async function NoteList(params: Params) {
  const { q, sort, kind } = params;
  const user = await requireUser("/notes");
  const notes = await listNotes(user.id, { q, sort, kind });
  const href = (change: Partial<Params>) => notesHref({ ...params, ...change });

  const chipBase = "group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm hover:no-underline";
  const chip = cn(chipBase, "bg-accent text-accent-foreground hover:bg-accent/70");
  const chipOn = cn(chipBase, "bg-primary font-semibold text-primary-foreground hover:bg-primary");

  const empty = q.trim()
    ? "沒有符合的筆記。"
    : kind === "free"
      ? "還沒有自由筆記。按右上角的「新增筆記」，可以寫文法、片語等不屬於單一單字的筆記。"
      : kind === "word"
        ? "還沒有單字筆記。在單字頁按標題右側的筆記按鈕就可以寫。"
        : "還沒有筆記。在單字頁按標題右側的筆記按鈕，或按右上角的「新增筆記」就可以寫。";

  return (
    <PendingNavProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold">筆記</h1>
          <FreeNoteDialog />
        </div>

        <NotesSearch q={q} sort={sort} kind={kind} />

        <nav className="flex flex-wrap gap-2" aria-label="依筆記類型篩選">
          {KINDS.map((k) => (
            <PendingNavLink
              key={k.value}
              href={href({ kind: k.value })}
              param="kind"
              value={k.value === "all" ? "" : k.value}
              active={kind === k.value}
              className={chip}
              activeClassName={chipOn}
            >
              {k.label}
            </PendingNavLink>
          ))}
        </nav>

        <PendingArea fallback={<NotesListSkeleton />}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {q.trim() ? `找到 ${notes.length} 則` : `共 ${notes.length} 則`}
                {q.trim() && (
                  <>
                    {" · "}
                    <PendingNavLink href={href({ q: "" })} param="q" value="" active={false}>
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
                    href={href({ sort: s })}
                    param="sort"
                    value={s === "recent" ? "" : s}
                    active={sort === s}
                    activeClassName="font-semibold text-foreground"
                  >
                    {s === "recent" ? "最近更新" : "標題"}
                  </PendingNavLink>
                ))}
              </span>
            </div>

            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{empty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id} className="surface flex flex-col gap-1 rounded-2xl px-4 py-3">
                    {/* 標題、釋義、日期擠在同一行，清單比較好掃；釋義太長時截斷 */}
                    <div className="flex items-baseline gap-2">
                      {n.headword ? (
                        <>
                          <Link href={wordHref(n.headword)} className="min-w-0 text-[1.05rem] font-semibold wrap-anywhere">
                            {n.display}
                          </Link>
                          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{n.gloss}</span>
                        </>
                      ) : (
                        <h2 className="min-w-0 flex-1 text-[1.05rem] font-semibold wrap-anywhere">{n.display}</h2>
                      )}
                      <span className="-my-1 flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {dateFormat.format(n.updatedAt)}
                        {n.headword ? (
                          <NoteDialog headword={n.headword} note={n.note} compact={{ display: n.display }} />
                        ) : (
                          <FreeNoteDialog note={{ id: n.id, title: n.title ?? "", note: n.note }} />
                        )}
                      </span>
                    </div>
                    {/* 自由筆記可以只有標題 */}
                    {n.note && (
                      // 搜尋時命中的字可能在截斷的段落裡，直接展開
                      <CollapsibleNote key={q} defaultExpanded={!!q.trim()}>
                        <NoteContent markdown={n.note} className="text-sm" />
                      </CollapsibleNote>
                    )}
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
