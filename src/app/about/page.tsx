import { Card } from "@/components/ui/card";

export const metadata = { title: "資料來源與授權" };

const SOURCES = [
  {
    name: "ECDICT",
    href: "https://github.com/skywind3000/ECDICT",
    license: "MIT License",
    licenseHref: "https://github.com/skywind3000/ECDICT/blob/master/LICENSE",
    usage: "英中釋義、音標、詞頻與詞形變化。中文釋義以 OpenCC 轉為台灣繁體用語。",
  },
  {
    name: "Open English WordNet 2025",
    href: "https://en-word.net/",
    license: "CC BY 4.0",
    licenseHref: "https://creativecommons.org/licenses/by/4.0/",
    usage: "英英釋義與近義字。© Open English WordNet 貢獻者，衍生自 Princeton WordNet。",
  },
  {
    name: "Tatoeba",
    href: "https://tatoeba.org/zh-tw",
    license: "CC BY 2.0 FR（部分句子為 CC0 1.0）",
    licenseHref: "https://creativecommons.org/licenses/by/2.0/fr/",
    usage: "英文例句與中文翻譯。每句例句旁的 ⓘ 可查看 Tatoeba 句子編號、作者與授權，中文翻譯以 OpenCC 轉為台灣繁體。",
  },
];

export default function AboutPage() {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">資料來源與授權</h1>
      <p>本站的字典內容來自以下開放授權的資料，感謝各專案與貢獻者。</p>
      <ul className="flex flex-col gap-3">
        {SOURCES.map((s) => (
          <li key={s.name}>
            <Card className="gap-1 px-4">
              <h2 className="text-lg font-semibold">
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  {s.name}
                </a>
              </h2>
              <p className="text-muted-foreground">
                授權：
                <a href={s.licenseHref} target="_blank" rel="noopener noreferrer">
                  {s.license}
                </a>
              </p>
              <p className="text-base">{s.usage}</p>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">發音使用瀏覽器內建的語音合成（Web Speech API），實際聲音依您的裝置而定。</p>
    </article>
  );
}
