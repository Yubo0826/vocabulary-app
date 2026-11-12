/**
 * headword 正規化：小寫、去頭尾空白、片語內的連續空白壓成單一空格。
 * 字典匯入與查詢都必須經過這個函式，確保兩邊的 key 一致。
 */
export function normalizeHeadword(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 把英文句子切成單字（含 don't、well-known 這類以撇號或連字號相連的字）；split 後奇數索引是單字 */
export const WORD_SPLIT = /([A-Za-z]+(?:['’-][A-Za-z]+)*)/;

/** 句子裡不重複的單字（已正規化） */
export function wordsIn(text: string): string[] {
  return text.split(WORD_SPLIT).filter((_, i) => i % 2 === 1).map(normalizeHeadword);
}
