import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { listWordbooks } from "@/lib/user-data";
import { CreateWordbookDialog, WordbookManager } from "./wordbook-manager";

export const metadata = { title: "管理單字本" };

export default function WordbooksPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
      <Wordbooks />
    </Suspense>
  );
}

async function Wordbooks() {
  const user = await requireUser("/wordbooks");
  const wordbooks = await listWordbooks(user.id);
  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link href="/saved">← 我的單字</Link>
      </p>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">管理單字本</h1>
        <div className="ml-auto">
          <CreateWordbookDialog />
        </div>
      </div>
      <WordbookManager wordbooks={wordbooks} />
    </div>
  );
}
