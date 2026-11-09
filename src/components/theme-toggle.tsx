"use client";

/**
 * 明暗模式切換。主題由 <html> 的 .dark class 決定：
 * - 沒手動選過時跟隨系統設定（含系統即時切換）
 * - 按過按鈕後把選擇存在 localStorage（key: theme）
 * 首次繪製前由 layout 的 THEME_SCRIPT 套用，避免閃爍。圖示用 CSS 依 .dark 切換，伺服器與用戶端輸出一致。
 */
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const KEY = "theme";

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function stored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** 在 <head> 內嵌執行：首次繪製前套用主題 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function ThemeToggle() {
  // 沒手動選過時，系統切換明暗也跟著變
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!stored()) apply(mq.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    apply(dark);
    try {
      localStorage.setItem(KEY, dark ? "dark" : "light");
    } catch {
      // 無痕模式等無法儲存時，只在這次瀏覽有效
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon" onClick={toggle} aria-label="切換明暗模式" title="切換明暗模式">
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  );
}
