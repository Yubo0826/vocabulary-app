import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { db } from "@/db";
import { account } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { DeleteAccount, SignOutButton } from "./account-actions";

export const metadata = { title: "帳號" };

const PROVIDER_LABELS: Record<string, string> = { credential: "Email 與密碼", google: "Google" };

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
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
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">帳號</h1>
        <div className="ml-auto">
          <SignOutButton />
        </div>
      </div>
      <Card className="px-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
          <dt className="text-muted-foreground">暱稱</dt>
          <dd>{user.name || "—"}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="wrap-anywhere">{user.email}</dd>
          <dt className="text-muted-foreground">登入方式</dt>
          <dd>{providers.map((p) => PROVIDER_LABELS[p] ?? p).join("、")}</dd>
        </dl>
      </Card>
      <DeleteAccount email={user.email} hasPassword={providers.includes("credential")} />
    </div>
  );
}
