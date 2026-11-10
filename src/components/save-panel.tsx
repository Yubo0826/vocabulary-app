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
      <Button asChild variant="ghost" size="icon-lg" aria-label="登入後收藏">
        <Link href={loginHref(headword)}>
          <Star />
        </Link>
      </Button>
    );
  }
  return <SaveDialog headword={headword} saved={state.saved !== null} wordbooks={state.wordbooks} />;
}

/** 單字標題列右側的筆記按鈕：未登入時導向登入。讀 session，需放在 Suspense 內 */
export async function NoteButton({ headword }: { headword: string }) {
  const state = await loadSaveState(headword);
  if (!state) {
    return (
      <Button asChild variant="ghost" size="icon-lg" aria-label="登入後寫筆記">
        <Link href={loginHref(headword)}>
          <NotebookPen />
        </Link>
      </Button>
    );
  }
  return <NoteDialog headword={headword} note={state.saved?.note ?? null} saved={state.saved !== null} />;
}

/** 單字標題列最右的熟悉度圓點；未登入時不顯示。讀 session，需放在 Suspense 內 */
export async function FamiliarityControl({ headword }: { headword: string }) {
  const state = await loadSaveState(headword);
  if (!state) return null;
  return <FamiliarityPicker headword={headword} level={state.familiarity} />;
}

/** 單字頁上顯示的筆記內容；沒有筆記（或未登入）時不顯示。編輯在筆記按鈕的視窗裡 */
export async function NotePreview({ headword }: { headword: string }) {
  const note = (await loadSaveState(headword))?.saved?.note;
  if (!note) return null;
  return (
    <section aria-label="我的筆記" className="rounded-lg border bg-muted/40 px-3 py-2.5">
      <h2 className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <NotebookPen className="size-3.5" aria-hidden /> 我的筆記
      </h2>
      <NoteContent markdown={note} className="text-sm" />
    </section>
  );
}
