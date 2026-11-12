/**
 * 單字頁的例句區（docs/SENSE-GROUPING.md 選項 B）：有詞義資料時依詞義分段，
 * 每段一個小標題（詞性＋中文標籤，下面一行是對應的 WordNet 英英釋義），先顯示前 3 句、其餘收合；
 * 沒分到詞義的例句放在「其他用法」，沒放到詞義下的英英釋義收合在最後的「其他英英釋義」。
 * 沒有詞義資料的字維持一般列表（前 8 句，其餘收合）。
 */
import { ExampleSource, highlight, type WordLinks } from "@/components/example-text";
import { SpeakButton } from "@/components/speech";
import type { WordDetail } from "@/lib/dictionary";

type Example = WordDetail["examples"][number];
type Sense = WordDetail["senses"][number];
type EnDef = WordDetail["otherEn"][number];

const NO_MARK = new Set<string>();
const SHOWN_PLAIN = 8; // 沒有詞義資料時預設顯示幾句
const SHOWN_PER_SENSE = 3; // 每個詞義預設顯示幾句

export function ExampleBrowser({
  examples,
  senses,
  otherEn,
  forms,
  linkable,
}: {
  examples: Example[];
  senses: Sense[];
  otherEn: EnDef[];
  forms: string[];
  linkable: string[];
}) {
  const highlightForms = new Set(forms);
  const links: WordLinks = { words: new Set(linkable) };
  if (senses.length === 0) return <Collapsible examples={examples} shown={SHOWN_PLAIN} forms={highlightForms} links={links} />;

  // 英英釋義裡這個字本身（含變化形）不連、也不標色
  const defLinks: WordLinks = { words: new Set(linkable.filter((w) => !highlightForms.has(w))) };
  const ids = new Set(senses.map((s) => s.id));
  const groups = senses.map((s) => ({
    key: String(s.id),
    pos: s.pos,
    label: s.label,
    def: s.def?.text ?? null,
    items: examples.filter((ex) => ex.senseId === s.id),
  }));
  const others = examples.filter((ex) => ex.senseId === null || !ids.has(ex.senseId));
  if (others.length) groups.push({ key: "other", pos: null, label: "其他用法", def: null, items: others });

  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-3">
          <div className="border-b pb-2">
            <h3 className="flex items-baseline gap-1.5 font-semibold text-primary">
              {g.pos && <span className="text-sm font-normal italic">{g.pos}</span>}
              {g.label}
            </h3>
            {g.def && <p className="mt-0.5 text-sm text-muted-foreground">{highlight(g.def, NO_MARK, defLinks)}</p>}
          </div>
          <div className="pl-3">
            <Collapsible examples={g.items} shown={SHOWN_PER_SENSE} forms={highlightForms} links={links} />
          </div>
        </section>
      ))}
      {otherEn.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-primary group-open:mb-2">其他英英釋義（{otherEn.length}）</summary>
          <ol className="flex list-decimal flex-col gap-1 pl-6 text-[0.95rem]">
            {otherEn.map((d, i) => (
              <li key={i}>
                {d.pos && <span className="mr-1.5 text-sm text-primary italic">{d.pos}</span>}
                {highlight(d.text, NO_MARK, defLinks)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

type ListProps = { examples: Example[]; forms: Set<string>; links: WordLinks };

function Collapsible({ examples, shown, forms, links }: ListProps & { shown: number }) {
  return (
    <div>
      <ExampleList examples={examples.slice(0, shown)} forms={forms} links={links} />
      {examples.length > shown && (
        <details className="group">
          <summary className="mt-1 cursor-pointer text-sm text-primary group-open:mb-3">顯示其餘 {examples.length - shown} 句</summary>
          <ExampleList examples={examples.slice(shown)} forms={forms} links={links} />
        </details>
      )}
    </div>
  );
}

function ExampleList({ examples, forms, links }: ListProps) {
  return (
    <ul className="flex flex-col divide-y">
      {examples.map((ex) => (
        <li key={ex.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start gap-1 text-[1.02rem]">
            <p className="flex-1">{highlight(ex.textEn, forms, links)}</p>
            <SpeakButton text={ex.textEn} size="sm" />
            <ExampleSource example={ex} />
          </div>
          {ex.textZh && <p className="mt-0.5 text-muted-foreground">{ex.textZh}</p>}
        </li>
      ))}
    </ul>
  );
}
