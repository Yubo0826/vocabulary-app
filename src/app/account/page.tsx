import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { account } from "@/db/schema";
import { requireUser } from "@/lib/session";
import ui from "@/components/ui.module.css";
import { AccountActions } from "./account-actions";

export const metadata = { title: "帳號" };

const PROVIDER_LABELS: Record<string, string> = { credential: "Email 與密碼", google: "Google" };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className={ui.muted}>載入中…</p>}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const user = await requireUser("/account");
  const providers = (
    await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, user.id))
  ).map((a) => a.providerId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: "1.6rem" }}>帳號</h1>
      <dl className={ui.card} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 16px" }}>
        <dt className={ui.muted}>暱稱</dt>
        <dd>{user.name || "—"}</dd>
        <dt className={ui.muted}>Email</dt>
        <dd style={{ overflowWrap: "anywhere" }}>{user.email}</dd>
        <dt className={ui.muted}>登入方式</dt>
        <dd>{providers.map((p) => PROVIDER_LABELS[p] ?? p).join("、")}</dd>
      </dl>
      <AccountActions hasPassword={providers.includes("credential")} />
    </div>
  );
}
