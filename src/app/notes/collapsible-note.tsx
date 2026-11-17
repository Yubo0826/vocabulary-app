"use client";

/**
 * 筆記頁清單的長筆記：超過約 8 行時限高、底部淡出，按「展開全文」看完整內容。
 * 內容（NoteContent）仍在伺服器端渲染後當 children 傳進來；這裡只量高度與切換。
 * 只多出一兩行的筆記不截斷，免得為了藏一行還要多按一次。
 */
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const MAX_HEIGHT_REM = 12; // text-sm leading-relaxed 約 8 行
const SLACK_REM = 3; // 超出不到約 2 行就直接全部顯示
const FADE = "linear-gradient(to bottom, black 60%, transparent)";

export function CollapsibleNote({ children, defaultExpanded = false }: { children: ReactNode; defaultExpanded?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  // null＝還沒量過（伺服器渲染與 hydration 前）：先限在門檻高度，避免長筆記整篇出現再縮回去
  const [overflowing, setOverflowing] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setOverflowing(el.scrollHeight > (MAX_HEIGHT_REM + SLACK_REM) * rem);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el.firstElementChild ?? el); // 內容寬度改變（旋轉、縮放視窗）時重新判斷
    return () => observer.disconnect();
  }, []);

  const style =
    expanded || overflowing === false
      ? undefined
      : overflowing === null
        ? { maxHeight: `${MAX_HEIGHT_REM + SLACK_REM}rem` }
        : { maxHeight: `${MAX_HEIGHT_REM}rem`, maskImage: FADE, WebkitMaskImage: FADE };

  return (
    <div>
      <div ref={ref} className="overflow-hidden" style={style}>
        {children}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded);
            // 收合長筆記後，若這則的開頭已捲出畫面，捲回來免得使用者迷失位置
            const top = ref.current?.getBoundingClientRect().top ?? 0;
            if (expanded && top < 0) ref.current?.closest("li")?.scrollIntoView({ block: "start" });
          }}
          aria-expanded={expanded}
          className="mt-1 inline-flex cursor-pointer items-center gap-0.5 text-sm text-primary-ink select-none"
        >
          {expanded ? "收合" : "展開全文"}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      )}
    </div>
  );
}
