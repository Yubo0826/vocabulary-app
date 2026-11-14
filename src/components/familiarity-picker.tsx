"use client";

/**
 * 單字標題列的熟悉度圓點：顏色代表目前等級（無 = 灰色空心、低 = 紫、中 = 黃、高 = 綠）。
 * 滑鼠移上去就展開設定（手機點一下）；選了立即套用，失敗時退回原本的等級。
 * 用 Popover 而不是 Tooltip：Tooltip 內不能放可點的按鈕。
 */
import { Circle } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { setFamiliarityAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FAMILIARITY_COLORS, FAMILIARITY_LABELS, FAMILIARITY_LEVELS, type Familiarity } from "@/lib/familiarity";
import { cn } from "@/lib/utils";

/** 滑鼠移出後延遲關閉，讓游標能從圓點移到面板上 */
const CLOSE_DELAY_MS = 150;

export function FamiliarityDot({ level, className }: { level: Familiarity; className?: string }) {
  return <Circle className={cn(FAMILIARITY_COLORS[level], level > 0 && "fill-current", className)} aria-hidden />;
}

export function FamiliarityPicker({ headword, level }: { headword: string; level: Familiarity }) {
  const [optimistic, setOptimistic] = useOptimistic(level);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return; // 觸控交給點擊
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const choose = (next: Familiarity) => {
    if (next === optimistic) return;
    startTransition(async () => {
      setError(null);
      setOptimistic(next);
      const result = await setFamiliarityAction(headword, next);
      if (!result.ok) setError(result.error);
    });
  };

  const label = `熟悉度：${FAMILIARITY_LABELS[optimistic]}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="soft" size="icon-lg" aria-label={label} onPointerEnter={hoverOpen} onPointerLeave={hoverClose}>
          <FamiliarityDot level={optimistic} className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto gap-1.5 p-1.5"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onOpenAutoFocus={(e) => e.preventDefault()} // hover 展開時不搶走焦點
      >
        <p className="px-1 text-xs font-medium text-muted-foreground" id="familiarity-title">
          熟悉度
        </p>
        <div
          role="radiogroup"
          aria-labelledby="familiarity-title"
          className="relative grid grid-cols-4 overflow-hidden rounded-full border border-input"
        >
          {/* 選中格的 secondary container 底色（Material 3 分段按鈕）：四格等寬，切換時用 translateX 滑到新的那格 */}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1/4 bg-secondary transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(${optimistic * 100}%)` }}
          />
          {FAMILIARITY_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={optimistic === l}
              onClick={() => choose(l)}
              title={l === 0 && optimistic > 0 ? "會把複習進度重設成新卡" : undefined}
              className="relative flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-foreground transition-colors not-last:border-r not-last:border-input hover:bg-foreground/8 aria-checked:text-secondary-foreground"
            >
              <FamiliarityDot level={l} className="size-3 shrink-0" />
              {FAMILIARITY_LABELS[l]}
            </button>
          ))}
        </div>
        {error && (
          <p className="px-2 pb-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
