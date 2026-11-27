"use client";

import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteFreeNoteAction, saveNoteAction } from "@/app/actions";
import { FreeNoteDialog } from "@/components/free-note-dialog";
import { NoteDialog } from "@/components/note-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteTag } from "@/lib/note-tags";

type Props = {
  note: { id: string; headword: string | null; title: string | null; display: string; note: string; tags: NoteTag[] };
};

/**
 * 筆記內頁標題列右側的「⋯」選單：編輯、刪除（先確認，刪掉後回筆記清單）。
 * 單字筆記的刪除＝清空筆記（和在編輯視窗清空後儲存一樣）
 */
export function NoteActions({ note }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      setError(null);
      const result = note.headword ? await saveNoteAction(note.headword, null) : await deleteFreeNoteAction(note.id);
      if (result.ok) {
        setDeleting(false);
        router.replace("/notes"); // 用 replace：按上一頁不會回到已刪除的筆記
      } else setError(result.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="筆記選項" className="text-muted-foreground">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> 編輯
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setError(null);
              setDeleting(true);
            }}
          >
            <Trash2 /> 刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 打開時才掛載，每次都從目前存的內容開始 */}
      {editing &&
        (note.headword ? (
          <NoteDialog
            headword={note.headword}
            note={note.note}
            tags={note.tags}
            compact={{ display: note.display }}
            open
            onOpenChange={setEditing}
          />
        ) : (
          <FreeNoteDialog
            note={{ id: note.id, title: note.title ?? "", note: note.note, tags: note.tags }}
            open
            onOpenChange={setEditing}
          />
        ))}

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除「{note.display}」？</AlertDialogTitle>
            <AlertDialogDescription>刪除後無法復原。</AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            {/* 按鈕樣式和編輯視窗一致：取消是文字按鈕，主要動作是實心按鈕（刪除用紅色） */}
            <AlertDialogCancel variant="ghost" disabled={pending}>
              取消
            </AlertDialogCancel>
            {/* 用一般 Button 而不是 AlertDialogAction：後者用 Slot 合併 class，紅底蓋不過預設的主色底；
                另外也要等刪除完成再關，失敗時才能顯示錯誤 */}
            <Button
              className="bg-destructive text-black hover:bg-destructive/90 active:bg-destructive/80"
              disabled={pending}
              onClick={remove}
            >
              刪除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
