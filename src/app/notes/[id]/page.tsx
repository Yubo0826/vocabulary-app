import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { NoteContent } from "@/components/note-content";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { getNote } from "@/lib/user-data";
import { isUuid } from "@/lib/uuid";
import { NoteKindLabel, NoteTagLinks, noteDateFormat } from "../note-meta";
import { NoteActions } from "./note-actions";

export const metadata: Metadata = { title: "筆記" };

/** 筆記內頁：一筆筆記的全文（論壇的文章頁）。單字筆記另外連到單字頁 */
export default function NotePage({ params }: PageProps<"/notes/[id]">) {
  return (
    <article className="flex flex-col gap-5">
      <Link href="/notes" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        返回列表
      </Link>
      <Suspense fallback={<NoteSkeleton />}>{params.then(({ id }) => <NoteBody id={id} />)}</Suspense>
    </article>
  );
}

async function NoteBody({ id }: { id: string }) {
  if (!isUuid(id)) notFound();
  const user = await requireUser(`/notes/${id}`);
  const note = await getNote(user.id, id);
  // 在這頁刪除或清空筆記後，重新整理時就回到清單
  if (!note) redirect("/notes");

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <NoteKindLabel word={Boolean(note.headword)} />
          <span>
            更新於 <time dateTime={note.updatedAt.toISOString()}>{noteDateFormat.format(note.updatedAt)}</time>
          </span>
          <span className="-my-2 ml-auto">
            <NoteActions note={note} />
          </span>
        </div>
        <h1 className="text-2xl leading-snug font-semibold wrap-anywhere">{note.display}</h1>
        <NoteTagLinks tags={note.tags} className="text-sm" />
        {note.headword && (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {note.gloss && <span>{note.gloss}</span>}
            <Link href={wordHref(note.headword)} className="ml-auto shrink-0">
              查看單字頁
            </Link>
          </p>
        )}
      </header>

      {note.note ? (
        <section aria-label="筆記內容" className="surface rounded-2xl p-5">
          <NoteContent markdown={note.note} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">這則筆記只有標題，按右上角的鉛筆可以加上內容。</p>
      )}
    </>
  );
}

function NoteSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="載入中">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40 bg-foreground/10" />
        <Skeleton className="h-8 w-56 bg-foreground/10" />
      </div>
      <div className="surface flex flex-col gap-2.5 rounded-2xl p-5">
        {["w-full", "w-5/6", "w-full", "w-2/3"].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w} bg-foreground/10`} />
        ))}
      </div>
    </div>
  );
}
