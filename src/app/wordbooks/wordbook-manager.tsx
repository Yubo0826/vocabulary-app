"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { createWordbookAction, deleteWordbookAction, updateWordbookAction, type ActionResult } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Wordbook = { id: string; name: string; description: string | null; count: number };

export function WordbookManager({ wordbooks }: { wordbooks: Wordbook[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const act = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) onOk?.();
      else setError(result.error);
    });

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {wordbooks.length === 0 ? (
        <p className="text-sm text-muted-foreground">還沒有單字本，按右上角的 ＋ 新增。</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {wordbooks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              {editing === b.id ? (
                <WordbookForm
                  initial={b}
                  submitLabel="儲存"
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, description) =>
                    act(() => updateWordbookAction(b.id, name, description), () => setEditing(null))
                  }
                />
              ) : (
                <>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <Link href={`/saved?book=${b.id}`} className="font-semibold wrap-anywhere">
                      {b.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{b.count} 個字</span>
                    {b.description && <p className="basis-full text-sm text-muted-foreground">{b.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="text-primary" disabled={pending} onClick={() => setEditing(b.id)}>
                      編輯
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" className="text-primary" disabled={pending}>
                          刪除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>刪除「{b.name}」？</AlertDialogTitle>
                          <AlertDialogDescription>裡面的字仍會保留在收藏中。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onClick={() => act(() => deleteWordbookAction(b.id))}>
                            刪除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
