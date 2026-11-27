import Link from "next/link";
import { cache } from "react";
import { NotebookPen, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { getSaveState } from "@/lib/user-data";
import { FamiliarityPicker } from "./familiarity-picker";
import { NoteContent } from "./note-content";
import { NoteDialog } from "./note-dialog";
import { SaveDialog } from "./save-dialog";

/** 同一次請求中，收藏按鈕、筆記按鈕與筆記內容共用同一份查詢結果 */
const loadSaveState = cache(async (headword: string) => {
  const user = await getCurrentUser();
  if (!user) return null;
  return getSaveState(user.id, headword);
});

const loginHref = (headword: string) => `/login?next=${encodeURIComponent(wordHref(headword))}`;

/** 單字標題列右側的收藏按鈕：未登入時導向登入。讀 session，需放在 Suspense 內 */
export async function SaveButton({ headword }: { headword: string }) {
  const state = await loadSaveState(headword);
  if (!state) {
    return (
      <Button asChild variant="soft" size="icon-lg" aria-label="登入後收藏">
        <Link href={loginHref(headword)}>
          <Star />
        </Link>
      </Button>
    );
  }
  return (
    <SaveDialog
      headword={headword}
      saved={state.saved}
      wordbooks={state.wordbooks}
      recentWordbookId={state.recentWordbookId}
    />
  );
}

/** 單字標題列右側的筆記按鈕：未登入時導向登入。讀 session，需放在 Suspense 內 */
export async function NoteButton({ headword }: { headword: string }) {
  const state = await loadSaveState(headword);
  if (!state) {
    return (
      <Button asChild variant="soft" size="icon-lg" aria-label="登入後寫筆記">
        <Link href={loginHref(headword)}>
          <NotebookPen />
        </Link>
      </Button>
    );
  }
  return <NoteDialog headword={headword} note={state.note} tags={state.noteTags} />;
}

/** 單字標題列最右的熟悉度圓點；只有收藏的字才有（熟悉度是字卡的排程），未登入或沒收藏時不顯示。讀 session，需放在 Suspense 內 */
export async function FamiliarityControl({ headword }: { headword: string }) {
  const state = await loadSaveState(headword);
  if (!state?.saved) return null;
  return <FamiliarityPicker headword={headword} level={state.familiarity} />;
}

/** 「筆記」分頁標題旁的小圓點：這個字有筆記時才顯示。讀 session，需放在 Suspense 內 */
export async function NoteTabDot({ headword }: { headword: string }) {
  const note = (await loadSaveState(headword))?.note;
  if (!note) return null;
  return <span role="img" aria-label="有筆記" className="size-1.5 shrink-0 rounded-full bg-primary" />;
}

/** 單字頁「筆記」分頁的內容：顯示筆記；沒有筆記、未登入時各自給一句提示。編輯在標題列筆記按鈕的視窗裡。讀 session，需放在 Suspense 內 */
export async function NoteTab({ headword }: { headword: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <p className="surface rounded-2xl px-4 py-5 text-sm text-muted-foreground">
        <Link href={loginHref(headword)}>登入</Link>後可以寫筆記
      </p>
    );
  }
  const note = (await loadSaveState(headword))?.note;
  if (!note) return <p className="surface rounded-2xl px-4 py-5 text-sm text-muted-foreground">目前沒有筆記</p>;
  return (
    <section aria-label="我的筆記" className="surface rounded-2xl p-4 sm:p-5">
      <NoteContent markdown={note} />
    </section>
  );
}
