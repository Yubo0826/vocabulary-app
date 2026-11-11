import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ExampleBrowser } from "@/components/example-browser";
import { FamiliarityControl, NoteButton, NotePreview, SaveButton } from "@/components/save-panel";
import { AccentToggle, SpeakButton } from "@/components/speech";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { findLemma, getWord, type WordDetail } from "@/lib/dictionary";
import { normalizeHeadword } from "@/lib/headword";
import { wordHref } from "@/lib/urls";

const FORM_LABELS: Record<string, string> = {
  p: "過去式",
  d: "過去分詞",
  i: "現在分詞",
  "3": "第三人稱單數",
  r: "比較級",
  t: "最高級",
  s: "複數",
};
const POS_LABELS: Record<string, string> = { "n.": "名詞", "v.": "動詞", "adj.": "形容詞", "adv.": "副詞" };
const EXAM_TAGS: Record<string, string> = { toefl: "TOEFL", ielts: "IELTS", gre: "GRE" };
const EN_DEFS_SHOWN = 8; // 英英釋義每個詞性預設顯示幾筆，其餘收合

export async function generateMetadata({ params }: PageProps<"/word/[headword]">) {
  const { headword } = await params;
  return { title: normalizeHeadword(safeDecode(headword)) };
}

export default function WordPage({ params }: PageProps<"/word/[headword]">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">載入中…</p>}>
      {params.then(({ headword }) => (
        <WordContent raw={headword} />
      ))}
    </Suspense>
  );
}

async function WordContent({ raw }: { raw: string }) {
  const input = safeDecode(raw);
  const headword = normalizeHeadword(input);
  if (headword !== input) redirect(wordHref(headword)); // 大小寫、空白不同時轉到正規網址

  const word = await getWord(headword);
  if (!word) {
    const lemma = await findLemma(headword);
    if (lemma) redirect(wordHref(lemma)); // 輸入變化形（went）時轉到原形（go）
    notFound();
  }
  return <WordView word={word} />;
}

function WordView({ word }: { word: WordDetail }) {
  const { entry, zh, en, examples, senses, inflections, lemmaOf, confusables, synonyms } = word;
  const examTags = (entry.tags ?? []).filter((t) => t in EXAM_TAGS);
  const similarCount = confusables.length + synonyms.length;
  const highlightForms = new Set([entry.headword, ...inflections.map((f) => f.form)]);

  return (
    <article className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[clamp(2rem,8vw,2.6rem)] leading-tight font-bold wrap-anywhere">{entry.display}</h1>
          <SpeakButton text={entry.display} autoPlay />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Suspense fallback={null}>
              <SaveButton headword={entry.headword} />
              <NoteButton headword={entry.headword} />
              <FamiliarityControl headword={entry.headword} />
            </Suspense>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {entry.phonetic && <span className="font-mono text-muted-foreground">/{entry.phonetic}/</span>}
          <AccentToggle />
          {examTags.map((t) => (
            <Badge key={t} variant="secondary" className="bg-accent tracking-wide text-accent-foreground">
              {EXAM_TAGS[t]}
            </Badge>
          ))}
        </div>
        {lemmaOf.length > 0 && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {groupBy(lemmaOf, (f) => f.lemma).map(([lemma, forms]) => (
              <span key={lemma}>
                也是 <Link href={wordHref(lemma)}>{lemma}</Link> 的{forms.map((f) => FORM_LABELS[f.kind]).join("、")}
              </span>
            ))}
          </p>
        )}
        <Suspense fallback={null}>
          <NotePreview headword={entry.headword} />
        </Suspense>
      </header>

      <Tabs defaultValue="main" className="gap-6">
        {similarCount > 0 && (
          <TabsList>
            <TabsTrigger value="main" className="text-base">
              釋義
            </TabsTrigger>
            <TabsTrigger value="similar" className="text-base">
              相似
            </TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="main" className="flex flex-col gap-4 text-base">
          {zh.length > 0 && (
            <Section title="中文釋義">
              <ul className="flex flex-col gap-1.5 text-[1.05rem]">
                {zh.map((d, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <Pos>{d.pos}</Pos>
                    <span>{d.text}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {en.length > 0 && (
            <Section title="英英釋義">
              {groupBy(en, (d) => d.pos ?? "").map(([pos, defs]) => (
                <div key={pos} className="not-first:mt-2">
                  <h3 className="mb-1 font-semibold">
                    {POS_LABELS[pos] ?? pos}{" "}
                    <span className="text-sm font-normal text-muted-foreground italic">{pos}</span>
                  </h3>
                  <ol className="flex list-decimal flex-col gap-1 pl-6">
                    {defs.slice(0, EN_DEFS_SHOWN).map((d, i) => (
                      <li key={i}>{d.text}</li>
                    ))}
                  </ol>
                  {defs.length > EN_DEFS_SHOWN && (
                    <details>
                      <summary className="my-1.5 cursor-pointer text-sm text-primary">
                        顯示其餘 {defs.length - EN_DEFS_SHOWN} 筆
                      </summary>
                      <ol className="flex list-decimal flex-col gap-1 pl-6" start={EN_DEFS_SHOWN + 1}>
                        {defs.slice(EN_DEFS_SHOWN).map((d, i) => (
                          <li key={i}>{d.text}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              ))}
            </Section>
          )}

          {examples.length > 0 && (
            <Section title="例句">
              <ExampleBrowser examples={examples} senses={senses} forms={[...highlightForms]} />
            </Section>
          )}
        </TabsContent>

        {similarCount > 0 && (
          <TabsContent value="similar" className="text-base">
            <dl className="surface flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
              <WordList label="易混淆" words={confusables} />
              <WordList label="近義字" words={synonyms} />
            </dl>
          </TabsContent>
        )}
      </Tabs>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface flex flex-col gap-2.5 rounded-2xl p-4 sm:p-5">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

/** 一排相關的字，每個字連到它的單字頁 */
function WordList({ label, words }: { label: string; words: { headword: string; display: string }[] }) {
  if (words.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm font-semibold text-primary">{label}</dt>
      <dd className="flex flex-wrap gap-x-1 gap-y-1 text-[1.02rem]">
        {words.map((w, i) => (
          <span key={w.headword}>
            <Link href={wordHref(w.headword)} className="text-foreground underline-offset-4 hover:text-primary">
              {w.display}
            </Link>
            {i < words.length - 1 && <span className="text-muted-foreground">,</span>}
          </span>
        ))}
      </dd>
    </div>
  );
}

function Pos({ children }: { children: React.ReactNode }) {
  return <span className="min-w-[2.6em] shrink-0 text-sm text-primary italic">{children}</span>;
}

function groupBy<T>(items: T[], key: (item: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return [...map];
}

/** params 是未解碼的路徑片段；格式錯誤（如 %E0%A4%A）時退回原字串而不是丟錯 */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
