/**
 * 單字頁的例句區（docs/SENSE-GROUPING.md 選項 B）：有詞義資料時依詞義分段，
 * 每段一個小標題（詞性＋中文標籤），先顯示前 3 句、其餘收合；沒分到詞義的例句放在最後的「其他用法」。
 * 沒有詞義資料的字維持一般列表（前 8 句，其餘收合）。
 */
import { ExampleSource, highlight } from "@/components/example-text";
import { SpeakButton } from "@/components/speech";
import type { WordDetail } from "@/lib/dictionary";

type Example = WordDetail["examples"][number];
type Sense = WordDetail["senses"][number];

const SHOWN_PLAIN = 8; // 沒有詞義資料時預設顯示幾句
const SHOWN_PER_SENSE = 3; // 每個詞義預設顯示幾句

export function ExampleBrowser({ examples, senses, forms }: { examples: Example[]; senses: Sense[]; forms: string[] }) {
  const highlightForms = new Set(forms);
  if (senses.length === 0) return <Collapsible examples={examples} shown={SHOWN_PLAIN} forms={highlightForms} />;

  const ids = new Set(senses.map((s) => s.id));
  const groups = senses.map((s) => ({ key: String(s.id), pos: s.pos, label: s.label, items: examples.filter((ex) => ex.senseId === s.id) }));
  const others = examples.filter((ex) => ex.senseId === null || !ids.has(ex.senseId));
  if (others.length) groups.push({ key: "other", pos: null, label: "其他用法", items: others });

  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-3">
          <h3 className="flex items-baseline gap-1.5 border-b pb-2 font-semibold text-primary">
            {g.pos && <span className="text-sm font-normal italic">{g.pos}</span>}
            {g.label}
          </h3>
          <div className="pl-3">
            <Collapsible examples={g.items} shown={SHOWN_PER_SENSE} forms={highlightForms} />
          </div>
        </section>
      ))}
    </div>
  );
}

function Collapsible({ examples, shown, forms }: { examples: Example[]; shown: number; forms: Set<string> }) {
  return (
    <div>
      <ExampleList examples={examples.slice(0, shown)} forms={forms} />
      {examples.length > shown && (
        <details className="group">
          <summary className="mt-1 cursor-pointer text-sm text-primary group-open:mb-3">顯示其餘 {examples.length - shown} 句</summary>
          <ExampleList examples={examples.slice(shown)} forms={forms} />
        </details>
      )}
    </div>
  );
}

function ExampleList({ examples, forms }: { examples: Example[]; forms: Set<string> }) {
  return (
    <ul className="flex flex-col divide-y">
      {examples.map((ex) => (
        <li key={ex.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-1 text-[1.02rem]">
            <p className="flex-1">{highlight(ex.textEn, forms)}</p>
            <SpeakButton text={ex.textEn} size="sm" />
            <ExampleSource example={ex} />
          </div>
          {ex.textZh && <p className="mt-0.5 text-muted-foreground">{ex.textZh}</p>}
        </li>
      ))}
    </ul>
  );
}
