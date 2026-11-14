import type { Metadata, Viewport } from "next";
import { Geist_Mono, Roboto_Flex } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { THEME_SCRIPT, ThemeToggle } from "@/components/theme-toggle";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

// 英文用 Google 的 Roboto Flex（Material 3 預設字型）；中文沒有收錄，會接到 globals.css 裡的系統中文字型
const robotoFlex = Roboto_Flex({
  variable: "--font-roboto-flex",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Moji 單字本", template: "%s｜Moji" },
  description: "Moji：有雲端同步與間隔重複複習的英文單字 App",
  // iOS「加入主畫面」：全螢幕開啟、主畫面上的名稱（圖示是 app/apple-icon.png）
  appleWebApp: { capable: true, title: "Moji", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 瀏覽器網址列／狀態列顏色，跟著系統深淺色（與 globals.css 的背景色相同）
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#131318" },
  ],
};

/** 頁首、內容、頁尾共用的寬度與左右留白 */
const container = "mx-auto w-full max-w-[720px] px-4";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning：THEME_SCRIPT 會在 React 接手前加上 .dark class
    <html lang="zh-Hant-TW" className={`${robotoFlex.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <header className="relative z-10 bg-background">
          {/* 手機時導航換到第二列（見 UserNav） */}
          <div className={`${container} flex flex-wrap items-center gap-x-3`}>
            <Link
              href="/"
              className="flex h-13 items-center text-lg font-bold tracking-wider text-foreground hover:no-underline"
            >
              Moji
              <span className="ml-1.5 tracking-normal">單字本</span>
            </Link>
            <Suspense fallback={<span className="ml-auto" />}>
              <UserNav />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>
        <main className={`${container} flex-1 pt-6 pb-12`}>{children}</main>
        <footer className="border-t text-xs text-muted-foreground">
          <div className={`${container} pt-4 pb-6`}>
            字典資料來自 ECDICT（MIT）、Open English WordNet（CC BY 4.0）與 Tatoeba（CC BY 2.0 FR／CC0）。
            <Link href="/about">資料來源與授權</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
