import { Suspense } from "react";
import { getSettings } from "@/lib/review";
import { requireUser } from "@/lib/session";
import ui from "@/components/ui.module.css";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "複習設定" };

export default function SettingsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: "1.6rem" }}>複習設定</h1>
      <Suspense fallback={<p className={ui.muted}>載入中…</p>}>
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
      }}
      timezone={settings.timezone}
    />
  );
}
