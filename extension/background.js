/**
 * 右鍵選單「在 Moji 查詢」：選取文字後開新分頁到 Moji。
 * - 看起來像單字或短片語（英文字母、撇號、連字號，最多 4 個字）→ 單字頁 /word/<字>
 *   （網站會自動轉小寫、把變化形轉到原形，找不到時顯示有搜尋框的 404 頁）
 * - 其他（含中文、數字、長句）→ 搜尋頁 /search?q=<文字>
 */
import { getBaseUrl } from "./config.js";

const MENU_ID = "moji-lookup";
const MAX_WORDS = 4;
const MAX_LENGTH = 60;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "在 Moji 查詢「%s」", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return;
  const url = lookupUrl(await getBaseUrl(), info.selectionText);
  if (!url) return;
  chrome.tabs.create({ url, index: tab ? tab.index + 1 : undefined, openerTabId: tab?.id });
});

/** 與網站的 normalizeHeadword() 相同規則，另外統一彎引號、去掉前後標點 */
function cleanSelection(text) {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^A-Za-z0-9一-鿿]+|[^A-Za-z0-9一-鿿]+$/g, "");
}

function lookupUrl(base, selection) {
  const text = cleanSelection(selection);
  if (!text) return null;
  const isWordLike =
    text.length <= MAX_LENGTH && /^[A-Za-z]+(?:['-][A-Za-z]+)*(?: [A-Za-z]+(?:['-][A-Za-z]+)*)*$/.test(text);
  if (isWordLike && text.split(" ").length <= MAX_WORDS) {
    return `${base}/word/${encodeURIComponent(text.toLowerCase())}`;
  }
  return `${base}/search?q=${encodeURIComponent(text.slice(0, MAX_LENGTH))}`;
}
