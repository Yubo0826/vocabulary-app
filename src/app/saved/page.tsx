import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { listSavedWords, listWordbooks, type SavedSort } from "@/lib/user-data";
import { isUuid } from "@/lib/uuid";
import ui from "@/components/ui.module.css";
import styles from "./page.module.css";

export const metadata = { title: "我的單字" };

const dateFormat = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric" });

export default function SavedPage({ searchParams }: PageProps<"/saved">) {
  return (
    <Suspense fallback={<p className={ui.muted}>載入中…</p>}>
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

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <h1 className={styles.title}>我的單字</h1>
        <Link href="/wordbooks" className={ui.buttonGhost}>
          管理單字本
        </Link>
      </div>

      <nav className={styles.filters} aria-label="依單字本篩選">
        <Link href={href({ book: null })} className={!book ? `${styles.chip} ${styles.chipOn}` : styles.chip}>
          全部
        </Link>
        {wordbooks.map((b) => (
          <Link key={b.id} href={href({ book: b.id })} className={book?.id === b.id ? `${styles.chip} ${styles.chipOn}` : styles.chip}>
            {b.name} <span className={styles.count}>{b.count}</span>
          </Link>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <span className={ui.muted}>共 {words.length} 個字</span>
        <span className={styles.sort}>
          排序：
          <Link href={href({ sort: "recent" })} aria-current={sort === "recent" ? "true" : undefined}>
            收藏時間
          </Link>
          <Link href={href({ sort: "alpha" })} aria-current={sort === "alpha" ? "true" : undefined}>
            字母
          </Link>
        </span>
      </div>

      {words.length === 0 ? (
        <p className={ui.muted}>
          {book ? "這個單字本還沒有字。" : "還沒有收藏任何單字。查字時按「收藏」就會出現在這裡。"}
        </p>
      ) : (
        <ul className={styles.list}>
          {words.map((w) => (
            <li key={w.id}>
              <Link href={wordHref(w.headword)} className={styles.item}>
                <span className={styles.itemHead}>
                  <span className={styles.word}>{w.display}</span>
                  <span className={styles.date}>{dateFormat.format(w.savedAt)}</span>
                </span>
                {w.gloss && <span className={styles.gloss}>{w.gloss}</span>}
                {w.note && <span className={styles.note}>📝 {w.note}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
