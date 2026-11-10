import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { getCurrentUser } from "@/lib/session";
import { wordHref } from "@/lib/urls";

const FEATURES = [
  {
    title: "查字",
    body: "中英、英英釋義與真人例句一次看完，還會列出易混淆字與近義字。輸入變化形（went）也能找到原形。",
    href: wordHref("receive"),
    cta: "看看 receive",
  },
  {
    title: "收藏與單字本",
    body: "查到的字一鍵收藏，分類到不同單字本、寫下自己的筆記。也能匯入或匯出純文字單字清單。",
    href: "/saved",
    cta: "我的單字",
  },
  {
    title: "間隔重複複習",
    body: "用 FSRS 演算法安排複習時間，快忘記時才出現。熟悉度用顏色標示，一眼看出哪些字還不熟。",
    href: "/review",
    cta: "開始複習",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col gap-16 pt-[clamp(16px,10vh,96px)]">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">查單字</h1>
        <SearchBox autoFocus />
      </section>

      <section aria-labelledby="features-title" className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h2 id="features-title" className="text-xl font-bold sm:text-2xl">
            查字、收藏、複習，一個 App 搞定
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            查到的字不再看過就忘：收藏起來，Moji 會在你快忘記的時候提醒你複習，手機電腦雲端同步。
          </p>
        </div>

        <ul className="grid w-full gap-3 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <Link
                href={f.href}
                className="group flex h-full flex-col gap-2 rounded-lg border bg-card p-4 text-foreground hover:border-primary hover:no-underline"
              >
                <h3 className="font-semibold">{f.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                <span className="mt-1 flex items-center justify-end gap-1 text-sm text-primary">
                  {f.cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Suspense fallback={null}>
          <StartLink />
        </Suspense>
      </section>
    </div>
  );
}

/** 未登入：建立帳號；已登入：開始複習。讀 session，需放在 Suspense 內 */
async function StartLink() {
  const user = await getCurrentUser();
  return user ? <Link href="/review">開始今天的複習</Link> : <Link href="/signup">免費建立帳號</Link>;
}
