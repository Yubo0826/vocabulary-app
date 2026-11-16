"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { updateSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
            <Select
              value={String(values.desiredRetention)}
              onValueChange={(v) => setValues({ ...values, desiredRetention: Number(v) })}
            >
              <SelectTrigger id={id} className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {retentionOptions.map((r) => (
                  <SelectItem key={r} value={String(r)} className={itemClass}>
                    {Math.round(r * 100)}%{r === 0.9 ? "（預設）" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="換日時間" hint={`這個時間之前的複習算前一天，適合熬夜的人。時區：${timezone}`}>
          {(id) => (
            <Select
              value={String(values.dayStartsAtHour)}
              onValueChange={(v) => setValues({ ...values, dayStartsAtHour: Number(v) })}
            >
              <SelectTrigger id={id} className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              {/* 24 個選項太長，限制高度捲動 */}
              <SelectContent position="popper" className="max-h-72">
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)} className={itemClass}>
                    {String(h).padStart(2, "0")}:00{h === 4 ? "（預設）" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
const selectClass = "w-full text-base data-[size=default]:h-10";
const itemClass = "py-2 pl-2.5 text-base";

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
