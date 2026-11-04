"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import ui from "@/components/ui.module.css";

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
        <button type="button" className={ui.button} onClick={signOut} disabled={pending}>
          登出
        </button>
      </div>

      <section className={ui.card} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: "1.05rem" }}>刪除帳號</h2>
        <p className={ui.muted}>刪除後，你的收藏、筆記、單字本、字卡與複習紀錄會全部永久刪除，無法復原。</p>
        {!confirming ? (
          <div>
            <button type="button" className={ui.buttonDanger} onClick={() => setConfirming(true)}>
              我要刪除帳號
            </button>
          </div>
        ) : (
          <form onSubmit={deleteAccount} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {hasPassword && (
              <label className={ui.label}>
                請輸入密碼確認
                <input
                  className={ui.input}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {error && (
              <p className={ui.error} role="alert">
                {error}
              </p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className={ui.buttonDanger} disabled={pending}>
                永久刪除帳號
              </button>
              <button type="button" className={ui.buttonGhost} onClick={() => setConfirming(false)} disabled={pending}>
                取消
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
