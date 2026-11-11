"use client";

import { EllipsisVertical, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createWordbookAction, deleteWordbookAction, updateWordbookAction } from "@/app/actions";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Wordbook = { id: string; name: string; description: string | null; count: number };

const exportHref = (bookId?: string) => (bookId ? `/api/export/words?book=${bookId}` : "/api/export/words");

/**
 * 單字本磚塊：整塊連到「我的單字」的篩選，右上角 ⋮ 選單（編輯／匯出／刪除）。
 * 連結用 after:absolute 撐滿整塊，⋮ 按鈕疊在上面（z-10），兩者不巢狀。
 */
function Tile({
  href,
  name,
  count,
  description,
  strong,
  children,
}: {
  href: string;
  name: string;
  count: number;
  description?: string | null;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "relative flex min-h-26 flex-col gap-0.5 rounded-2xl p-4 pr-11 transition-transform has-[a:hover]:-translate-y-0.5",
        strong ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
      )}
    >
      <Link href={href} className="line-clamp-2 font-semibold text-inherit wrap-anywhere after:absolute after:inset-0 after:rounded-2xl hover:no-underline">
        {name}
      </Link>
      <span className="text-xs opacity-75">{count} 個字</span>
      {description && <span className="mt-1 line-clamp-2 text-xs opacity-75">{description}</span>}
      <div className="absolute top-2 right-2 z-10">{children}</div>
    </li>
  );
}

function MenuTrigger({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        className={cn(strong ? "text-primary-foreground hover:bg-white/15 hover:text-primary-foreground" : "hover:bg-card/60")}
      >
        <EllipsisVertical />
      </Button>
    </DropdownMenuTrigger>
  );
}

/** 一般 <a>：下載檔案，不用 Link 的預先載入 */
function ExportItem({ href }: { href: string }) {
  return (
    <DropdownMenuItem asChild>
      <a href={href} download className="text-inherit hover:no-underline">
        <Upload /> 匯出
      </a>
    </DropdownMenuItem>
  );
}

export function WordbookManager({ wordbooks, savedCount }: { wordbooks: Wordbook[]; savedCount: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Wordbook | null>(null);
  const [deleting, setDeleting] = useState<Wordbook | null>(null);

  const remove = (book: Wordbook) =>
    startTransition(async () => {
      setError(null);
      const result = await deleteWordbookAction(book.id);
      if (!result.ok) setError(result.error);
    });

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3">
        {/* 固定的第一格：所有收藏（包含沒放進任何單字本的字），只能匯出 */}
        <Tile href="/saved" name="全部收藏" count={savedCount} strong>
          <DropdownMenu>
            <MenuTrigger label="全部收藏的選項" strong />
            <DropdownMenuContent align="end">
              <ExportItem href={exportHref()} />
            </DropdownMenuContent>
          </DropdownMenu>
        </Tile>
        {wordbooks.map((b) => (
          <Tile key={b.id} href={`/saved?book=${b.id}`} name={b.name} count={b.count} description={b.description}>
            <DropdownMenu>
              <MenuTrigger label={`「${b.name}」的選項`} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={pending} onSelect={() => setEditing(b)}>
                  <Pencil /> 編輯
                </DropdownMenuItem>
                <ExportItem href={exportHref(b.id)} />
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => setDeleting(b)}>
                  <Trash2 /> 刪除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Tile>
        ))}
      </ul>
      {wordbooks.length === 0 && <p className="text-sm text-muted-foreground">還沒有單字本，按右上角的 ＋ 新增。</p>}

      <EditWordbookDialog book={editing} onClose={() => setEditing(null)} />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除「{deleting?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>裡面的字仍會保留在收藏中。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && remove(deleting)}>
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** ⋮ 選單的「編輯」：視窗內修改名稱與說明 */
function EditWordbookDialog({ book, onClose }: { book: Wordbook | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={book !== null}
      onOpenChange={(o) => {
        if (!o) {
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯單字本</DialogTitle>
          <DialogDescription className="sr-only">修改單字本的名稱與說明</DialogDescription>
        </DialogHeader>
        {book && (
          <WordbookForm
            key={book.id}
            initial={book}
            submitLabel="儲存"
            pending={pending}
            onSubmit={(name, description) =>
              startTransition(async () => {
                setError(null);
                const result = await updateWordbookAction(book.id, name, description);
                if (result.ok) onClose();
                else setError(result.error);
              })
            }
          />
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 標題列右側的「＋」：點開視窗新增單字本 */
export function CreateWordbookDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="新增單字本" title="新增單字本">
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增單字本</DialogTitle>
          <DialogDescription>一個字可以放進多本單字本。刪除單字本不會取消收藏。</DialogDescription>
        </DialogHeader>
        <WordbookForm
          submitLabel="新增單字本"
          pending={pending}
          onSubmit={(name, description) =>
            startTransition(async () => {
              setError(null);
              const result = await createWordbookAction(name, description);
              if (result.ok) setOpen(false);
              else setError(result.error);
            })
          }
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WordbookForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; description: string | null };
  submitLabel: string;
  pending: boolean;
  onSubmit: (name: string, description: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name, description);
      }}
    >
      <Input
        value={name}
        maxLength={50}
        placeholder="單字本名稱，例如：多益、影集"
        aria-label="單字本名稱"
        className="h-10 bg-card text-base md:text-sm"
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        value={description}
        maxLength={200}
        placeholder="說明（選填）"
        aria-label="說明"
        className="h-10 bg-card text-base md:text-sm"
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-1">
        <Button type="submit" size="lg" disabled={pending || !name.trim()}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
            取消
          </Button>
        )}
      </div>
    </form>
  );
}
