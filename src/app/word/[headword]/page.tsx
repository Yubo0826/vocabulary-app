import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Attribution, highlight } from "@/components/example-text";
import { SavePanel } from "@/components/save-panel";
import { AccentToggle, SpeakButton } from "@/components/speech";
import { findLemma, getWord, type WordDetail } from "@/lib/dictionary";
import { normalizeHeadword } from "@/lib/headword";
import { wordHref } from "@/lib/urls";
import Link from "next/link";
import styles from "./page.module.css";

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
    <Suspense fallback={<p className={styles.loading}>載入中…</p>}>
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
  const { entry, zh, en, examples, inflections, lemmaOf } = word;
  const examTags = (entry.tags ?? []).filter((t) => t in EXAM_TAGS);
  const highlightForms = new Set([entry.headword, ...inflections.map((f) => f.form)]);

  return (
    <article className={styles.article}>
      <header className={styles.head}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{entry.display}</h1>
          <SpeakButton text={entry.display} />
        </div>
        <div className={styles.meta}>
          {entry.phonetic && <span className={styles.phonetic}>/{entry.phonetic}/</span>}
          <AccentToggle />
          {examTags.map((t) => (
            <span key={t} className={styles.tag}>
              {EXAM_TAGS[t]}
            </span>
          ))}
        </div>
        {lemmaOf.length > 0 && (
          <p className={styles.lemmaOf}>
            {groupBy(lemmaOf, (f) => f.lemma).map(([lemma, forms]) => (
              <span key={lemma}>
                也是 <Link href={wordHref(lemma)}>{lemma}</Link> 的{forms.map((f) => FORM_LABELS[f.kind]).join("、")}
              </span>
            ))}
          </p>
        )}
        <Suspense fallback={null}>
          <SavePanel headword={entry.headword} />
        </Suspense>
      </header>

      {zh.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>中文釋義</h2>
          <ul className={styles.zhList}>
            {zh.map((d, i) => (
              <li key={i}>
                <span className={styles.pos}>{d.pos}</span>
                <span>{d.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inflections.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>詞形變化</h2>
          <dl className={styles.forms}>
            {groupBy(inflections, (f) => f.kind)
              .sort(([a], [b]) => Object.keys(FORM_LABELS).indexOf(a) - Object.keys(FORM_LABELS).indexOf(b))
              .map(([kind, forms]) => (
                <div key={kind} className={styles.formItem}>
                  <dt>{FORM_LABELS[kind] ?? kind}</dt>
                  <dd>{forms.map((f) => f.form).join("、")}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      {en.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>英英釋義</h2>
          {groupBy(en, (d) => d.pos ?? "").map(([pos, defs]) => (
            <div key={pos} className={styles.enGroup}>
              <h3 className={styles.enPos}>
                {POS_LABELS[pos] ?? pos} <span className={styles.posCode}>{pos}</span>
              </h3>
              <ol className={styles.enList}>
                {defs.slice(0, EN_DEFS_SHOWN).map((d, i) => (
                  <li key={i}>{d.text}</li>
                ))}
              </ol>
              {defs.length > EN_DEFS_SHOWN && (
                <details className={styles.more}>
                  <summary>顯示其餘 {defs.length - EN_DEFS_SHOWN} 筆</summary>
                  <ol className={styles.enList} start={EN_DEFS_SHOWN + 1}>
                    {defs.slice(EN_DEFS_SHOWN).map((d, i) => (
                      <li key={i}>{d.text}</li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          ))}
        </section>
      )}

      {examples.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>例句</h2>
          <ul className={styles.examples}>
            {examples.map((ex) => (
              <li key={ex.id} className={styles.example}>
                <div className={styles.exampleEn}>
                  <p>{highlight(ex.textEn, highlightForms)}</p>
                  <SpeakButton text={ex.textEn} size="sm" />
                </div>
                {ex.textZh && <p className={styles.exampleZh}>{ex.textZh}</p>}
                <p className={styles.attribution}>
                  <Attribution id={ex.enSentenceId} author={ex.enAuthor} license={ex.enLicense} />
                  {ex.zhSentenceId && ex.zhLicense && (
                    <>
                      {" ／ 中譯 "}
                      <Attribution id={ex.zhSentenceId} author={ex.zhAuthor} license={ex.zhLicense} />
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
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
