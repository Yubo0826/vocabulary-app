"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email 或密碼錯誤",
  USER_ALREADY_EXISTS: "這個 Email 已經註冊過了",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "這個 Email 已經註冊過了",
  PASSWORD_TOO_SHORT: "密碼至少需要 8 個字元",
  PASSWORD_TOO_LONG: "密碼太長",
  INVALID_EMAIL: "Email 格式不正確",
};

const messageOf = (error: { code?: string; message?: string } | null | undefined) =>
  (error?.code && ERROR_MESSAGES[error.code]) || "發生錯誤，請稍後再試";

export function AuthForm({ mode, next, googleEnabled }: { mode: "login" | "signup"; next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignup = mode === "signup";

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setPending(true);
    setError(null);
    const { error } = isSignup
      ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
      : await authClient.signIn.email({ email, password });
    if (error) {
      setError(messageOf(error));
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  };

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      setError(messageOf(error));
      setPending(false);
    }
  };

  const otherHref = `${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`;

  return (
    <div className="mx-auto flex max-w-[380px] flex-col gap-4 pt-[clamp(8px,6vh,48px)]">
      <h1 className="text-2xl font-semibold">{isSignup ? "註冊" : "登入"}</h1>

      {googleEnabled && (
        <>
          <Button type="button" variant="outline" className="h-11 text-[0.95rem]" onClick={signInWithGoogle} disabled={pending}>
            <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
              <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
            </svg>
            使用 Google 帳號{isSignup ? "註冊" : "登入"}
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            或使用 Email
            <Separator className="flex-1" />
          </div>
        </>
      )}

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        {isSignup && (
          <Field label="暱稱（選填）">
            <Input name="name" autoComplete="nickname" maxLength={50} className={inputClass} />
          </Field>
        )}
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label={`密碼${isSignup ? "（至少 8 個字元）" : ""}`}>
          <Input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            required
            className={inputClass}
          />
        </Field>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 text-[0.95rem]" disabled={pending}>
          {pending ? "處理中…" : isSignup ? "註冊" : "登入"}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {isSignup ? "已經有帳號了？" : "還沒有帳號？"}
        <Link href={otherHref}>{isSignup ? "登入" : "註冊"}</Link>
      </p>
    </div>
  );
}

const inputClass = "h-11 bg-card text-base md:text-base";

/** 標籤包住輸入框（點標籤會聚焦輸入框） */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Label className="flex-col items-stretch gap-1.5 font-normal text-muted-foreground">
      {label}
      {children}
    </Label>
  );
}
