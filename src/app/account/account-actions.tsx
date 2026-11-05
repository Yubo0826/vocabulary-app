"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountActions({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  const signOut = async () => {
    setPending(true);
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <>
      <div>
        <Button variant="outline" size="lg" onClick={signOut} disabled={pending}>
          登出
        </Button>
      </div>

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
              <Button type="submit" variant="destructive" size="lg" disabled={pending}>
                永久刪除帳號
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={() => setConfirming(false)} disabled={pending}>
                取消
              </Button>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}
