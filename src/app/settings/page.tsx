import { Suspense } from "react";
import { getSettings } from "@/lib/review";
import { requireUser } from "@/lib/session";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "複習設定" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">複習設定</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">載入中…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const user = await requireUser("/settings");
  const settings = await getSettings(user.id);
  return (
    <SettingsForm
      initial={{
        newCardsPerDay: settings.newCardsPerDay,
        desiredRetention: settings.desiredRetention,
        dayStartsAtHour: settings.dayStartsAtHour,
        frontExample: settings.frontExample,
      }}
      timezone={settings.timezone}
    />
  );
}
