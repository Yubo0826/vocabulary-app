/**
 * 純文字單字清單的解析（匯入用）。
 * - 每行一個單字或片語；空行與 # 開頭的行略過
 * - 一行有 Tab、逗號或分號時只取第一欄（Anki、Quizlet、歐路等匯出的檔案第一欄就是單字）
 * - 去掉行首編號（「1. 」「2) 」「3、」）與欄位外的引號
 * - 經過 normalizeHeadword，重複的字只留第一次出現
 */
import { normalizeHeadword } from "./headword";

export const MAX_IMPORT_WORDS = 2000;
export const MAX_IMPORT_CHARS = 200_000;
const MAX_HEADWORD_LENGTH = 100;

export function parseWordList(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const first = line
      .split(/[\t,;]/)[0]
      .trim()
      .replace(/^\d+\s*[.)、]\s*/, "")
      .replace(/^["']+|["']+$/g, "");
    const word = normalizeHeadword(first);
    if (!word || word.length > MAX_HEADWORD_LENGTH || !/[a-z]/.test(word) || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}
