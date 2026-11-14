"use client";

import { useEffect, useSyncExternalStore } from "react";
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

/**
 * Web Speech API 沒有「性別」屬性，只能用聲音名稱挑。依序優先使用這些女聲（找不到就用該口音的第一個聲音）：
 * Edge 的自然語音（Online (Natural)）> Chrome 的 Google 語音 > Windows 內建 > macOS／iOS 內建
 */
const FEMALE_VOICES: Record<Accent, string[]> = {
  "en-US": ["Aria", "Jenny", "Ava", "Emma", "Michelle", "Google US English", "Zira", "Samantha", "Allison", "Susan"],
  "en-GB": ["Sonia", "Libby", "Maisie", "Google UK English Female", "Hazel", "Susan", "Serena", "Kate", "Stephanie"],
};

function pickVoice(voices: SpeechSynthesisVoice[], lang: Accent): SpeechSynthesisVoice | undefined {
  const candidates = voices.filter((v) => v.lang.replace("_", "-") === lang);
  for (const name of FEMALE_VOICES[lang]) {
    const voice = candidates.find((v) => v.name.includes(name));
    if (voice) return voice;
  }
  return candidates[0];
}

function speak(text: string, lang: Accent) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  const voice = pickVoice(synth.getVoices(), lang);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function SpeakButton({
  text,
  size = "md",
  autoPlay = false,
}: {
  text: string;
  size?: "md" | "sm";
  /** 顯示時自動播放一次（單字頁標題用）。直接開網址或重新整理時，瀏覽器會因為使用者還沒互動過而擋下，屬正常 */
  autoPlay?: boolean;
}) {
  const accent = useAccent();
  const supported = useSpeechSupported();

  // 用 readAccent() 而不是 accent：切換口音時不要重播；離開頁面時停止還沒念完的聲音
  useEffect(() => {
    if (!autoPlay || !("speechSynthesis" in window)) return;
    speak(text, readAccent());
    return () => window.speechSynthesis.cancel();
  }, [autoPlay, text]);

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
      size="sm"
      spacing={0.5}
      className="rounded-full bg-muted p-0.5"
      value={accent}
      onValueChange={(v) => v && setAccent(v as Accent)}
      aria-label="發音口音"
    >
      {ACCENTS.map((a) => (
        <ToggleGroupItem
          key={a.lang}
          value={a.lang}
          className="rounded-full px-3 text-muted-foreground hover:bg-transparent data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {a.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
