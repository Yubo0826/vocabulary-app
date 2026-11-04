"use client";

import { useState, useTransition } from "react";
import {
  createWordbookAction,
  saveWordAction,
  setWordbookMembershipAction,
  unsaveWordAction,
  updateNoteAction,
  type ActionResult,
} from "@/app/actions";
import ui from "./ui.module.css";
import styles from "./save-controls.module.css";

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
      <div className={styles.panel}>
        <button type="button" className={ui.buttonPrimary} disabled={pending} onClick={() => act(() => saveWordAction(headword))}>
          ☆ 收藏
        </button>
        {error && <p className={ui.error}>{error}</p>}
      </div>
    );
  }

  return (
    <div className={`${ui.card} ${styles.panel}`}>
      <div className={styles.row}>
        <span className={styles.savedLabel}>★ 已收藏</span>
        <button
          type="button"
          className={ui.buttonGhost}
          disabled={pending}
          onClick={() => act(() => unsaveWordAction(headword))}
        >
          取消收藏
        </button>
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

      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function NoteEditor({ initial, pending, onSave }: { initial: string; pending: boolean; onSave: (note: string) => void }) {
  const [note, setNote] = useState(initial);
  const dirty = note.trim() !== initial.trim();
  return (
    <div className={styles.note}>
      <label className={ui.label}>
        個人筆記
        <textarea
          className={ui.textarea}
          value={note}
          maxLength={2000}
          placeholder="例如：在哪裡看到、容易搞混的字、自己的例句…"
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {dirty && (
        <div className={styles.row}>
          <button type="button" className={ui.button} disabled={pending} onClick={() => onSave(note)}>
            儲存筆記
          </button>
          <button type="button" className={ui.buttonGhost} disabled={pending} onClick={() => setNote(initial)}>
            取消
          </button>
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
    <fieldset className={styles.books}>
      <legend className={ui.muted}>單字本</legend>
      {wordbooks.length > 0 && (
        <div className={styles.bookList}>
          {wordbooks.map((b) => (
            <label key={b.id} className={b.contains ? `${styles.chip} ${styles.chipOn}` : styles.chip}>
              <input type="checkbox" checked={b.contains} disabled={pending} onChange={(e) => onToggle(b.id, e.target.checked)} />
              {b.name}
            </label>
          ))}
        </div>
      )}
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name, () => setName(""));
        }}
      >
        <input
          className={ui.input}
          value={name}
          maxLength={50}
          placeholder="新增單字本並加入"
          aria-label="新單字本名稱"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className={ui.button} disabled={pending || !name.trim()}>
          新增
        </button>
      </form>
    </fieldset>
  );
}
