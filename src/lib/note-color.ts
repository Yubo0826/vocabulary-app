/**
 * 筆記的文字色與底色（Tiptap mark），編輯器（note-editor.tsx）與顯示（note-content.tsx）共用。
 *
 * Markdown 沒有顏色語法，自訂成 `{red|文字}`（文字色）與 `{bg-yellow|文字}`（底色），可以互相包住：
 * `{bg-yellow|{red|文字}}`。只接受固定色盤，實際顏色是 globals.css 的 --note-* 變數，深色模式會換色調。
 * 色盤以外的名稱不會被當成語法，原樣顯示成文字。
 *
 * 限制：上色文字裡如果有不成對的 `}`，存回去再讀時會提早結束上色（成對的 `{}` 沒問題）。
 */
import { Mark, type JSONContent, type MarkdownToken } from "@tiptap/core";

export const NOTE_TEXT_COLORS = [
  { name: "red", label: "紅色" },
  { name: "orange", label: "橘色" },
  { name: "green", label: "綠色" },
  { name: "blue", label: "藍色" },
  { name: "purple", label: "紫色" },
  { name: "gray", label: "灰色" },
] as const;

export const NOTE_BG_COLORS = [
  { name: "yellow", label: "黃色" },
  { name: "green", label: "綠色" },
  { name: "blue", label: "藍色" },
  { name: "pink", label: "粉紅色" },
  { name: "gray", label: "灰色" },
] as const;

const TEXT_NAMES = new Set<string>(NOTE_TEXT_COLORS.map((c) => c.name));
const BG_NAMES = new Set<string>(NOTE_BG_COLORS.map((c) => c.name));

/** 依 mark 類型與顏色名稱取得 CSS class；不在色盤裡的回傳 null */
export function noteColorClass(markType: string, color: unknown): string | null {
  if (typeof color !== "string") return null;
  if (markType === "noteColor" && TEXT_NAMES.has(color)) return `note-c-${color}`;
  if (markType === "noteBg" && BG_NAMES.has(color)) return `note-bg-${color}`;
  return null;
}

const OPEN = /^\{(bg-)?([a-z]+)\|/;

/** 從開頭的 `{xxx|` 之後找出對應的 `}`；跳過反斜線跳脫，成對的大括號視為內容 */
function findClose(src: string, from: number): number {
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") i++;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  return -1;
}

function colorAttr(attribute: string) {
  return {
    color: {
      default: null,
      parseHTML: (el: HTMLElement) => el.getAttribute(attribute),
      renderHTML: () => ({}), // 由 mark 的 renderHTML 統一輸出
    },
  };
}

/** 包上自訂語法；顏色不在色盤時只輸出內容（不讓不認得的名稱寫進筆記） */
function wrap(node: JSONContent, prefix: string, names: Set<string>, children: string) {
  const color = node.attrs?.color;
  return typeof color === "string" && names.has(color) ? `{${prefix}${color}|${children}}` : children;
}

export const NoteColor = Mark.create({
  name: "noteColor",
  addAttributes: () => colorAttr("data-note-color"),
  // 只認自己輸出的屬性：從別的網站貼上的彩色文字不會帶進任意顏色
  parseHTML: () => [{ tag: "span[data-note-color]" }],
  renderHTML({ mark }) {
    const color = String(mark.attrs.color);
    return ["span", { "data-note-color": color, class: noteColorClass("noteColor", color) ?? undefined }, 0];
  },

  // 兩種顏色共用一個 tokenizer，依前綴決定套用哪個 mark
  markdownTokenName: "noteColor",
  markdownTokenizer: {
    name: "noteColor",
    level: "inline",
    start: (src) => src.search(/\{(?:bg-)?[a-z]+\|/),
    tokenize(src, _tokens, lexer) {
      const m = OPEN.exec(src);
      if (!m) return undefined;
      const bg = !!m[1];
      if (!(bg ? BG_NAMES : TEXT_NAMES).has(m[2])) return undefined;
      const close = findClose(src, m[0].length);
      if (close <= m[0].length) return undefined; // 沒有結尾或內容是空的
      return {
        type: "noteColor",
        raw: src.slice(0, close + 1),
        bg,
        color: m[2],
        tokens: lexer.inlineTokens(src.slice(m[0].length, close)),
      } satisfies MarkdownToken;
    },
  },
  parseMarkdown: (token, h) =>
    h.applyMark(token.bg ? "noteBg" : "noteColor", h.parseInline(token.tokens ?? []), { color: token.color }),
  renderMarkdown: (node, h) => wrap(node, "", TEXT_NAMES, h.renderChildren(node)),
});

export const NoteBg = Mark.create({
  name: "noteBg",
  addAttributes: () => colorAttr("data-note-bg"),
  parseHTML: () => [{ tag: "span[data-note-bg]" }],
  renderHTML({ mark }) {
    const color = String(mark.attrs.color);
    return ["span", { "data-note-bg": color, class: noteColorClass("noteBg", color) ?? undefined }, 0];
  },
  renderMarkdown: (node, h) => wrap(node, "bg-", BG_NAMES, h.renderChildren(node)),
});
