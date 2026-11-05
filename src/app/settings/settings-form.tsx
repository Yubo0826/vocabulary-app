"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import ui from "@/components/ui.module.css";

type Values = { newCardsPerDay: number; desiredRetention: number; dayStartsAtHour: number };

const RETENTION_OPTIONS = [0.8, 0.85, 0.9, 0.95];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function SettingsForm({ initial, timezone }: { initial: Values; timezone: string }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const retentionOptions = RETENTION_OPTIONS.includes(initial.desiredRetention)
    ? RETENTION_OPTIONS
    : [...RETENTION_OPTIONS, initial.desiredRetention].sort();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      setMessage(null);
      const result = await updateSettingsAction(values);
      setMessage(result.ok ? { ok: true, text: "已儲存" } : { ok: false, text: result.error });
    });
  };

  return (
    <form onSubmit={submit} className={ui.card} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <label className={ui.label}>
        每日新卡數
        <input
          className={ui.input}
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          step={1}
          required
          value={Number.isNaN(values.newCardsPerDay) ? "" : values.newCardsPerDay}
          onChange={(e) => setValues({ ...values, newCardsPerDay: e.target.valueAsNumber })}
        />
        <span>每天最多開始學幾張新卡（0–500）。複習到期的卡不受限制。</span>
      </label>

      <label className={ui.label}>
        目標記憶保留率
        <select
          className={ui.input}
          value={values.desiredRetention}
          onChange={(e) => setValues({ ...values, desiredRetention: Number(e.target.value) })}
        >
          {retentionOptions.map((r) => (
            <option key={r} value={r}>
              {Math.round(r * 100)}%{r === 0.9 ? "（預設）" : ""}
            </option>
          ))}
        </select>
        <span>複習時希望還記得的機率。越高複習越頻繁；超過 95% 複習量會大幅增加。</span>
      </label>

      <label className={ui.label}>
        換日時間
        <select
          className={ui.input}
          value={values.dayStartsAtHour}
          onChange={(e) => setValues({ ...values, dayStartsAtHour: Number(e.target.value) })}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00{h === 4 ? "（預設）" : ""}
            </option>
          ))}
        </select>
        <span>這個時間之前的複習算前一天，適合熬夜的人。時區：{timezone}</span>
      </label>

      {message && (
        <p className={message.ok ? ui.muted : ui.error} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" className={ui.buttonPrimary} disabled={pending}>
          儲存
        </button>
        <Link href="/review" className={ui.buttonGhost}>
          回到複習
        </Link>
      </div>
    </form>
  );
}
