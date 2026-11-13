/**
 * 單字頁的「釋義」區（LLM 現代化詞條）：每個詞義一個區塊（詞性、中文標籤、語域、中文說明、英英釋義），
 * 常用的意思直接顯示，較少用與罕用的收合。英英釋義裡的字可點到單字頁。
 */
import { highlight, type WordLinks } from "@/components/example-text";
import type { WordDetail } from "@/lib/dictionary";
import { cn } from "@/lib/utils";

type Sense = WordDetail["modern"][number];

const REGISTER_LABELS: Record<string, string> = {
  formal: "正式",
  informal: "口語",
  slang: "俚語",
  literary: "文學",
  old: "舊式",
  technical: "專業",
  offensive: "冒犯",
};
const USAGE_LABELS: Record<string, string> = { less_common: "較少用", rare: "罕用" };
const NO_MARK = new Set<string>();

export function ModernDefinitions({ senses, links }: { senses: Sense[]; links: WordLinks }) {
  // 常用的直接顯示；一個常用的都沒有（罕用字）時至少顯示第一個
  const common = senses.filter((s) => s.usage === "common");
  const shown = common.length > 0 ? common : senses.slice(0, 1);
  const rest = senses.filter((s) => !shown.includes(s));

  return (
    <div className="flex flex-col gap-3">
      <SenseList senses={shown} start={1} links={links} />
      {rest.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-primary group-open:mb-3">較少用的意思（{rest.length}）</summary>
          <SenseList senses={rest} start={shown.length + 1} links={links} />
        </details>
      )}
      <p className="text-xs text-muted-foreground/80">釋義由 AI 參考 ECDICT、WordNet 整理</p>
    </div>
  );
}

function SenseList({ senses, start, links }: { senses: Sense[]; start: number; links: WordLinks }) {
  return (
    <ol className="flex flex-col divide-y">
      {senses.map((s, i) => (
        <li key={i} className="flex gap-2.5 py-2.5 first:pt-0 last:pb-0">
          <span className="w-4 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{start + i}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm text-primary italic">{s.pos}</span>
              <span className="text-[1.05rem] font-semibold">{s.label}</span>
              {USAGE_LABELS[s.usage] && <Tag>{USAGE_LABELS[s.usage]}</Tag>}
              {s.register.map((r) => (
                <Tag key={r} warn={r === "offensive"}>
                  {REGISTER_LABELS[r] ?? r}
                </Tag>
              ))}
            </div>
            <p className="text-muted-foreground">{s.zh}</p>
            <p className="text-[0.95rem]">{highlight(s.en, NO_MARK, links)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tag({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-px text-xs",
        warn ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
