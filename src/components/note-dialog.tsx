"use client";

import { NotebookPen, Pencil } from "lucide-react";
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

type Props = {
  headword: string;
  note: string | null;
  /** 筆記頁清單用：較小的淡色按鈕，視窗標題寫出是哪個字（單字頁不需要，畫面上就是那個字） */
  compact?: { display: string };
};

/** 筆記按鈕與對話框。筆記和收藏無關：沒收藏也能寫，不會順便收藏 */
export function NoteDialog({ headword, note, compact }: Props) {
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
        {compact ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`編輯「${compact.display}」的筆記`}
            title="編輯筆記"
            className="text-muted-foreground"
          >
            <Pencil />
          </Button>
        ) : (
          <Button
            variant="soft"
            size="icon-lg"
            aria-label={hasNote ? "編輯筆記" : "新增筆記"}
            className={cn(hasNote && "text-primary")}
          >
            <NotebookPen />
          </Button>
        )}
      </DialogTrigger>
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{compact ? `「${compact.display}」的筆記` : "筆記"}</DialogTitle>
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
