import styles from "./page.module.css";

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
    usage: "英英釋義。© Open English WordNet 貢獻者，衍生自 Princeton WordNet。",
  },
  {
    name: "Tatoeba",
    href: "https://tatoeba.org/zh-tw",
    license: "CC BY 2.0 FR（部分句子為 CC0 1.0）",
    licenseHref: "https://creativecommons.org/licenses/by/2.0/fr/",
    usage: "英文例句與中文翻譯。每句例句下方標示 Tatoeba 句子編號、作者與授權，中文翻譯以 OpenCC 轉為台灣繁體。",
  },
];

export default function AboutPage() {
  return (
    <article className={styles.page}>
      <h1 className={styles.title}>資料來源與授權</h1>
      <p>本站的字典內容來自以下開放授權的資料，感謝各專案與貢獻者。</p>
      <ul className={styles.list}>
        {SOURCES.map((s) => (
          <li key={s.name} className={styles.card}>
            <h2 className={styles.name}>
              <a href={s.href} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            </h2>
            <p className={styles.license}>
              授權：
              <a href={s.licenseHref} target="_blank" rel="noopener noreferrer">
                {s.license}
              </a>
            </p>
            <p>{s.usage}</p>
          </li>
        ))}
      </ul>
      <p className={styles.note}>發音使用瀏覽器內建的語音合成（Web Speech API），實際聲音依您的裝置而定。</p>
    </article>
  );
}
