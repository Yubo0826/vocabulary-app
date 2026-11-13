import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const RULES = [
  { label: "忘記", className: "text-again", text: "想不起來，或想錯意思" },
  { label: "困難", className: "text-hard", text: "想起來了，但想很久，或只想到一部分" },
  { label: "記得", className: "text-good", text: "正常想起來（大部分的卡應該按這個）" },
  { label: "簡單", className: "text-easy", text: "一看就知道，幾乎不用想" },
];

/** 複習標題旁的問號：評分規則說明（用 Popover 而非 hover tooltip，手機點得開） */
export function RatingHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
          aria-label="評分說明"
          title="評分說明"
        >
          <CircleHelp className="size-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[min(340px,calc(100vw-32px))] p-3.5 text-sm">
        <p className="mb-2 font-semibold">什麼時候按哪個評分？</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          {RULES.map((r) => (
            <div key={r.label} className="contents">
              <dt className={`font-semibold ${r.className}`}>{r.label}</dt>
              <dd className="text-muted-foreground">{r.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
          誠實評分，排程才準。如果是靠例句猜到意思、拿掉句子就不確定，建議評「困難」。
        </p>
      </PopoverContent>
    </Popover>
  );
}
