"use client";

import { Plus, Star } from "lucide-react";
import { useState, useTransition } from "react";
import { createWordbookAction, saveToWordbooksAction, unsaveWordAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  headword: string;
  saved: boolean;
  wordbooks: { id: string; name: string; contains: boolean }[];
};

/**
 * 標題列的收藏按鈕與對話框。先勾選要放進哪些單字本（可以都不勾），
 * 按「收藏」或「儲存」才一次寫入；已收藏時可取消收藏。
 */
export function SaveDialog({ headword, saved, wordbooks }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = new Set(wordbooks.filter((b) => b.contains).map((b) => b.id));
  const unchanged = saved && selected.size === current.size && [...selected].every((id) => current.has(id));

  const onOpenChange = (next: boolean) => {
    if (next) {
      setSelected(current); // 每次打開都從目前實際的單字本開始
      setNewName("");
      setError(null);
    }
    setOpen(next);
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const s = new Set(prev);
      if (checked) s.add(id);
      else s.delete(id);
      return s;
    });

  /** 新增單字本只建立並勾選，要按「收藏／儲存」才會把字放進去 */
  const createBook = () =>
    startTransition(async () => {
      setError(null);
      const result = await createWordbookAction(newName);
      if (!result.ok) return setError(result.error);
      setNewName("");
      toggle(result.data.id, true);
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveToWordbooksAction(headword, [...selected]);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  const unsave = () =>
    startTransition(async () => {
      setError(null);
      const result = await unsaveWordAction(headword);
      if (result.ok) setOpen(false);
      else setError(result.error);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label={saved ? "已收藏，管理單字本" : "收藏"}
          className={cn(saved && "text-primary")}
        >
          <Star className={cn(saved && "fill-current")} />
        </Button>
      </DialogTrigger>
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>收藏</DialogTitle>
        </DialogHeader>

        <fieldset className="flex flex-col gap-3" disabled={pending}>
          <legend className="sr-only">單字本</legend>
          {wordbooks.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {wordbooks.map((b) => {
                const checked = selected.has(b.id);
                return (
                  <Label
                    key={b.id}
                    className={cn(
                      "cursor-pointer rounded-full border px-3 py-1.5 font-normal",
                      checked && "border-primary bg-accent text-accent-foreground",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(b.id, v === true)} />
                    {b.name}
                  </Label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">還沒有單字本。</p>
          )}
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) createBook();
            }}
          >
            <Input
              value={newName}
              maxLength={50}
              placeholder="新增單字本"
              aria-label="新單字本名稱"
              className="h-9 flex-1"
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" variant="outline" size="lg" disabled={!newName.trim()}>
              <Plus /> 新增
            </Button>
          </form>
        </fieldset>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          {saved ? (
            <Button variant="ghost" className="text-destructive" disabled={pending} onClick={unsave}>
              取消收藏
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                關閉
              </Button>
            </DialogClose>
            <Button disabled={pending || unchanged} onClick={submit}>
              {saved ? "儲存" : "收藏"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
