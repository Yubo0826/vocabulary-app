"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { createFreeNoteAction, deleteFreeNoteAction, updateFreeNoteAction } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

// 編輯器較大，打開視窗時才載入
const NoteEditor = dynamic(() => import("./note-editor"), {
  ssr: false,
  loading: () => <div className="min-h-[18.5rem]" aria-hidden />,
});

type Props = {
  /** 省略＝新增；有值＝編輯這筆 */
  note?: { id: string; title: string; note: string };
};

/**
 * 自由筆記（不屬於任何單字，例如文法筆記）的新增／編輯視窗，筆記頁使用。
 * 標題必填；編輯時可以刪除（先確認）。單字筆記仍用 NoteDialog。
 */
export function FreeNoteDialog({ note }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(note?.title ?? "");
  const [draft, setDraft] = useState(note?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(note);
  const unchanged = editing && title.trim() === note!.title && draft.trim() === note!.note;

  const onOpenChange = (next: boolean) => {
    if (next) {
      // 每次打開都從目前存的內容開始（新增則是空白）
      setTitle(note?.title ?? "");
      setDraft(note?.note ?? "");
      setError(null);
    }
    setOpen(next);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = note
        ? await updateFreeNoteAction(note.id, title, draft)
        : await createFreeNoteAction(title, draft);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteFreeNoteAction(note!.id);
      if (result.ok) {
        setConfirmDelete(false);
        setOpen(false);
      } else {
        setConfirmDelete(false);
        setError(result.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <NoteEditor initial={note?.note ?? ""} placeholder="輸入筆記內容" onChange={setDraft} />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter className="sm:items-center">
          {editing && (
            <Button
              variant="ghost"
              className="text-destructive sm:mr-auto"
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> 刪除
            </Button>
          )}
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除「{note?.title}」？</AlertDialogTitle>
            <AlertDialogDescription>刪除後無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
