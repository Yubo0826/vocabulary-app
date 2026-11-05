"use client";

import { useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/** 發音（瀏覽器 Web Speech API）與美式／英式口音切換；口音選擇存在 localStorage */

const ACCENTS = [
  { lang: "en-US", label: "美式" },
  { lang: "en-GB", label: "英式" },
] as const;
type Accent = (typeof ACCENTS)[number]["lang"];

const STORAGE_KEY = "accent";
const CHANGE_EVENT = "accent-change";

function readAccent(): Accent {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en-GB" ? "en-GB" : "en-US";
  } catch {
    return "en-US";
  }
}

function subscribeAccent(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function setAccent(accent: Accent) {
  try {
    localStorage.setItem(STORAGE_KEY, accent);
  } catch {
    // 無痕模式等無法寫入時，只在這次頁面中生效
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const useAccent = () => useSyncExternalStore(subscribeAccent, readAccent, () => "en-US" as Accent);

const noopSubscribe = () => () => {};
const useSpeechSupported = () =>
  useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);

function speak(text: string, lang: Accent) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  const voice = synth.getVoices().find((v) => v.lang.replace("_", "-") === lang);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function SpeakButton({ text, size = "md" }: { text: string; size?: "md" | "sm" }) {
  const accent = useAccent();
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <Button
      type="button"
      variant={size === "sm" ? "ghost" : "outline"}
      size={size === "sm" ? "icon-sm" : "icon-lg"}
      className={cn("rounded-full text-primary", size === "md" && "size-10")}
      onClick={() => speak(text, accent)}
      aria-label={`播放「${text}」的發音`}
      title="播放發音"
    >
      <Volume2 className={size === "sm" ? "size-4" : "size-5"} />
    </Button>
  );
}

export function AccentToggle() {
  const accent = useAccent();
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={accent}
      onValueChange={(v) => v && setAccent(v as Accent)}
      aria-label="發音口音"
    >
      {ACCENTS.map((a) => (
        <ToggleGroupItem
          key={a.lang}
          value={a.lang}
          className="px-3 text-muted-foreground data-[state=on]:bg-accent data-[state=on]:font-semibold data-[state=on]:text-accent-foreground"
        >
          {a.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
