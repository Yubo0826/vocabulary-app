import { ExternalLink, MousePointerClick, Volume2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CHROME_STORE_URL } from "@/lib/urls";

export const metadata = {
  title: "Chrome 擴充元件",
  description: "讀英文網頁時，選取單字按一下 Alt 就能查，不用切換分頁。",
};

/** 網頁上查字卡片的縮小示意（照擴充元件 content.js 的卡片畫，純裝飾） */
function CardPreview() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 text-sm select-none">
      <p className="leading-relaxed text-muted-foreground">
        Dallas doesn&rsquo;t have a lockdown <span className="rounded-sm bg-primary/25 px-0.5 text-foreground">perimeter</span>{" "}
        guy, a point-of-attack defender&hellip;
      </p>
      <div className="flex flex-col gap-2 rounded-2xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">perimeter</span>
          <span className="text-xs text-muted-foreground">/pəˈrimitə/</span>
          <Volume2 className="size-4 text-muted-foreground" />
          <X className="ml-auto size-4 text-muted-foreground" />
        </div>
        <p>
          <span className="text-xs text-primary-ink italic">n.</span> <span className="font-semibold">周長；外圍、周界</span>
        </p>
        <p className="text-xs text-muted-foreground">the outer edge of an area or the line that marks its limit</p>
        <span className="flex items-center gap-1 self-end text-xs text-primary-ink">
          完整解釋 <ExternalLink className="size-3" />
        </span>
      </div>
    </div>
  );
}

const STEPS = [
  { title: "選取單字", text: "在任何英文網頁上，用滑鼠反白想查的單字或片語。" },
  { title: "按一下 Alt", text: "選好後按一下 Alt，或選取時按住 Alt。也可以按右鍵選「在 Moji 查詢」。" },
  { title: "看解釋、收藏", text: "卡片顯示中文釋義、英英解釋與發音；點「完整解釋」開啟 Moji，就能收藏、寫筆記。" },
];

/** 擴充元件介紹頁：用法與安裝按鈕；頁尾與首頁「閱讀時查字」連到這裡 */
export default function ExtensionPage() {
  return (
    <article className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <MousePointerClick className="size-6 text-primary-ink" aria-hidden />
          閱讀時查字
        </h1>
        <p className="text-pretty text-muted-foreground">
          安裝 Moji 的 Chrome 擴充元件，讀英文網頁時選取單字按一下 Alt，就地跳出解釋，不用另開分頁、也不會打斷閱讀。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="lg">
            <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:no-underline">
              加到 Chrome <ExternalLink />
            </a>
          </Button>
          <span className="text-sm text-muted-foreground">免費・支援電腦版 Chrome、Edge</span>
        </div>
      </section>

      <div aria-hidden className="flex justify-center rounded-2xl bg-muted px-5 py-8">
        <CardPreview />
      </div>

      <section aria-labelledby="how-heading" className="flex flex-col gap-4">
        <h2 id="how-heading" className="text-lg font-semibold">
          怎麼用
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-1.5 rounded-2xl bg-card p-5">
              <h3 className="flex items-baseline gap-2 text-[1.05rem] font-semibold">
                <span className="text-sm text-primary-ink tabular-nums">{i + 1}</span>
                {s.title}
              </h3>
              <p className="text-sm text-pretty text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
        <h2 id="faq-heading" className="text-lg font-semibold">
          常見問題
        </h2>
        <dl className="flex flex-col gap-4 text-sm [&_dd]:text-pretty [&_dd]:text-muted-foreground [&_dt]:font-semibold">
          <div className="flex flex-col gap-1">
            <dt>需要登入嗎？</dt>
            <dd>查字不需要登入。要收藏、寫筆記，請在 Moji 網站登入。</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>手機可以用嗎？</dt>
            <dd>手機瀏覽器不支援擴充元件。手機上可以直接用 Moji 網站查字，也能加入主畫面當 App 用。</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>會讀取我瀏覽的網頁嗎？</dt>
            <dd>
              不會。擴充元件只在你主動查字時，把選取的文字傳到 Moji 查詢，不會記錄網址或網頁內容。詳見
              <Link href="/privacy">隱私權政策</Link>。
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
