/**
 * 背景 service worker：
 * 1. 右鍵選單「在 Moji 查詢」：選取文字後開新分頁到 Moji。
 *    - 看起來像單字或短片語（英文字母、撇號、連字號，最多 4 個字）→ 單字頁 /word/<字>
 *      （網站會自動轉小寫、把變化形轉到原形，找不到時顯示有搜尋框的 404 頁）
 *    - 其他（含中文、數字、長句）→ 搜尋頁 /search?q=<文字>
 * 2. 替網頁上的查字卡片（content.js）呼叫 Moji API。由這裡呼叫才能帶上 Moji 網站的登入 cookie，
 *    也不受網頁本身的 CSP 限制。API 只接受這個擴充元件的 Origin（見 src/lib/extension.ts）。
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

// ---------------------------------------------------------------- 查字卡片的訊息

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  return true; // 非同步回覆
});

async function handleMessage(message, sender) {
  const base = await getBaseUrl();
  switch (message?.type) {
    case "lookup": {
      const res = await callApi(`${base}/api/extension/word?q=${encodeURIComponent(message.text)}`);
      return { ...res, base };
    }
    case "save":
      return callApi(`${base}/api/extension/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headword: message.headword,
          saved: message.saved,
          contextUrl: message.contextUrl ?? null,
          contextSentence: message.contextSentence ?? null,
        }),
      });
    case "open": {
      // 只開 Moji 網站內的頁面
      const path = typeof message.path === "string" && message.path.startsWith("/") ? message.path : "/";
      const tab = sender.tab;
      await chrome.tabs.create({ url: base + path, index: tab ? tab.index + 1 : undefined, openerTabId: tab?.id });
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown message" };
  }
}

async function callApi(url, init = {}) {
  let res;
  try {
    // X-Moji-Extension：Chrome 送 GET 時不帶 Origin，網站改用這個標頭辨認擴充元件（src/lib/extension.ts）
    const headers = { ...init.headers, "X-Moji-Extension": "1" };
    res = await fetch(url, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    return { ok: false, error: "連不上 Moji，請確認網站網址（擴充元件選項）與網路連線" };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fallback =
      res.status === 403
        ? `Moji 拒絕了這個請求（擴充元件 ID 不符：收到 ${data?.origin ?? "沒有 Origin"}，本身是 chrome-extension://${chrome.runtime.id}）`
        : `Moji 回應錯誤（${res.status}）`;
    return { ok: false, status: res.status, error: data?.error && res.status !== 403 ? data.error : fallback };
  }
  return { ok: true, data };
}

// ---------------------------------------------------------------- 右鍵選單的網址

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
