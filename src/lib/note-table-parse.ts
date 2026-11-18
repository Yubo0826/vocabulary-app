/**
 * 顯示端（伺服器）專用的表格解析：只把 GFM 表格 token 轉成 table／tableRow／tableHeader／tableCell 的 JSON，
 * 輸出與 @tiptap/extension-table 的 parseMarkdown 相同。
 *
 * 不直接用 @tiptap/extension-table：它會載入 prosemirror-tables，而 prosemirror-tables 一載入就向
 * prosemirror-state 註冊選取類型 "cell"。dev 模式熱更新時 Turbopack 會重新執行它、卻沿用舊的 prosemirror-state，
 * 伺服器端就丟出「Duplicate use of selection JSON ID cell」。顯示筆記用不到表格的編輯功能，所以分開。
 * 編輯器（瀏覽器端）仍然用完整的 TableKit，見 note-editor.tsx。
 *
 * 和 TableKit 唯一的差別：手寫在儲存格行內程式碼裡、沒跳脫的 `|` 會被當成分隔線。編輯器存檔時一律寫成 `\|`，不受影響。
 */
import { Node, type JSONContent, type MarkdownToken } from "@tiptap/core";

type Cell = { tokens?: MarkdownToken[]; align?: unknown };

const alignAttrs = (align: unknown) =>
  align === "left" || align === "center" || align === "right" ? { align } : {};

export const TableParseOnly = Node.create({
  name: "table",
  markdownTokenName: "table",
  parseMarkdown: (token, h) => {
    const aligns: unknown[] = Array.isArray(token.align) ? token.align : [];
    const cell = (type: string, c: Cell, i: number): JSONContent =>
      h.createNode(type, alignAttrs(aligns[i] ?? c.align), [
        { type: "paragraph", content: h.parseInline(c.tokens ?? []) },
      ]);
    const header = (token.header ?? []) as Cell[];
    const body = (token.rows ?? []) as Cell[][];
    const rows: JSONContent[] = [];
    if (header.length) rows.push(h.createNode("tableRow", {}, header.map((c, i) => cell("tableHeader", c, i))));
    for (const r of body) rows.push(h.createNode("tableRow", {}, r.map((c, i) => cell("tableCell", c, i))));
    return h.createNode("table", undefined, rows);
  },
});
