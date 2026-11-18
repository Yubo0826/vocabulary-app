/**
 * 筆記是 Markdown 字串（由 note-editor 產生）。
 * 列表等只顯示摘要的地方用純文字，去掉格式符號，避免看到 ** 或 [](...)。
 */
export function noteToPlainText(markdown: string): string {
  // 先把跳脫字元（例如 \*）換成私用區字元保護起來，去完格式再換回原字元
  const escaped: string[] = [];
  const protect = (_: string, ch: string) => String.fromCharCode(0xe000 + escaped.push(ch) - 1);

  // 顏色語法 {red|文字}、{bg-yellow|文字} 可以互相包住，由內往外拆（見 note-color.ts）；在表格裡 | 會被跳脫成 \|
  let text = markdown;
  for (let prev = ""; prev !== text; ) {
    prev = text;
    text = text.replace(/\{(?:bg-)?[a-z]+\\?\|([^{}]*)\}/g, "$1");
  }

  return text
    .replace(/\\([\\`*_[\]()#+\-.!~<>|{}])/g, protect)
    .replace(/<\/?(?:strong|em|u)>/gi, "") // 底線，以及格式重疊時存成的 HTML 標籤（見 note-markdown.ts）
    .replace(/<br\s*\/?>/gi, " ") // 表格儲存格裡的換行
    .replace(/^[ \t]*\|?(?:[ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*:?-*:?[ \t]*$/gm, "") // 表格的分隔列 | --- | --- |
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, cells: string) => cells.split("|").map((c) => c.trim()).join("　")) // 表格列：儲存格用全形空白隔開
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [文字](網址) → 文字
    .replace(/^\s*(?:[-*+]|\d+\.|#{1,6}|>)\s+/gm, "") // 清單、標題、引言開頭
    .replace(/^```.*$/gm, "")
    .replace(/(\*\*|__|~~|\*|_|`)(.+?)\1/g, "$2") // 粗體、斜體、刪除線、行內程式碼
    .replace(/\s*\n\s*/g, " ")
    .replace(/[-]/g, (c) => escaped[c.charCodeAt(0) - 0xe000] ?? c)
    .trim();
}
