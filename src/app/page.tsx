import { BookOpenCheck, Bookmark, Cloud, MousePointerClick, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export default function Home() {
  return (
    <div className="flex flex-col pt-[clamp(0px,4vh,40px)]">
      {/* 搜尋區：Material 3 的做法，不包卡片，大標題＋膠囊搜尋列（surface container high） */}
      <section className="flex flex-col gap-5 pt-8 pb-8 sm:pt-14">
        <h1 className="text-[2rem] leading-tight font-normal sm:text-[2.6rem]">查單字</h1>
        <SearchBox autoFocus />
      </section>
      {/* 介紹只給未登入的訪客；讀 session，放在 Suspense 內，搜尋區不受影響 */}
      <Suspense fallback={null}>
        <Intro />
      </Suspense>
    </div>
  );
}

/** 查字示意：輸入 went，提示列出原形 go */
function SearchPreview() {
  return (
    <div className="w-full max-w-52 overflow-hidden rounded-3xl bg-background text-sm shadow-sm">
      <div className="flex h-10 items-center gap-2 px-3.5">
        <Search className="size-4 text-muted-foreground" />
        <span>went</span>
        <span className="-ml-1.5 h-4 w-px bg-primary" />
      </div>
      <div className="mx-3.5 border-t" />
      <div className="flex items-baseline gap-2 px-3.5 py-2.5">
        <span className="font-semibold">go</span>
        <span className="truncate text-xs text-muted-foreground">去、走</span>
        <span className="ml-auto shrink-0 rounded-md bg-accent px-1.5 py-px text-[0.7rem] text-accent-foreground">原形</span>
      </div>
    </div>
  );
}

/** 收藏示意：「收藏至…」視窗的單字本清單，一本已放入 */
function SavePreview() {
  return (
    <div className="flex w-full max-w-52 flex-col rounded-2xl bg-background p-1.5 text-sm shadow-sm">
      {[
        { name: "托福單字", on: true },
        { name: "日常會話", on: false },
      ].map((b) => (
        <div key={b.name} className={`flex h-9 items-center justify-between rounded-lg px-2.5 ${b.on ? "bg-foreground/5" : ""}`}>
          {b.name}
          <Bookmark className={b.on ? "size-4 fill-primary text-primary" : "size-4 text-muted-foreground"} />
        </div>
      ))}
    </div>
  );
}

/** 複習示意：字卡上的單字與四個評分按鈕，「記得」被按下 */
function ReviewPreview() {
  const ratings = [
    { label: "忘記", className: "bg-again/10 text-again" },
    { label: "困難", className: "bg-hard/10 text-hard" },
    { label: "記得", className: "bg-good text-background" },
    { label: "簡單", className: "bg-easy/10 text-easy" },
  ];
  return (
    <div className="flex w-full max-w-52 flex-col items-center gap-3">
      <span className="text-xl font-bold">resilient</span>
      <div className="grid w-full grid-cols-4 gap-1">
        {ratings.map((r) => (
          <span key={r.label} className={`rounded-full py-1 text-center text-xs font-medium ${r.className}`}>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "查字",
    text: "輸入時即時提示，拼錯也找得到，went 會帶你到 go。釋義、音標、發音、例句一次看完。",
    Preview: SearchPreview,
  },
  {
    title: "收藏",
    text: "放進自己分類的單字本，標上熟悉度。每個字都能寫筆記，記下聯想和用法，之後在「筆記」頁一次翻找。",
    Preview: SavePreview,
  },
  {
    title: "複習",
    text: "收藏的字自動變成字卡，FSRS 依你的記憶狀況排出下一次複習的時間。",
    Preview: ReviewPreview,
  },
];

const DETAILS = [
  { icon: Cloud, title: "雲端同步", text: "手機、電腦接著用，手機可以加入主畫面。" },
  { icon: MousePointerClick, title: "閱讀時查字", text: "Chrome 擴充元件：讀英文網頁時反白＋Alt 就能查。" },
  { icon: BookOpenCheck, title: "出處清楚", text: "釋義與例句來自開放授權的字典與例句庫，逐筆標示來源。", href: "/about" },
];

/** 首頁搜尋列下方的介紹：給誰用、查字 → 收藏 → 複習的流程、其他特色。登入後不顯示 */
async function Intro() {
  if (await getCurrentUser()) return null;

  return (
    <section aria-labelledby="intro-heading" className="flex flex-col gap-10 pt-6 sm:pt-10">
      <div className="flex flex-col gap-3">
        <h2 id="intro-heading" className="text-2xl leading-snug font-semibold text-balance">
          查到的字，留下來，記起來。
        </h2>
        <p className="text-pretty text-muted-foreground">
          給中文圈學英文的人使用。查字、收藏、複習在同一個地方，不用在字典和單字 App 之間搬字。
        </p>
      </div>

      {/* 三張步驟卡：上半文字，下半深一階的底色放該步驟介面的縮小示意（純裝飾） */}
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map(({ title, text, Preview }, i) => (
          <li key={title} className="flex flex-col overflow-hidden rounded-2xl bg-card">
            <div className="flex flex-1 flex-col gap-1.5 p-5">
              <h3 className="flex items-baseline gap-2 text-[1.05rem] font-semibold">
                <span className="text-sm text-primary-ink tabular-nums">{i + 1}</span>
                {title}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">{text}</p>
            </div>
            <div aria-hidden className="flex h-30 items-center justify-center bg-muted px-4 select-none sm:h-36">
              <Preview />
            </div>
          </li>
        ))}
      </ol>

      <ul className="grid gap-5 border-t pt-8 sm:grid-cols-3 sm:gap-6">
        {DETAILS.map(({ icon: Icon, title, text, href }) => (
          <li key={title} className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4 text-primary-ink" aria-hidden />
              {title}
            </h3>
            <p className="text-sm text-pretty text-muted-foreground">
              {text}
              {href && (
                <>
                  {" "}
                  <Link href={href}>看來源</Link>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>

      {/* 已有帳號的人用頁首的「登入」；註冊頁也有連到登入的連結 */}
      <div>
        <Button asChild size="lg">
          <Link href="/signup" className="hover:no-underline">
            建立帳號，開始收藏
          </Link>
        </Button>
      </div>
    </section>
  );
}
