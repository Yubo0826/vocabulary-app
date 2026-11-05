/**
 * 筆記是 Markdown 字串（由 note-editor 產生）。
 * 列表等只顯示摘要的地方用純文字，去掉格式符號，避免看到 ** 或 [](...)。
 */
export function noteToPlainText(markdown: string): string {
  // 先把跳脫字元（例如 \*）換成私用區字元保護起來，去完格式再換回原字元
  const escaped: string[] = [];
  const protect = (_: string, ch: string) => String.fromCharCode(0xe000 + escaped.push(ch) - 1);

  return markdown
    .replace(/\\([\\`*_[\]()#+\-.!~<>|{}])/g, protect)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [文字](網址) → 文字
    .replace(/^\s*(?:[-*+]|\d+\.|#{1,6}|>)\s+/gm, "") // 清單、標題、引言開頭
    .replace(/^```.*$/gm, "")
    .replace(/(\*\*|__|~~|\*|_|`)(.+?)\1/g, "$2") // 粗體、斜體、刪除線、行內程式碼
    .replace(/\s*\n\s*/g, " ")
    .replace(/[-]/g, (c) => escaped[c.charCodeAt(0) - 0xe000] ?? c)
    .trim();
}
