import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { listWordbooks } from "@/lib/user-data";
import ui from "@/components/ui.module.css";
import { WordbookManager } from "./wordbook-manager";

export const metadata = { title: "管理單字本" };

export default function WordbooksPage() {
  return (
    <Suspense fallback={<p className={ui.muted}>載入中…</p>}>
      <Wordbooks />
    </Suspense>
  );
}

async function Wordbooks() {
  const user = await requireUser("/wordbooks");
  const wordbooks = await listWordbooks(user.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p>
        <Link href="/saved">← 我的單字</Link>
      </p>
      <h1 style={{ fontSize: "1.6rem" }}>管理單字本</h1>
      <p className={ui.muted}>一個字可以放進多本單字本。刪除單字本不會取消收藏。</p>
      <WordbookManager wordbooks={wordbooks} />
    </div>
  );
}
