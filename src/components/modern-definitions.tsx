/**
 * 單字頁的「釋義」區（LLM 現代化詞條）：依詞性分組、每個詞性從 1 編號，
 * 每個詞義一個區塊（中文標籤、語域、中文說明、英英釋義），常用的直接顯示，較少用與罕用的收合。
 * 英英釋義裡的字可點到單字頁。
 */
import { highlight, type WordLinks } from "@/components/example-text";
import type { WordDetail } from "@/lib/dictionary";
import { POS_LABELS } from "@/lib/pos";
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

type PosGroup = { pos: string; shown: Sense[]; rest: Sense[] };

/**
 * 依詞性分組。LLM 詞條已依現代常用程度排序，所以詞性的先後取「第一次出現的位置」：
 * 第一個意思的詞性視為最常用的詞性，排第一；同一詞性內維持原本的意思順序。
 * 每個詞性的常用意思直接顯示、其餘收合；一個常用意思都沒有的詞性整個收到最後。
 * 整個字都沒有常用意思（罕用字）時，第一個詞性至少顯示第一個意思。
 */
function groupByPos(senses: Sense[]): { main: PosGroup[]; minor: Sense[][] } {
  const byPos = new Map<string, Sense[]>();
  for (const s of senses) byPos.set(s.pos, [...(byPos.get(s.pos) ?? []), s]);
  const groups = [...byPos].map(([pos, list]) => ({ pos, list, common: list.filter((s) => s.usage === "common") }));

  const main: PosGroup[] = [];
  const minor: Sense[][] = [];
  const anyCommon = groups.some((g) => g.common.length > 0);
  groups.forEach((g, i) => {
    const shown = g.common.length > 0 ? g.common : !anyCommon && i === 0 ? g.list.slice(0, 1) : [];
    if (shown.length === 0) minor.push(g.list);
    else main.push({ pos: g.pos, shown, rest: g.list.filter((s) => !shown.includes(s)) });
  });
  return { main, minor };
}

const posName = (pos: string) => POS_LABELS[pos] ?? pos;

export function ModernDefinitions({ senses, links }: { senses: Sense[]; links: WordLinks }) {
  const { main, minor } = groupByPos(senses);

  return (
    <div className="flex flex-col gap-5">
      {main.map((g) => (
        <section key={g.pos} className="flex flex-col gap-2">
          <PosHeading pos={g.pos} />
          <SenseList senses={g.shown} start={1} links={links} />
          {g.rest.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm text-primary-ink group-open:mb-3">較少用的意思（{g.rest.length}）</summary>
              <SenseList senses={g.rest} start={g.shown.length + 1} links={links} />
            </details>
          )}
        </section>
      ))}
      {minor.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-primary-ink group-open:mb-3">
            較少用的詞性：{minor.map((list) => `${posName(list[0].pos)}（${list.length}）`).join("、")}
          </summary>
          <div className="flex flex-col gap-5">
            {minor.map((list) => (
              <section key={list[0].pos} className="flex flex-col gap-2">
                <PosHeading pos={list[0].pos} />
                <SenseList senses={list} start={1} links={links} />
              </section>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function PosHeading({ pos }: { pos: string }) {
  return (
    <h3 className="font-semibold">
      {posName(pos)} <span className="text-sm font-normal text-primary-ink italic">{pos}</span>
    </h3>
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
