"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createWordbookAction, deleteWordbookAction, updateWordbookAction, type ActionResult } from "@/app/actions";
import ui from "@/components/ui.module.css";
import styles from "./wordbook-manager.module.css";

type Wordbook = { id: string; name: string; description: string | null; count: number };

export function WordbookManager({ wordbooks }: { wordbooks: Wordbook[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const act = (fn: () => Promise<ActionResult<unknown>>, onOk?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) onOk?.();
      else setError(result.error);
    });

  return (
    <div className={styles.wrap}>
      <WordbookForm
        submitLabel="新增單字本"
        pending={pending}
        onSubmit={(name, description, reset) => act(() => createWordbookAction(name, description), reset)}
      />

      {error && (
        <p className={ui.error} role="alert">
          {error}
        </p>
      )}

      {wordbooks.length === 0 ? (
        <p className={ui.muted}>還沒有單字本。</p>
      ) : (
        <ul className={styles.list}>
          {wordbooks.map((b) => (
            <li key={b.id} className={styles.item}>
              {editing === b.id ? (
                <WordbookForm
                  initial={b}
                  submitLabel="儲存"
                  pending={pending}
                  onCancel={() => setEditing(null)}
                  onSubmit={(name, description) =>
                    act(() => updateWordbookAction(b.id, name, description), () => setEditing(null))
                  }
                />
              ) : (
                <>
                  <div className={styles.info}>
                    <Link href={`/saved?book=${b.id}`} className={styles.name}>
                      {b.name}
                    </Link>
                    <span className={ui.muted}>{b.count} 個字</span>
                    {b.description && <p className={styles.description}>{b.description}</p>}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" className={ui.buttonGhost} disabled={pending} onClick={() => setEditing(b.id)}>
                      編輯
                    </button>
                    <button
                      type="button"
                      className={ui.buttonGhost}
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`確定要刪除「${b.name}」嗎？裡面的字仍會保留在收藏中。`)) {
                          act(() => deleteWordbookAction(b.id));
                        }
                      }}
                    >
                      刪除
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WordbookForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; description: string | null };
  submitLabel: string;
  pending: boolean;
  onSubmit: (name: string, description: string, reset: () => void) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const reset = () => {
    setName("");
    setDescription("");
  };
  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name, description, reset);
      }}
    >
      <input
        className={ui.input}
        value={name}
        maxLength={50}
        placeholder="單字本名稱，例如：多益、影集"
        aria-label="單字本名稱"
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className={ui.input}
        value={description}
        maxLength={200}
        placeholder="說明（選填）"
        aria-label="說明"
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className={styles.actions}>
        <button type="submit" className={ui.buttonPrimary} disabled={pending || !name.trim()}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={ui.buttonGhost} onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}
