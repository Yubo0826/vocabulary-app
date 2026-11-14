import { getBaseUrl } from "./config.js";

const form = document.getElementById("form");
const input = document.getElementById("baseUrl");
const status = document.getElementById("status");

input.value = await getBaseUrl();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let url;
  try {
    url = new URL(input.value.trim());
  } catch {
    url = null;
  }
  if (!url || !["http:", "https:"].includes(url.protocol)) {
    showStatus("網址格式不正確", true);
    return;
  }
  const baseUrl = url.origin + url.pathname.replace(/\/+$/, "");
  await chrome.storage.sync.set({ baseUrl });
  input.value = baseUrl;
  showStatus("已儲存");
});

function showStatus(text, isError = false) {
  status.textContent = text;
  status.className = isError ? "error" : "";
}
