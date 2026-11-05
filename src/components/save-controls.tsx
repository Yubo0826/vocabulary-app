"use client";

import { Star } from "lucide-react";
import { useId, useState, useTransition } from "react";
import {
  createWordbookAction,
  saveWordAction,
  setWordbookMembershipAction,
  unsaveWordAction,
  updateNoteAction,
  type ActionResult,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  headword: string;
  saved: { id: string; note: string | null } | null;
  wordbooks: { id: string; name: string; contains: boolean }[];
};

export function SaveControls({ headword, saved, wordbooks }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** 執行 action；失敗時顯示錯誤。成功後伺服器端會 refresh()，props 會更新 */
  const act = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) onOk?.();
      else setError(result.error);
    });

  if (!saved) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button size="lg" disabled={pending} onClick={() => act(() => saveWordAction(headword))}>
          <Star /> 收藏
        </Button>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    );
  }

  return (
    <Card className="gap-4 px-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Star className="size-4 fill-current" /> 已收藏
        </span>
        <Button variant="ghost" disabled={pending} onClick={() => act(() => unsaveWordAction(headword))}>
          取消收藏
        </Button>
      </div>

      <NoteEditor key={saved.note ?? ""} initial={saved.note ?? ""} pending={pending} onSave={(note) => act(() => updateNoteAction(headword, note))} />

      <WordbookPicker
        wordbooks={wordbooks}
        pending={pending}
        onToggle={(id, member) => act(() => setWordbookMembershipAction(id, headword, member))}
        onCreate={(name, done) =>
          act(async () => {
            const created = await createWordbookAction(name);
            if (!created.ok) return created;
            return setWordbookMembershipAction(created.data.id, headword, true);
          }, done)
        }
      />

      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-destructive" role="alert">
      {children}
    </p>
  );
}

function NoteEditor({ initial, pending, onSave }: { initial: string; pending: boolean; onSave: (note: string) => void }) {
  const id = useId();
  const [note, setNote] = useState(initial);
  const dirty = note.trim() !== initial.trim();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-muted-foreground">
        個人筆記
      </Label>
      <Textarea
        id={id}
        value={note}
        maxLength={2000}
        placeholder="例如：在哪裡看到、容易搞混的字、自己的例句…"
        className="min-h-18 text-base md:text-sm"
        onChange={(e) => setNote(e.target.value)}
      />
      {dirty && (
        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => onSave(note)}>
            儲存筆記
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setNote(initial)}>
            取消
          </Button>
        </div>
      )}
    </div>
  );
}

function WordbookPicker({
  wordbooks,
  pending,
  onToggle,
  onCreate,
}: {
  wordbooks: Props["wordbooks"];
  pending: boolean;
  onToggle: (id: string, member: boolean) => void;
  onCreate: (name: string, done: () => void) => void;
}) {
  const [name, setName] = useState("");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-muted-foreground">單字本</legend>
      {wordbooks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {wordbooks.map((b) => (
            <Label
              key={b.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 font-normal",
                b.contains && "border-primary bg-accent text-accent-foreground",
              )}
            >
              <Checkbox checked={b.contains} disabled={pending} onCheckedChange={(v) => onToggle(b.id, v === true)} />
              {b.name}
            </Label>
          ))}
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name, () => setName(""));
        }}
      >
        <Input
          value={name}
          maxLength={50}
          placeholder="新增單字本並加入"
          aria-label="新單字本名稱"
          className="h-9 flex-1"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" variant="outline" size="lg" disabled={pending || !name.trim()}>
          新增
        </Button>
      </form>
    </fieldset>
  );
}
