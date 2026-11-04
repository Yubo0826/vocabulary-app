/**
 * headword 正規化：小寫、去頭尾空白、片語內的連續空白壓成單一空格。
 * 字典匯入與查詢都必須經過這個函式，確保兩邊的 key 一致。
 */
export function normalizeHeadword(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}
