import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "單字", template: "%s｜單字" },
  description: "有雲端同步與間隔重複複習的英文單字 App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** 頁首、內容、頁尾共用的寬度與左右留白 */
const container = "mx-auto w-full max-w-[720px] px-4";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="border-b bg-card">
          <div className={`${container} flex h-13 items-center`}>
            <Link href="/" className="text-lg font-bold tracking-wider text-foreground hover:no-underline">
              單字
            </Link>
            <Suspense fallback={null}>
              <UserNav />
            </Suspense>
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
