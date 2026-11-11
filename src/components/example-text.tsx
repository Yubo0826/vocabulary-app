import { tatoebaSentenceUrl, tatoebaUserUrl } from "@/lib/urls";
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

/** 把句子中屬於這個字（含變化形）的單字標成 <mark> */
export function highlight(text: string, forms: Set<string>) {
  return text.split(/([A-Za-z]+(?:['’-][A-Za-z]+)*)/).map((part, i) =>
    i % 2 === 1 && forms.has(part.toLowerCase()) ? <mark key={i}>{part}</mark> : part,
  );
}
