import type { MetadataRoute } from "next";

/**
 * PWA manifest（/manifest.webmanifest）：讓手機可以「加入主畫面」，以全螢幕開啟。
 * 圖示在 public/icons/（藍色漸層底白色 M；maskable 為滿版，供 Android 裁切成各種形狀）。
 * 顏色與 globals.css 的淺色主題相同。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moji 單字本",
    short_name: "Moji",
    description: "有雲端同步與間隔重複複習的英文單字 App",
    lang: "zh-TW",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7ff",
    theme_color: "#4263eb",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
