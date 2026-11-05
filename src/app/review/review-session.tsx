"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { getReviewStateAction, reviewCardAction, undoReviewAction, type ActionResult } from "@/app/actions";
import { ExampleSource, highlight } from "@/components/example-text";
import { AccentToggle, SpeakButton } from "@/components/speech";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReviewState } from "@/lib/review-session";
import { wordHref } from "@/lib/urls";
import { cn } from "@/lib/utils";

const RATINGS = [
  { grade: 1, label: "忘記", key: "1", className: "text-again" },
  { grade: 2, label: "困難", key: "2", className: "text-hard" },
  { grade: 3, label: "記得", key: "3", className: "text-good" },
  { grade: 4, label: "簡單", key: "4", className: "text-easy" },
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
    <div className="flex flex-col gap-4">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3.5 gap-y-1 text-sm tabular-nums" aria-label="今日剩餘">
        <span className="text-easy">新卡 {counts.new}</span>
        <span className="text-hard">學習中 {counts.learning}</span>
        <span className="text-primary">複習 {counts.review}</span>
        {reviewedInSession > 0 && (
          <Button variant="ghost" className="ml-auto text-primary" onClick={undo} disabled={pending} title="快捷鍵：Z">
            <Undo2 /> 復原上一張
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {item ? (
        <Card className="gap-5 px-4 py-6 text-base" aria-live="polite">
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {STATE_LABELS[item.state]}
            </Badge>
            <div className="flex max-w-full items-center gap-2">
              <h2 className="text-4xl leading-tight font-bold wrap-anywhere">{item.display}</h2>
              <SpeakButton text={item.display} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-muted-foreground">
              {item.phonetic && <span className="font-mono">/{item.phonetic}/</span>}
              <AccentToggle />
            </div>
          </div>

          {flipped ? (
            <>
              <Answer item={item} />
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((r) => (
                  <Button
                    key={r.grade}
                    variant="outline"
                    className={cn("h-auto min-h-16 flex-col gap-0.5 border-current px-1 py-2 hover:text-current dark:border-current", r.className)}
                    onClick={() => rate(r.grade)}
                    disabled={pending}
                  >
                    <span className="text-base font-semibold">{r.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">{item.intervals[r.grade]}</span>
                    <Kbd>{r.key}</Kbd>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <Button className="h-12 w-full text-base" onClick={() => setFlipped(true)}>
              顯示答案 <Kbd>空白鍵</Kbd>
            </Button>
          )}
        </Card>
      ) : (
        <Done state={state} pending={pending} onRefresh={() => apply(getReviewStateAction)} />
      )}

      <Stats stats={stats} />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-current px-1 font-mono text-[0.7rem] font-normal opacity-70">{children}</kbd>;
}

function Pos({ children }: { children: React.ReactNode }) {
  return <span className="mr-1.5 text-sm text-muted-foreground">{children}</span>;
}

function Answer({ item }: { item: NonNullable<ReviewState["item"]> }) {
  const forms = new Set([item.headword, ...item.forms]);
  return (
    <div className="flex flex-col gap-3.5 border-t pt-4">
      {item.zh.length > 0 && (
        <ul className="flex flex-col gap-1 text-lg">
          {item.zh.map((d, i) => (
            <li key={i}>
              {d.pos && <Pos>{d.pos}</Pos>}
              <span>{d.text}</span>
            </li>
          ))}
        </ul>
      )}
      {item.en.length > 0 && (
        <ol className="list-decimal pl-6 text-[0.95rem] text-muted-foreground">
          {item.en.map((d, i) => (
            <li key={i}>
              {d.pos && <Pos>{d.pos}</Pos>}
              {d.text}
            </li>
          ))}
        </ol>
      )}
      {item.examples.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {item.examples.map((ex) => (
            <li key={ex.id}>
              <div className="flex items-start gap-1">
                <p>{highlight(ex.textEn, forms)}</p>
                <SpeakButton text={ex.textEn} size="sm" />
                <ExampleSource example={ex} />
              </div>
              {ex.textZh && <p className="text-muted-foreground">{ex.textZh}</p>}
            </li>
          ))}
        </ul>
      )}
      <Link href={wordHref(item.headword)} className="self-start text-sm" target="_blank">
        查看完整單字頁 ↗
      </Link>
    </div>
  );
}

function Done({ state, pending, onRefresh }: { state: ReviewState; pending: boolean; onRefresh: () => void }) {
  const nextDue = state.nextLearningDue ? new Date(state.nextLearningDue) : null;
  return (
    <Card className="gap-2 px-4">
      <p className="text-lg font-semibold">{state.stats.reviewedToday > 0 ? "今天的複習完成了 🎉" : "目前沒有要複習的卡片"}</p>
      {nextDue ? (
        <>
          <p className="text-sm text-muted-foreground">還有學習中的卡片，最早在 {timeFormat.format(nextDue)} 到期。</p>
          <div>
            <Button variant="outline" size="lg" onClick={onRefresh} disabled={pending}>
              重新整理
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          收藏新的單字就會自動建立字卡。<Link href="/saved">我的單字</Link>
        </p>
      )}
    </Card>
  );
}

function Stats({ stats }: { stats: ReviewState["stats"] }) {
  const max = Math.max(1, ...stats.forecast.map((d) => d.count));
  return (
    <Card className="gap-4 px-4" aria-label="統計">
      <dl className="grid grid-cols-2 gap-2">
        <div>
          <dt className="text-muted-foreground">今日已複習</dt>
          <dd className="text-2xl font-semibold tabular-nums">{stats.reviewedToday}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">連續天數</dt>
          <dd className="text-2xl font-semibold tabular-nums">{stats.streak}</dd>
        </div>
      </dl>
      <div>
        <h2 className="mb-2 text-muted-foreground">未來 7 天到期</h2>
        <ol className="grid h-30 grid-cols-7 gap-1.5">
          {stats.forecast.map((d, i) => (
            <li key={d.date} title={`${d.date}：${d.count} 張`} className="flex min-w-0 flex-col items-center justify-end gap-0.5">
              <span className="text-xs tabular-nums">{d.count}</span>
              <span className="min-h-0.5 w-full max-w-7 rounded-t-sm bg-primary" style={{ height: `${(d.count / max) * 70}%` }} />
              <span className="text-[0.7rem] whitespace-nowrap text-muted-foreground">
                {i === 0 ? "今天" : `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
