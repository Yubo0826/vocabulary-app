"use client";

import { NotebookPen } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { saveNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// 編輯器較大，打開筆記視窗時才載入
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <div className="min-h-[18.5rem]" aria-hidden />,
});

type Props = { headword: string; note: string | null };

/** 筆記按鈕與對話框。筆記和收藏無關：沒收藏也能寫，不會順便收藏 */
export function NoteDialog({ headword, note }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasNote = Boolean(note);
  const unchanged = draft.trim() === (note ?? "");

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(note ?? ""); // 每次打開都從目前存的筆記開始
      setError(null);
    }
    setOpen(next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNoteAction(headword, draft);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="soft"
          size="icon-lg"
          aria-label={hasNote ? "編輯筆記" : "新增筆記"}
          className={cn(hasNote && "text-primary")}
        >
          <NotebookPen />
        </Button>
      </DialogTrigger>
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>筆記</DialogTitle>
        </DialogHeader>
        <NoteEditor initial={note ?? ""} placeholder="輸入關於此單字的筆記" onChange={setDraft} />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={pending}>
              取消
            </Button>
          </DialogClose>
          <Button disabled={pending || unchanged} onClick={save}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
