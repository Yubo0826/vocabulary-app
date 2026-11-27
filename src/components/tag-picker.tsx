"use client";

import { Check, ChevronLeft, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useRef, useState, useTransition } from "react";
import { createNoteTagAction, deleteNoteTagAction, listNoteTagsAction, updateNoteTagAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_NOTE,
  type NoteTag,
  normalizeTagName,
  TAG_COLOR_NAMES,
  TAG_COLORS,
  type TagColor,
  tagKey,
} from "@/lib/note-tags";
import { cn } from "@/lib/utils";
import { TagChip } from "./tag-chip";

type Option = NoteTag & { count: number };

type Props = {
  value: NoteTag[];
  onChange: (tags: NoteTag[]) => void;
  disabled?: boolean;
};

/**
 * Notion 風格的筆記標籤選擇器：欄位顯示已選的標籤，點了打開選單——
 * 上方是已選的標籤（× 拿掉）與輸入框，下方列出所有標籤（點了選取／取消），打的字沒有對應標籤時出現「建立」。
 * 每個標籤的「⋯」切到編輯畫面：改名、改顏色、刪除（這三個馬上生效，影響所有筆記）。
 * 選了哪些標籤則要等筆記按「儲存」才存。
 *
 * 選單不放進 portal：放在 Dialog 外面的話，Dialog 的捲動鎖會讓選單裡的清單捲不動
 */
export function TagPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [text, setText] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [editing, setEditing] = useState<Option | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // 選單蓋在欄位上（像 Notion）：往下的偏移設成負的欄位高度，選單頂端就對齊欄位頂端
  const [triggerHeight, setTriggerHeight] = useState(0);

  // 第一次打開選單時取所有標籤
  useEffect(() => {
    if (!open || options) return;
    listNoteTagsAction().then((r) => setOptions(r.ok ? r.data : []));
  }, [open, options]);

  const chosen = new Set(value.map((t) => t.id));
  const full = value.length >= MAX_TAGS_PER_NOTE;
  const name = normalizeTagName(text).slice(0, MAX_TAG_LENGTH);
  const filtered = (options ?? []).filter((o) => tagKey(o.name).includes(tagKey(name)));
  const exact = (options ?? []).some((o) => tagKey(o.name) === tagKey(name));
  const canCreate = Boolean(name) && !exact && options !== null;
  const itemCount = filtered.length + (canCreate ? 1 : 0);
  const active = Math.min(highlight, Math.max(itemCount - 1, 0));

  const onOpenChange = (next: boolean) => {
    if (next) setTriggerHeight(triggerRef.current?.offsetHeight ?? 0);
    setOpen(next);
    if (!next) {
      setText("");
      setEditing(null);
      setError(null);
    }
  };

  const toggle = (tag: NoteTag) => {
    setError(null);
    if (chosen.has(tag.id)) onChange(value.filter((t) => t.id !== tag.id));
    else if (full) setError(`每則筆記最多 ${MAX_TAGS_PER_NOTE} 個標籤`);
    else onChange([...value, tag]);
    setText("");
    inputRef.current?.focus();
  };

  const create = () =>
    startTransition(async () => {
      setError(null);
      if (full) return setError(`每則筆記最多 ${MAX_TAGS_PER_NOTE} 個標籤`);
      const r = await createNoteTagAction(name);
      if (!r.ok) return setError(r.error);
      setOptions((prev) => {
        const list = prev ?? [];
        if (list.some((o) => o.id === r.data.id)) return list;
        return [...list, { ...r.data, count: 0 }].sort((a, b) => tagKey(a.name).localeCompare(tagKey(b.name)));
      });
      if (!chosen.has(r.data.id)) onChange([...value, r.data]);
      setText("");
      setHighlight(0);
      inputRef.current?.focus();
    });

  /** 改名、改色成功後：選單清單與已選的標籤都換成新的 */
  const applyUpdate = (tag: NoteTag) => {
    setOptions((prev) => prev?.map((o) => (o.id === tag.id ? { ...o, ...tag } : o)) ?? prev);
    setEditing((e) => (e && e.id === tag.id ? { ...e, ...tag } : e));
    if (chosen.has(tag.id)) onChange(value.map((t) => (t.id === tag.id ? tag : t)));
  };

  const applyDelete = (id: string) => {
    setOptions((prev) => prev?.filter((o) => o.id !== id) ?? prev);
    if (chosen.has(id)) onChange(value.filter((t) => t.id !== id));
    setEditing(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // 中文輸入法選字中的按鍵不處理
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (itemCount === 0) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + itemCount) % itemCount;
      setHighlight(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < filtered.length) toggle(filtered[active]);
      else if (canCreate) create();
    } else if (e.key === "Backspace" && text === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild disabled={disabled}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={value.length ? `標籤：${value.map((t) => t.name).join("、")}，按一下編輯` : "新增標籤"}
          className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
        >
          {value.length === 0 ? (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Plus className="size-4" aria-hidden /> 新增標籤
            </span>
          ) : (
            value.map((t) => <TagChip key={t.id} name={t.name} color={t.color} />)
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Content
        align="start"
        side="bottom"
        sideOffset={-triggerHeight}
        collisionPadding={12}
        className="z-50 flex w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-64 flex-col overflow-hidden rounded-lg bg-popover text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {editing ? (
          <TagEditor
            tag={editing}
            onBack={() => {
              setEditing(null);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onUpdated={applyUpdate}
            onDeleted={applyDelete}
          />
        ) : (
          <>
            {/* 已選的標籤＋輸入框 */}
            <div className="flex flex-wrap items-center gap-1.5 border-b bg-foreground/3 px-2.5 py-2">
              {value.map((t) => (
                <TagChip key={t.id} name={t.name} color={t.color}>
                  <button
                    type="button"
                    aria-label={`拿掉「${t.name}」`}
                    className="-mr-0.5 rounded-sm p-px opacity-60 hover:opacity-100"
                    onClick={() => toggle(t)}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </TagChip>
              ))}
              <input
                ref={inputRef}
                value={text}
                maxLength={MAX_TAG_LENGTH + 1}
                aria-label="搜尋或建立標籤"
                placeholder={value.length ? "" : "搜尋或建立標籤"}
                className="h-6 min-w-20 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
                onChange={(e) => {
                  setText(e.target.value);
                  setHighlight(0);
                  setError(null);
                }}
                onKeyDown={onKeyDown}
              />
            </div>

            <div ref={listRef} className="flex max-h-64 flex-col overflow-y-auto p-1" role="listbox" aria-label="標籤">
              <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                {options === null ? "載入中…" : "選擇或建立標籤"}
              </p>
              {filtered.map((o, i) => (
                <div
                  key={o.id}
                  data-index={i}
                  role="option"
                  aria-selected={chosen.has(o.id)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 rounded-md py-1 pr-1 pl-2",
                    i === active && "bg-foreground/6",
                  )}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => toggle(o)}
                >
                  <span className="flex min-w-0 flex-1">
                    <TagChip name={o.name} color={o.color} />
                  </span>
                  {chosen.has(o.id) && <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <button
                    type="button"
                    aria-label={`編輯「${o.name}」`}
                    title="改名、改顏色或刪除"
                    className={cn(
                      "rounded-sm p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground",
                      i === active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      // 觸控裝置沒有 hover，一律顯示
                      "pointer-coarse:opacity-100",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setError(null);
                      setEditing(o);
                    }}
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
              {canCreate && (
                <div
                  data-index={filtered.length}
                  role="option"
                  aria-selected={false}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1",
                    active === filtered.length && "bg-foreground/6",
                    pending && "pointer-events-none opacity-60",
                  )}
                  onMouseEnter={() => setHighlight(filtered.length)}
                  onClick={create}
                >
                  <span className="shrink-0 text-muted-foreground">建立</span>
                  <TagChip name={name} color={TAG_COLOR_NAMES[(options?.length ?? 0) % TAG_COLOR_NAMES.length]} />
                </div>
              )}
              {options !== null && options.length === 0 && !name && (
                <p className="px-2 py-1.5 text-muted-foreground">還沒有標籤，輸入名稱就能建立。</p>
              )}
            </div>
            {error && (
              <p className="border-t px-3 py-2 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}

/** 「⋯」的編輯畫面：改名（Enter 或離開輸入框時儲存）、刪除（先確認）、改顏色。都馬上生效 */
function TagEditor({
  tag,
  onBack,
  onUpdated,
  onDeleted,
}: {
  tag: Option;
  onBack: () => void;
  onUpdated: (tag: NoteTag) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (change: { name?: string; color?: TagColor }) =>
    startTransition(async () => {
      setError(null);
      const r = await updateNoteTagAction(tag.id, change);
      if (r.ok) {
        onUpdated(r.data);
        setName(r.data.name);
      } else {
        setError(r.error);
        if (change.name !== undefined) setName(tag.name);
      }
    });

  const rename = () => {
    const next = normalizeTagName(name);
    if (!next) return setName(tag.name);
    if (next !== tag.name) update({ name: next });
  };

  const remove = () =>
    startTransition(async () => {
      const r = await deleteNoteTagAction(tag.id);
      if (r.ok) onDeleted(tag.id);
      else {
        setConfirming(false);
        setError(r.error);
      }
    });

  return (
    <div className="flex flex-col gap-1 p-1">
      <div className="flex items-center gap-1 px-1 pt-0.5">
        <Button variant="ghost" size="icon-sm" aria-label="回到標籤清單" onClick={onBack}>
          <ChevronLeft />
        </Button>
        <span className="text-xs text-muted-foreground">編輯標籤</span>
      </div>
      <div className="px-2 pb-1">
        <Input
          value={name}
          maxLength={MAX_TAG_LENGTH}
          aria-label="標籤名稱"
          className="h-8"
          autoFocus
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              rename();
            }
          }}
        />
      </div>

      {confirming ? (
        <div className="mx-1 flex flex-col gap-2 rounded-md bg-destructive/8 p-2.5">
          <p className="text-sm">
            刪除「{tag.name}」？{tag.count > 0 ? `會從 ${tag.count} 則筆記上拿掉，` : ""}刪除後無法復原。
          </p>
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button variant="destructive" size="sm" disabled={pending} onClick={remove}>
              刪除
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-destructive hover:bg-destructive/8"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" aria-hidden /> 刪除標籤
        </button>
      )}

      <div className="my-1 border-t" />
      <p className="px-2.5 pb-1 text-xs text-muted-foreground">顏色</p>
      <div className="flex max-h-56 flex-col overflow-y-auto" role="radiogroup" aria-label="顏色">
        {TAG_COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={tag.color === c}
            disabled={pending}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-foreground/6"
            onClick={() => tag.color !== c && update({ color: c })}
          >
            <span className={cn("size-4.5 rounded-sm", TAG_COLORS[c].className)} aria-hidden />
            <span className="flex-1">{TAG_COLORS[c].label}</span>
            {tag.color === c && <Check className="size-4 text-muted-foreground" aria-hidden />}
          </button>
        ))}
      </div>
      {error && (
        <p className="px-2.5 py-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
