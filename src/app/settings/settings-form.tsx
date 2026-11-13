"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Values = { newCardsPerDay: number; desiredRetention: number; dayStartsAtHour: number; frontExample: boolean };

const RETENTION_OPTIONS = [0.8, 0.85, 0.9, 0.95];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function SettingsForm({ initial, timezone }: { initial: Values; timezone: string }) {
  const [values, setValues] = useState(initial);
  const frontExampleId = useId();
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
    <Card className="px-4">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="每日新卡數" hint="每天最多開始學幾張新卡（0–500）。複習到期的卡不受限制。">
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={1}
              required
              className={controlClass}
              value={Number.isNaN(values.newCardsPerDay) ? "" : values.newCardsPerDay}
              onChange={(e) => setValues({ ...values, newCardsPerDay: e.target.valueAsNumber })}
            />
          )}
        </Field>

        <Field label="目標記憶保留率" hint="複習時希望還記得的機率。越高複習越頻繁；超過 95% 複習量會大幅增加。">
          {(id) => (
            <NativeSelect
              id={id}
              className="w-full [&_select]:h-10 [&_select]:text-base"
              value={values.desiredRetention}
              onChange={(e) => setValues({ ...values, desiredRetention: Number(e.target.value) })}
            >
              {retentionOptions.map((r) => (
                <option key={r} value={r}>
                  {Math.round(r * 100)}%{r === 0.9 ? "（預設）" : ""}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <Field label="換日時間" hint={`這個時間之前的複習算前一天，適合熬夜的人。時區：${timezone}`}>
          {(id) => (
            <NativeSelect
              id={id}
              className="w-full [&_select]:h-10 [&_select]:text-base"
              value={values.dayStartsAtHour}
              onChange={(e) => setValues({ ...values, dayStartsAtHour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00{h === 4 ? "（預設）" : ""}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id={frontExampleId}
              checked={values.frontExample}
              onCheckedChange={(checked) => setValues({ ...values, frontExample: checked === true })}
            />
            <Label htmlFor={frontExampleId}>題目顯示例句</Label>
          </div>
          <p className="text-sm text-muted-foreground">複習時在單字下方附一句英文例句，翻面後才顯示中文。每次複習輪流換一句。</p>
        </div>

        {message && (
          <p className={message.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"} role={message.ok ? "status" : "alert"}>
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            儲存
          </Button>
          <Button asChild variant="ghost" size="lg" className="text-primary">
            <Link href="/review">回到複習</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}

const controlClass = "h-10 text-base md:text-base";

function Field({ label, hint, children }: { label: string; hint: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground">
        {label}
      </Label>
      {children(id)}
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
