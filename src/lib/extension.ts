/**
 * Chrome 擴充元件（extension/）呼叫的 API 共用：只接受來自 Moji 擴充元件的請求。
 *
 * 擴充元件從 service worker 帶著網站的登入 cookie 呼叫 /api/extension/*，請求的 Origin 是
 * chrome-extension://<擴充元件 ID>（GET 請求則沒有 Origin，見 isExtensionRequest）。ID 由 extension/manifest.json 的 key 固定（載入未封裝項目時）；
 * 日後上架商店會拿到另一個 ID，加到環境變數 EXTENSION_ORIGINS（逗號分隔）即可。
 * 一般網頁跨站呼叫時 Origin 是該網站，會被拒絕（Better Auth 的 cookie 為 SameSite=Lax，本來也不會帶上）。
 */
const PINNED_EXTENSION_ORIGIN = "chrome-extension://jliagbbfhngfojafccnlfndkockoppcc";

const allowedOrigins = new Set([
  PINNED_EXTENSION_ORIGIN,
  ...(process.env.EXTENSION_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
]);

/** 擴充元件每個請求都帶的自訂標頭（extension/background.js） */
export const EXTENSION_HEADER = "x-moji-extension";

/**
 * 有 Origin 時必須是允許的擴充元件。沒有 Origin 時（Chrome 從有主機權限的擴充元件送 GET 請求就不帶）
 * 改看自訂標頭：一般網頁跨站帶自訂標頭會先送 CORS 預檢，而這裡不回 CORS 標頭，所以網頁做不到；
 * 網頁跨站送 POST 一定帶 Origin，會走上面的檢查。
 */
export function isExtensionRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin !== null) return allowedOrigins.has(origin);
  return request.headers.get(EXTENSION_HEADER) === "1";
}

/** 回傳收到的 Origin，方便擴充元件顯示 ID 不符的原因（這是請求方自己的資訊，不洩漏什麼） */
export const forbidden = (request: Request) =>
  Response.json({ error: "forbidden", origin: request.headers.get("origin") }, { status: 403 });
