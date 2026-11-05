"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getReviewStateAction, reviewCardAction, undoReviewAction, type ActionResult } from "@/app/actions";
import { Attribution, highlight } from "@/components/example-text";
import { AccentToggle, SpeakButton } from "@/components/speech";
import ui from "@/components/ui.module.css";
import type { ReviewState } from "@/lib/review-session";
import { wordHref } from "@/lib/urls";
import styles from "./page.module.css";

const RATINGS = [
  { grade: 1, label: "忘記", key: "1", className: styles.again },
  { grade: 2, label: "困難", key: "2", className: styles.hard },
  { grade: 3, label: "記得", key: "3", className: styles.good },
  { grade: 4, label: "簡單", key: "4", className: styles.easy },
] as const;

const STATE_LABELS: Record<number, string> = { 0: "新卡", 1: "學習中", 2: "複習", 3: "重新學習" };

const timeFormat = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit" });

export function ReviewSession({ initial }: { initial: ReviewState }) {
  const [state, setState] = useState(initial);
  const [flipped, setFlipped] = useState(false);
  const [reviewedInSession, setReviewedInSession] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 每次顯示一張卡就產生新的 logId；重複點擊或重送會帶同一個 id，伺服器不會重複評分
  const attempt = useRef({ logId: "", shownAt: 0 });

  const item = state.item;
  useEffect(() => {
    attempt.current = { logId: crypto.randomUUID(), shownAt: Date.now() };
  }, [state]);

  const apply = useCallback(
    (fn: () => Promise<ActionResult<ReviewState>>, onOk?: () => void) =>
      startTransition(async () => {
        setError(null);
        const result = await fn();
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setState(result.data);
        setFlipped(false);
        onOk?.();
      }),
    [],
  );

  const rate = useCallback(
    (grade: number) => {
      if (!item || pending) return;
      const { logId, shownAt } = attempt.current;
      apply(
        () => reviewCardAction({ logId, cardId: item.cardId, rating: grade, durationMs: Date.now() - shownAt }),
        () => setReviewedInSession((n) => n + 1),
      );
    },
    [item, pending, apply],
  );

  const undo = useCallback(() => {
    if (pending) return;
    apply(undoReviewAction, () => setReviewedInSession((n) => Math.max(0, n - 1)));
  }, [pending, apply]);

  // 鍵盤：空白鍵／Enter 翻面，1–4 評分，Z 復原
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, button, a, [contenteditable]")) {
        // 焦點在表單或按鈕上時交給瀏覽器（例如按鈕上的空白鍵本來就會觸發點擊）
        if (e.key === " " || e.key === "Enter" || e.target.closest("input, textarea, select, [contenteditable]")) return;
      }
      if (!item) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        rate(Number(e.key));
      } else if ((e.key === "z" || e.key === "Z") && reviewedInSession > 0) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, flipped, rate, undo, reviewedInSession]);

  const { counts, stats } = state;

  return (
    <div className={styles.session}>
      <div className={styles.counts} aria-label="今日剩餘">
        <span className={styles.countNew}>新卡 {counts.new}</span>
        <span className={styles.countLearning}>學習中 {counts.learning}</span>
        <span className={styles.countReview}>複習 {counts.review}</span>
        {reviewedInSession > 0 && (
          <button type="button" className={ui.buttonGhost} onClick={undo} disabled={pending} title="快捷鍵：Z">
            ↶ 復原上一張
          </button>
        )}
      </div>

      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}

      {item ? (
        <section className={styles.card} aria-live="polite">
          <div className={styles.front}>
            <span className={styles.stateTag}>{STATE_LABELS[item.state]}</span>
            <div className={styles.wordRow}>
              <h2 className={styles.word}>{item.display}</h2>
              <SpeakButton text={item.display} />
            </div>
            <div className={styles.meta}>
              {item.phonetic && <span className={styles.phonetic}>/{item.phonetic}/</span>}
              <AccentToggle />
            </div>
          </div>

          {flipped ? (
            <>
              <Answer item={item} />
              <div className={styles.ratings}>
                {RATINGS.map((r) => (
                  <button
                    key={r.grade}
                    type="button"
                    className={`${styles.rating} ${r.className}`}
                    onClick={() => rate(r.grade)}
                    disabled={pending}
                  >
                    <span className={styles.ratingLabel}>{r.label}</span>
                    <span className={styles.ratingInterval}>{item.intervals[r.grade]}</span>
                    <kbd className={styles.kbd}>{r.key}</kbd>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button type="button" className={`${ui.buttonPrimary} ${styles.flip}`} onClick={() => setFlipped(true)}>
              顯示答案 <kbd className={styles.kbd}>空白鍵</kbd>
            </button>
          )}
        </section>
      ) : (
        <Done state={state} pending={pending} onRefresh={() => apply(getReviewStateAction)} />
      )}

      <Stats stats={stats} />
    </div>
  );
}

function Answer({ item }: { item: NonNullable<ReviewState["item"]> }) {
  const forms = new Set([item.headword, ...item.forms]);
  return (
    <div className={styles.back}>
      {item.zh.length > 0 && (
        <ul className={styles.zhList}>
          {item.zh.map((d, i) => (
            <li key={i}>
              {d.pos && <span className={styles.pos}>{d.pos}</span>}
              <span>{d.text}</span>
            </li>
          ))}
        </ul>
      )}
      {item.en.length > 0 && (
        <ol className={styles.enList}>
          {item.en.map((d, i) => (
            <li key={i}>
              {d.pos && <span className={styles.pos}>{d.pos}</span>}
              {d.text}
            </li>
          ))}
        </ol>
      )}
      {item.examples.length > 0 && (
        <ul className={styles.examples}>
          {item.examples.map((ex) => (
            <li key={ex.id}>
              <div className={styles.exampleEn}>
                <p>{highlight(ex.textEn, forms)}</p>
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
      )}
      <Link href={wordHref(item.headword)} className={styles.wordLink} target="_blank">
        查看完整單字頁 ↗
      </Link>
    </div>
  );
}

function Done({ state, pending, onRefresh }: { state: ReviewState; pending: boolean; onRefresh: () => void }) {
  const nextDue = state.nextLearningDue ? new Date(state.nextLearningDue) : null;
  return (
    <section className={`${ui.card} ${styles.done}`}>
      <p className={styles.doneTitle}>{state.stats.reviewedToday > 0 ? "今天的複習完成了 🎉" : "目前沒有要複習的卡片"}</p>
      {nextDue ? (
        <>
          <p className={ui.muted}>還有學習中的卡片，最早在 {timeFormat.format(nextDue)} 到期。</p>
          <div>
            <button type="button" className={ui.button} onClick={onRefresh} disabled={pending}>
              重新整理
            </button>
          </div>
        </>
      ) : (
        <p className={ui.muted}>
          收藏新的單字就會自動建立字卡。<Link href="/saved">我的單字</Link>
        </p>
      )}
    </section>
  );
}

function Stats({ stats }: { stats: ReviewState["stats"] }) {
  const max = Math.max(1, ...stats.forecast.map((d) => d.count));
  return (
    <section className={styles.stats} aria-label="統計">
      <dl className={styles.statNumbers}>
        <div>
          <dt>今日已複習</dt>
          <dd>{stats.reviewedToday}</dd>
        </div>
        <div>
          <dt>連續天數</dt>
          <dd>{stats.streak}</dd>
        </div>
      </dl>
      <div>
        <h2 className={styles.statsTitle}>未來 7 天到期</h2>
        <ol className={styles.forecast}>
          {stats.forecast.map((d, i) => (
            <li key={d.date} title={`${d.date}：${d.count} 張`}>
              <span className={styles.barCount}>{d.count}</span>
              <span className={styles.bar} style={{ height: `${(d.count / max) * 70}%` }} />
              <span className={styles.barLabel}>{i === 0 ? "今天" : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
