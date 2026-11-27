"use client";

import { Pencil, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { createFreeNoteAction, updateFreeNoteAction } from "@/app/actions";
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
import { Input } from "@/components/ui/input";
import { type NoteTag, sameTags, tagIds } from "@/lib/note-tags";
import { TagPicker } from "./tag-picker";

// 編輯器較大，打開視窗時才載入
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <div className="min-h-[18.5rem]" aria-hidden />,
});

type Props = {
  /** 省略＝新增；有值＝編輯這筆 */
  note?: { id: string; title: string; note: string; tags: NoteTag[] };
  /** 由外面控制開關（例如從「⋯」選單打開）：不顯示自己的按鈕。外面在打開時才掛載，內容就會從目前存的開始 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * 自由筆記（不屬於任何單字，例如文法筆記）的新增／編輯視窗，筆記頁使用。
 * 標題必填。刪除在筆記內頁的「⋯」選單（note-actions.tsx）。單字筆記仍用 NoteDialog。
 */
export function FreeNoteDialog({ note, open: openProp, onOpenChange: onOpenChangeProp }: Props) {
  const controlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = controlled ? openProp : openState;
  const setOpen = (next: boolean) => (controlled ? onOpenChangeProp?.(next) : setOpenState(next));
  const [title, setTitle] = useState(note?.title ?? "");
  const [draft, setDraft] = useState(note?.note ?? "");
  const [tags, setTags] = useState(note?.tags ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(note);
  const unchanged =
    editing && title.trim() === note!.title && draft.trim() === note!.note && sameTags(tags, note!.tags);

  const onOpenChange = (next: boolean) => {
    if (next) {
      // 每次打開都從目前存的內容開始（新增則是空白）
      setTitle(note?.title ?? "");
      setDraft(note?.note ?? "");
      setTags(note?.tags ?? []);
      setError(null);
    }
    setOpen(next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = note
        ? await updateFreeNoteAction(note.id, title, draft, tagIds(tags))
        : await createFreeNoteAction(title, draft, tagIds(tags));
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!controlled && (
        <DialogTrigger asChild>
          {note ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`編輯「${note.title}」`}
              title="編輯筆記"
              className="text-muted-foreground"
            >
              <Pencil />
            </Button>
          ) : (
            <Button size="lg">
              <Plus /> 新增筆記
            </Button>
          )}
        </DialogTrigger>
      )}
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "編輯筆記" : "新增筆記"}</DialogTitle>
        </DialogHeader>
        <form
          id="free-note-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && !unchanged) save();
          }}
        >
          <Input
            autoFocus={!editing}
            value={title}
            maxLength={100}
            placeholder="標題，例如：現在完成式"
            aria-label="標題"
            className="h-10 text-base font-semibold"
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
          />
        </form>
        <div className="-mx-2 -my-2">
          <TagPicker value={tags} onChange={setTags} disabled={pending} />
        </div>
        <NoteEditor initial={note?.note ?? ""} placeholder="輸入筆記內容" onChange={setDraft} />
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
          <Button type="submit" form="free-note-form" disabled={pending || !title.trim() || unchanged}>
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
