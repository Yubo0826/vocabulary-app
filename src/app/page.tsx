import { SearchBox } from "@/components/search-box";

export default function Home() {
  return (
    <div className="flex flex-col pt-[clamp(0px,4vh,40px)]">
      {/* 搜尋區：淡藍漸層卡片，白色搜尋框浮在上面 */}
      <section className="flex flex-col gap-4 rounded-3xl bg-linear-to-br from-accent via-accent to-brand-soft/45 px-5 pt-10 pb-8 sm:px-8 sm:pt-14 sm:pb-12 dark:to-brand-soft/25">
        <h1 className="text-2xl font-semibold text-accent-foreground sm:text-3xl">查單字</h1>
        <SearchBox autoFocus />
      </section>
    </div>
  );
}
