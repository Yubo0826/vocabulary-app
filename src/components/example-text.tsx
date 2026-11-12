import Link from "next/link";
import { normalizeHeadword, WORD_SPLIT } from "@/lib/headword";
import { tatoebaSentenceUrl, tatoebaUserUrl, wordHref } from "@/lib/urls";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ExampleSourceFields = {
  enSentenceId: number | null;
  enAuthor: string | null;
  enLicense: string | null;
  zhSentenceId: number | null;
  zhAuthor: string | null;
  zhLicense: string | null;
  zhRevised?: boolean; // 中文翻譯經 LLM 修正
};

/**
 * 例句出處：預設收成 ⓘ，點開才顯示（CC BY 仍需逐句標示，只是不直接攤在畫面上）。
 * LLM 產生的例句沒有 Tatoeba 句子可連，不顯示按鈕。
 */
export function ExampleSource({ example }: { example: ExampleSourceFields }) {
  const { enSentenceId, enLicense } = example;
  if (enSentenceId === null || enLicense === null) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full text-muted-foreground/70 data-[state=open]:bg-accent data-[state=open]:text-foreground"
          aria-label="例句出處"
          title="例句出處"
        >
          <Info className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[min(320px,calc(100vw-32px))] p-2.5 text-xs leading-normal text-muted-foreground [&_a]:text-muted-foreground [&_a]:underline [&_a]:decoration-border">
        <Attribution id={enSentenceId} author={example.enAuthor} license={enLicense} />
        {example.zhSentenceId && example.zhLicense && (
          <div>
            中譯 <Attribution id={example.zhSentenceId} author={example.zhAuthor} license={example.zhLicense} />
            {example.zhRevised && "（中譯經修正）"}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Tatoeba 出處：句子連結、作者、授權 */
function Attribution({ id, author, license }: { id: number; author: string | null; license: string }) {
  return (
    <>
      <a href={tatoebaSentenceUrl(id)} target="_blank" rel="noopener noreferrer">
        Tatoeba #{id}
      </a>
      {author ? (
        <>
          {" · "}
          <a href={tatoebaUserUrl(author)} target="_blank" rel="noopener noreferrer">
            {author}
          </a>
        </>
      ) : (
        " · 作者不詳"
      )}
      {` · ${license}`}
    </>
  );
}

export type WordLinks = {
  /** 有單字頁可去的字（已正規化） */
  words: Set<string>;
  /** 另開分頁（複習中不離開目前流程） */
  newTab?: boolean;
};

/**
 * 把句子中屬於這個字（含變化形）的單字標成 <mark>；有給 links 時，其他查得到的字做成連到單字頁的連結
 * （平常看起來跟一般文字一樣，滑過才變色加底線）。
 */
export function highlight(text: string, forms: Set<string>, links?: WordLinks) {
  return text.split(WORD_SPLIT).map((part, i) => {
    if (i % 2 === 0) return part;
    const word = normalizeHeadword(part);
    if (forms.has(word)) return <mark key={i}>{part}</mark>;
    if (!links?.words.has(word)) return part;
    return (
      <Link
        key={i}
        href={wordHref(word)}
        className="text-inherit hover:text-primary"
        {...(links.newTab && { target: "_blank", rel: "noopener" })}
      >
        {part}
      </Link>
    );
  });
}
