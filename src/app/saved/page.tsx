import { Download } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { listSavedWords, listWordbooks, type SavedSort } from "@/lib/user-data";
import { isUuid } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { noteToPlainText } from "@/lib/note";
import { ImportDialog } from "./import-dialog";

export const metadata = { title: "我的單字" };

const dateFormat = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric" });

export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
      {searchParams.then(({ book, sort }) => (
        <SavedList bookParam={typeof book === "string" ? book : null} sort={sort === "alpha" ? "alpha" : "recent"} />
      ))}
    </Suspense>
  );
}

async function SavedList({ bookParam, sort }: { bookParam: string | null; sort: SavedSort }) {
  const user = await requireUser("/saved");
  const wordbooks = await listWordbooks(user.id);
  // 只接受自己的單字本；別人的或不存在的 id 一律當成「全部」
  const book = isUuid(bookParam) ? (wordbooks.find((b) => b.id === bookParam) ?? null) : null;
  const words = await listSavedWords(user.id, { wordbookId: book?.id ?? null, sort });

  const href = (params: { book?: string | null; sort?: SavedSort }) => {
    const q = new URLSearchParams();
    const b = params.book === undefined ? book?.id : params.book;
    const s = params.sort ?? sort;
    if (b) q.set("book", b);
    if (s !== "recent") q.set("sort", s);
    const qs = q.toString();
    return qs ? `/saved?${qs}` : "/saved";
  };

  const exportHref = `/api/export/words${href({}).slice("/saved".length)}`;
  const exportLabel = book ? `匯出「${book.name}」的單字` : "匯出所有單字";

  const chip = (on: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm text-foreground hover:border-primary hover:no-underline",
      on && "border-primary bg-accent font-semibold text-accent-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">我的單字</h1>
        <div className="flex items-center">
          <ImportDialog wordbooks={wordbooks.map(({ id, name }) => ({ id, name }))} defaultWordbookId={book?.id ?? null} />
          {/* 一般 <a>：下載檔案，不用 Link 的預先載入 */}
          <Button asChild variant="ghost" size="icon-lg" aria-label={exportLabel} title={exportLabel}>
            <a href={exportHref} download>
              <Download />
            </a>
          </Button>
          <Button asChild variant="ghost" className="text-primary">
            <Link href="/wordbooks">管理單字本</Link>
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="依單字本篩選">
        <Link href={href({ book: null })} className={chip(!book)}>
          全部
        </Link>
        {wordbooks.map((b) => (
          <Link key={b.id} href={href({ book: b.id })} className={chip(book?.id === b.id)}>
            {b.name} <span className="text-xs font-normal text-muted-foreground">{b.count}</span>
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>共 {words.length} 個字</span>
        <span className="flex gap-2.5">
          排序：
          {(["recent", "alpha"] as const).map((s) => (
            <Link
              key={s}
              href={href({ sort: s })}
              aria-current={sort === s ? "true" : undefined}
              className="aria-[current]:font-semibold aria-[current]:text-foreground"
            >
              {s === "recent" ? "收藏時間" : "字母"}
            </Link>
          ))}
        </span>
      </div>

      {words.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {book ? "這個單字本還沒有字。" : "還沒有收藏任何單字。查字時按「收藏」就會出現在這裡。"}
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {words.map((w) => (
            <li key={w.id}>
              <Link
                href={wordHref(w.headword)}
                className="flex flex-col gap-0.5 px-4 py-3 text-foreground hover:bg-accent hover:no-underline"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[1.05rem] font-semibold wrap-anywhere">{w.display}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(w.savedAt)}</span>
                </span>
                {w.gloss && <span className="truncate text-sm text-muted-foreground">{w.gloss}</span>}
                {w.note && <span className="line-clamp-2 text-sm wrap-anywhere">📝 {noteToPlainText(w.note)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
