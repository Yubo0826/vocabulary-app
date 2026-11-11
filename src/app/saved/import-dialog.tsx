"use client";

/** 「我的單字」與「管理單字本」標題列的匯入按鈕：貼上或選擇純文字檔，每行一個單字 */
import { Download } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { importWordsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ImportResult } from "@/lib/user-data";

const MAX_FILE_BYTES = 1_000_000;

export function ImportDialog({ wordbooks, defaultWordbookId }: { wordbooks: { id: string; name: string }[]; defaultWordbookId: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [wordbookId, setWordbookId] = useState(defaultWordbookId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setText("");
    setError(null);
    setResult(null);
    setWordbookId(defaultWordbookId ?? "");
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("檔案太大（上限 1 MB），請分批匯入");
      return;
    }
    setError(null);
    setText(await file.text());
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const r = await importWordsAction(text, wordbookId || null);
      if (r.ok) setResult(r.data);
      else setError(r.error);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="匯入單字" title="匯入單字">
          <Download />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>匯入單字</DialogTitle>
          <DialogDescription>
            每行一個單字或片語；一行有 Tab 或逗號時只讀第一欄，Anki、Quizlet 等匯出的檔案可直接使用。變化形（went）會轉成原形（go）。
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <ImportSummary result={result} />
        ) : (
          <div className="flex flex-col gap-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"apple\ntake off\nwent"}
              aria-label="要匯入的單字"
              rows={8}
              className="max-h-[40vh] font-mono text-base md:text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                選擇檔案
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".txt,.csv,.tsv,text/plain,text/csv"
                className="hidden"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = ""; // 同一個檔案可再選一次
                }}
              />
              <span className="text-xs text-muted-foreground">.txt、.csv，一次最多 2,000 個字</span>
            </div>
            {wordbooks.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <span className="shrink-0">放進單字本</span>
                <NativeSelect value={wordbookId} onChange={(e) => setWordbookId(e.target.value)} className="min-w-0 flex-1">
                  <NativeSelectOption value="">不放進單字本</NativeSelectOption>
                  {wordbooks.map((b) => (
                    <NativeSelectOption key={b.id} value={b.id}>
                      {b.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>
                再匯入一批
              </Button>
              <Button onClick={() => setOpen(false)}>完成</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={submit} disabled={pending || !text.trim()}>
                {pending ? "匯入中…" : "匯入"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const { added, alreadySaved, converted, notFound } = result;
  return (
    <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto text-sm">
      <p className="text-base">
        新增 <strong>{added}</strong> 個字
        {alreadySaved > 0 && <>，{alreadySaved} 個已經收藏過</>}
        {notFound.length > 0 && <>，{notFound.length} 個找不到</>}。
      </p>
      {notFound.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="font-semibold">找不到的字（可能拼錯，或字典沒有收錄）</p>
          <p className="wrap-anywhere text-muted-foreground">{notFound.join("、")}</p>
        </div>
      )}
      {converted.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">轉成原形的字（{converted.length}）</summary>
          <p className="mt-1 wrap-anywhere text-muted-foreground">{converted.map((c) => `${c.from} → ${c.to}`).join("、")}</p>
        </details>
      )}
    </div>
  );
}
