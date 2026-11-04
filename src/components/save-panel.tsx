import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";
import { getSaveState } from "@/lib/user-data";
import { SaveControls } from "./save-controls";
import ui from "./ui.module.css";

/** 單字頁的收藏區塊：未登入時引導登入。讀 session，需放在 Suspense 內 */
export async function SavePanel({ headword }: { headword: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(wordHref(headword))}`} className={ui.button}>
        ☆ 登入後收藏
      </Link>
    );
  }
  const state = await getSaveState(user.id, headword);
  return <SaveControls headword={headword} saved={state.saved} wordbooks={state.wordbooks} />;
}
