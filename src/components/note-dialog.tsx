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

type Props = { headword: string; note: string | null; saved: boolean };

/** 筆記按鈕與對話框。這個字還沒收藏時，儲存筆記會一併收藏 */
export function NoteDialog({ headword, note, saved }: Props) {
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
          className={cn("relative", hasNote && "text-primary")}
        >
          <NotebookPen />
          {hasNote && <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" aria-hidden />}
        </Button>
      </DialogTrigger>
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>筆記</DialogTitle>
        </DialogHeader>
        <NoteEditor initial={note ?? ""} placeholder="「思考會以螺旋式成長，而活用內在資產就從記錄開始。」 —— 金翼漢《巨人的筆記》" onChange={setDraft} />
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
          {/* 沒收藏又沒寫內容時不送出，避免只為了空筆記而收藏 */}
          <Button disabled={pending || unchanged || (!saved && !draft.trim())} onClick={save}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
