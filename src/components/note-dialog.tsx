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
import { type NoteTag, sameTags, tagIds } from "@/lib/note-tags";
import { TagPicker } from "./tag-picker";

// 編輯器較大，打開筆記視窗時才載入
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <div className="min-h-[18.5rem]" aria-hidden />,
});

type Props = {
  headword: string;
  note: string | null;
  tags: NoteTag[];
  /** 筆記內頁用：視窗標題寫出是哪個字（單字頁不需要，畫面上就是那個字） */
  compact?: { display: string };
  /** 由外面控制開關（筆記內頁的「⋯」選單）：不顯示自己的按鈕。外面在打開時才掛載，內容就會從目前存的開始 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** 筆記按鈕與對話框。筆記和收藏無關：沒收藏也能寫，不會順便收藏 */
export function NoteDialog({ headword, note, tags: savedTags, compact, open: openProp, onOpenChange: onOpenChangeProp }: Props) {
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => (controlled ? onOpenChangeProp?.(next) : setOpenState(next));
  const [draft, setDraft] = useState(note ?? "");
  const [tags, setTags] = useState(savedTags);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasNote = Boolean(note);
  const unchanged = draft.trim() === (note ?? "") && sameTags(tags, savedTags);

  const onOpenChange = (next: boolean) => {
    if (next) {
      // 每次打開都從目前存的筆記開始
      setDraft(note ?? "");
      setTags(savedTags);
      setError(null);
    }
    setOpen(next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveNoteAction(headword, draft, tagIds(tags));
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlled && (
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
      )}
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{compact ? `「${compact.display}」的筆記` : "筆記"}</DialogTitle>
        </DialogHeader>
        <div className="-mx-2 -my-2">
          <TagPicker value={tags} onChange={setTags} disabled={pending} />
        </div>
        <NoteEditor initial={note ?? ""} placeholder="輸入關於此單字的筆記" onChange={setDraft} />
        {/* 標籤跟著筆記：筆記清空就是刪除，標籤也會一起拿掉 */}
        {!draft.trim() && tags.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {hasNote ? "筆記清空後儲存會刪除這則筆記，標籤也會一起拿掉。" : "先寫一點筆記內容，標籤才能存下來。"}
          </p>
        )}
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
          <Button disabled={pending || unchanged || (!hasNote && !draft.trim())} onClick={save}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
