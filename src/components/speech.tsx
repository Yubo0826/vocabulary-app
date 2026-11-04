"use client";

import { useSyncExternalStore } from "react";
import styles from "./speech.module.css";

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
    <button
      type="button"
      className={size === "sm" ? `${styles.speak} ${styles.small}` : styles.speak}
      onClick={() => speak(text, accent)}
      aria-label={`播放「${text}」的發音`}
      title="播放發音"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function AccentToggle() {
  const accent = useAccent();
  const supported = useSpeechSupported();
  if (!supported) return null;
  return (
    <div className={styles.toggle} role="radiogroup" aria-label="發音口音">
      {ACCENTS.map((a) => (
        <button
          key={a.lang}
          type="button"
          role="radio"
          aria-checked={accent === a.lang}
          className={accent === a.lang ? `${styles.option} ${styles.selected}` : styles.option}
          onClick={() => setAccent(a.lang)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
