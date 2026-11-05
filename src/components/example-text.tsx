import { tatoebaSentenceUrl, tatoebaUserUrl } from "@/lib/urls";

/** Tatoeba 出處：句子連結、作者、授權（CC BY 需逐句標示作者） */
export function Attribution({ id, author, license }: { id: number; author: string | null; license: string }) {
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
