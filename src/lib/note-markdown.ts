/**
 * 筆記 Markdown 的自訂擴充，編輯器（note-editor.tsx）與顯示（note-content.tsx）共用，兩邊的格式才會一致。
 * 表格不在這裡：編輯器用完整的 TableKit，顯示端用只做解析的 note-table-parse.ts（原因見該檔）。
 */
import { Extension, type MarkdownToken } from "@tiptap/core";
import { NoteBg, NoteColor } from "./note-color";

const TAGS = { strong: "bold", em: "italic" } as const;

/**
 * 格式部分重疊時（例如粗體與斜體、或顏色與粗體交錯），Tiptap 存檔會把後半段寫成 `<strong>…</strong>`、`<em>…</em>`，
 * 但筆記裡的 HTML 一律當文字，讀回來會看到標籤。這裡只把這兩種標籤讀回粗體／斜體，其他 HTML 仍然當文字。
 */
export const HtmlReopenMarks = Extension.create({
  name: "noteHtmlReopen",
  markdownTokenName: "noteHtmlReopen",
  markdownTokenizer: {
    name: "noteHtmlReopen",
    level: "inline",
    start: (src) => src.search(/<(?:strong|em)>/),
    tokenize(src, _tokens, lexer) {
      const m = /^<(strong|em)>/.exec(src);
      if (!m) return undefined;
      const tag = m[1] as keyof typeof TAGS;
      const close = src.indexOf(`</${tag}>`, m[0].length);
      if (close <= m[0].length) return undefined;
      return {
        type: "noteHtmlReopen",
        raw: src.slice(0, close + tag.length + 3),
        mark: TAGS[tag],
        tokens: lexer.inlineTokens(src.slice(m[0].length, close)),
      } satisfies MarkdownToken;
    },
  },
  parseMarkdown: (token, h) => h.applyMark(String(token.mark), h.parseInline(token.tokens ?? [])),
});

/**
 * 表格儲存格只能放單行文字，Tiptap 存檔時把儲存格裡的換行（含多個段落）寫成 `<br>`。
 * 這裡把 `<br>` 讀回換行；同樣只認這一種標籤。
 */
export const HtmlBreak = Extension.create({
  name: "noteHtmlBreak",
  markdownTokenName: "noteHtmlBreak",
  markdownTokenizer: {
    name: "noteHtmlBreak",
    level: "inline",
    start: (src) => src.search(/<br\s*\/?>/i),
    tokenize(src) {
      const m = /^<br\s*\/?>/i.exec(src);
      return m ? { type: "noteHtmlBreak", raw: m[0] } : undefined;
    },
  },
  parseMarkdown: () => ({ type: "hardBreak" }),
});

/** 除了 StarterKit 與表格之外，筆記解析／存檔需要的擴充 */
export const NOTE_MARKDOWN_EXTENSIONS = [NoteColor, NoteBg, HtmlReopenMarks, HtmlBreak];
