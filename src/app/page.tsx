import { SearchBox } from "@/components/search-box";

export default function Home() {
  return (
    <div className="flex flex-col pt-[clamp(0px,4vh,40px)]">
      {/* 搜尋區：Material 3 的做法，不包卡片，大標題＋膠囊搜尋列（surface container high） */}
      <section className="flex flex-col gap-5 pt-8 pb-8 sm:pt-14">
        <h1 className="text-[2rem] leading-tight font-normal sm:text-[2.6rem]">查單字</h1>
        <SearchBox autoFocus />
      </section>
    </div>
  );
}
