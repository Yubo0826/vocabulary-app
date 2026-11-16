"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NAME_MAX = 50;

/** 帳號頁的暱稱：旁邊的「編輯」打開視窗修改 */
export function NicknameField({ name }: { name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = draft.trim();

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(name); // 每次打開都從目前的暱稱開始
      setError(null);
    }
    setOpen(next);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (trimmed === name) return setOpen(false);
    setPending(true);
    setError(null);
    const { error } = await authClient.updateUser({ name: trimmed });
    setPending(false);
    if (error) {
      setError("儲存失敗，請稍後再試");
      return;
    }
    setOpen(false);
    router.refresh(); // 頁首與本頁都從伺服器重新讀取暱稱
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate">{name || "—"}</span>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="-my-1 text-primary-ink">
            <Pencil /> 編輯
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <form onSubmit={save} className="contents">
            <DialogHeader>
              <DialogTitle>編輯暱稱</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={draft}
              maxLength={NAME_MAX}
              aria-label="暱稱"
              disabled={pending}
              className="h-10 text-base md:text-sm"
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value)}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  取消
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending || !trimmed}>
                儲存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 標題列右側的登出按鈕 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <Button variant="outline" onClick={signOut} disabled={pending}>
      登出
    </Button>
  );
}

export function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  // 要求手動輸入自己的 Email，避免誤按；不分大小寫、忽略頭尾空白
  const emailMatches = typedEmail.trim().toLowerCase() === email.toLowerCase();

  const cancel = () => {
    setConfirming(false);
    setTypedEmail("");
    setPassword("");
    setError(null);
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailMatches) return;
    setPending(true);
    setError(null);
    const { error } = await authClient.deleteUser(hasPassword ? { password } : {});
    if (error) {
      setPending(false);
      setError(
        error.code === "INVALID_PASSWORD"
          ? "密碼錯誤"
          : error.code === "SESSION_EXPIRED"
            ? "為了安全，請登出後重新登入，再執行刪除帳號"
            : "刪除失敗，請稍後再試",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <Card className="gap-3 px-4">
      <h2 className="text-[1.05rem] font-semibold">刪除帳號</h2>
      <p className="text-sm text-muted-foreground">刪除後，你的收藏、筆記、單字本、字卡與複習紀錄會全部永久刪除，無法復原。</p>
      {!confirming ? (
        <div>
          <Button variant="destructive" size="lg" onClick={() => setConfirming(true)}>
            我要刪除帳號
          </Button>
        </div>
      ) : (
        <form onSubmit={deleteAccount} className="flex flex-col gap-2.5">
          <Label className="flex-col items-stretch gap-1.5 font-normal text-muted-foreground">
            <span>
              請輸入你的 Email <span className="font-medium text-foreground">{email}</span> 確認
            </span>
            <Input
              type="email"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              required
              value={typedEmail}
              className="h-10 text-base md:text-sm"
              onChange={(e) => setTypedEmail(e.target.value)}
            />
          </Label>
          {hasPassword && (
            <Label className="flex-col items-stretch gap-1.5 font-normal text-muted-foreground">
              請輸入密碼確認
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                className="h-10 text-base md:text-sm"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Label>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" size="lg" disabled={pending || !emailMatches || (hasPassword && !password)}>
              永久刪除帳號
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={cancel} disabled={pending}>
              取消
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
