/** Moji 網站網址的預設值；可在擴充元件的「選項」頁改成其他網址（例如本機開發用 http://localhost:3001） */
export const DEFAULT_BASE_URL = "http://localhost:3001";

/** 讀取使用者設定的網站網址（去掉結尾的 /） */
export async function getBaseUrl() {
  const { baseUrl } = await chrome.storage.sync.get("baseUrl");
  return (typeof baseUrl === "string" && baseUrl ? baseUrl : DEFAULT_BASE_URL).replace(/\/+$/, "");
}
