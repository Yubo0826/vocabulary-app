"use client";

import { Bookmark, Plus, Star } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createWordbookAction, setWordbookMembershipAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  headword: string;
  saved: boolean;
  wordbooks: { id: string; name: string; contains: boolean }[];
  /** 點星號直接收藏時放進的單字本（最近放過字的那本） */
  recentWordbookId: string | null;
};

type Toast = { message: string; edit: boolean };

const TOAST_MS = 4000;

/**
 * 標題列的收藏按鈕與「收藏至…」視窗（YouTube「儲存至…」的做法）。
 * 還沒收藏時點星號直接放進最近用過的單字本，跳出 toast，按「編輯」才打開視窗；
 * 已收藏、或還沒有任何單字本時，點星號打開視窗。
 * 收藏＝至少在一本單字本裡：視窗裡每點一列就立刻放入或移出那本，沒有儲存按鈕；
 * 全部移出就等於取消收藏。還沒有單字本時要先建立一本，建立後這個字直接放進去。
 */
export function SaveDialog({ headword, saved, wordbooks, recentWordbookId }: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  // 直接收藏時星號先亮起；伺服器回來並重新整理後改由 saved 決定
  const [shownSaved, setShownSaved] = useOptimistic(saved);
  const [quickPending, startQuick] = useTransition();
  // 直接收藏還在送出時打開視窗，那本先顯示成已勾選
  const quickBook = useRef<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const quickSave = (id: string) => {
    const name = wordbooks.find((b) => b.id === id)?.name ?? "單字本";
    quickBook.current = id;
    setToast({ message: `已收藏至「${name}」`, edit: true });
    startQuick(async () => {
      setShownSaved(true);
      const result = await setWordbookMembershipAction(id, headword, true);
      quickBook.current = null;
      if (!result.ok) setToast({ message: result.error, edit: false });
    });
  };

  const onStarClick = () => {
    if (quickPending) return;
    if (!saved && recentWordbookId && wordbooks.some((b) => b.id === recentWordbookId)) quickSave(recentWordbookId);
    else onOpenChange(true);
  };
  // 視窗裡顯示的勾選狀態：點下去立刻變，伺服器失敗時改回來
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();
  const [, startToggle] = useTransition();

  const onOpenChange = (next: boolean) => {
    if (next) {
      // 每次打開都從實際狀態開始（加上還在送出中的直接收藏）
      const ids = wordbooks.filter((b) => b.contains).map((b) => b.id);
      if (quickBook.current) ids.push(quickBook.current);
      setMembers(new Set(ids));
      setToast(null);
      setAdding(false);
      setNewName("");
      setError(null);
    }
    setOpen(next);
  };

  const mark = (set: Set<string>, id: string, on: boolean) => {
    const s = new Set(set);
    if (on) s.add(id);
    else s.delete(id);
    return s;
  };

  const toggle = (id: string) => {
    if (busy.has(id)) return;
    const next = !members.has(id);
    setError(null);
    setMembers((m) => mark(m, id, next));
    setBusy((b) => mark(b, id, true));
    startToggle(async () => {
      const result = await setWordbookMembershipAction(id, headword, next);
      setBusy((b) => mark(b, id, false));
      if (!result.ok) {
        setMembers((m) => mark(m, id, !next));
        setError(result.error);
      }
    });
  };

  /** 建立單字本並直接把這個字放進去 */
  const createBook = () =>
    startCreate(async () => {
      setError(null);
      const created = await createWordbookAction(newName);
      if (!created.ok) return setError(created.error);
      setNewName("");
      setAdding(false);
      const id = created.data.id;
      setMembers((m) => mark(m, id, true));
      const result = await setWordbookMembershipAction(id, headword, true);
      if (!result.ok) {
        setMembers((m) => mark(m, id, false));
        setError(result.error);
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        variant="soft"
        size="icon-lg"
        aria-label={shownSaved ? "已收藏，管理單字本" : "收藏"}
        aria-haspopup={shownSaved || !recentWordbookId ? "dialog" : undefined}
        className={cn(shownSaved && "text-primary")}
        onClick={onStarClick}
      >
        <Star className={cn(shownSaved && "fill-current")} />
      </Button>
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div
              role="status"
              className="pointer-events-auto flex min-h-12 w-full max-w-md animate-in items-center gap-3 rounded-2xl bg-popover py-2 pr-2 pl-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-150 fade-in-0 slide-in-from-bottom-2"
            >
              <span className="min-w-0 flex-1 truncate">{toast.message}</span>
              {toast.edit && (
                <Button variant="ghost" size="sm" className="shrink-0 text-primary" onClick={() => onOpenChange(true)}>
                  編輯
                </Button>
              )}
            </div>
          </div>,
          document.body,
        )}
      {/* 沒有說明文字，明確關掉 aria-describedby 以免 Radix 警告 */}
      <DialogContent aria-describedby={undefined} className="gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>收藏至…</DialogTitle>
        </DialogHeader>

        {wordbooks.length > 0 || members.size > 0 ? (
          <ul className="flex max-h-[min(22rem,55vh)] flex-col overflow-y-auto px-3 pb-2" aria-label="單字本">
            {wordbooks.map((b) => {
              const on = members.has(b.id);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-busy={busy.has(b.id) || undefined}
                    onClick={() => toggle(b.id)}
                    className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base outline-none hover:bg-foreground/8 focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-foreground/12"
                  >
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <Bookmark
                      className={cn("size-5.5 shrink-0 transition-colors", on ? "fill-current text-primary" : "text-muted-foreground")}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-6 pb-4 text-sm text-muted-foreground">目前沒有單字本，請先建立單字本</p>
        )}

        {error && (
          <p className="px-6 pb-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="border-t px-6 pt-4 pb-6">
          {adding ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) createBook();
              }}
              // 焦點離開輸入框和「建立」按鈕（點到別處）就取消新增；建立中不取消，等結果回來
              onBlur={(e) => {
                if (creating || e.currentTarget.contains(e.relatedTarget)) return;
                setAdding(false);
                setNewName("");
              }}
            >
              <Input
                autoFocus
                value={newName}
                maxLength={50}
                placeholder="單字本名稱"
                aria-label="新單字本名稱"
                className="h-10 flex-1"
                disabled={creating}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  // Esc 只收起輸入框，不關掉整個視窗
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setAdding(false);
                    setNewName("");
                  }
                }}
              />
              <Button
                type="submit"
                size="lg"
                disabled={creating || !newName.trim()}
                // Safari 點按鈕不會給它焦點，先擋掉 mousedown，焦點留在輸入框才不會被當成 blur 取消
                onMouseDown={(e) => e.preventDefault()}
              >
                建立
              </Button>
            </form>
          ) : (
            <Button variant="secondary" size="lg" className="w-full" onClick={() => setAdding(true)}>
              <Plus /> 新增單字本
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
