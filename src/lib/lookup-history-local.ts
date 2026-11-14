/**
 * 查字歷史的瀏覽器暫存（未登入時使用）。登入後搜尋框第一次讀歷史時會送到伺服器合併，成功就清空。
 * localStorage 可能不能用（無痕模式等），所有存取都包在 try/catch 裡，失敗時當作沒有歷史。
 */
import type { LookupEntry } from "./lookup-history";

const KEY = "lookup-history";
const MAX = 50;

export function readLocalLookups(): LookupEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e) => typeof e?.headword === "string" && typeof e?.at === "number") : [];
  } catch {
    return [];
  }
}

function write(entries: LookupEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // 無法寫入時放棄，不影響查字
  }
}

export function addLocalLookup(headword: string) {
  write([{ headword, at: Date.now() }, ...readLocalLookups().filter((e) => e.headword !== headword)]);
}

export function removeLocalLookup(headword: string) {
  write(readLocalLookups().filter((e) => e.headword !== headword));
}

export function clearLocalLookups() {
  write([]);
}
