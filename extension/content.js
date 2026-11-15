/**
 * 網頁上的查字：選取英文單字或短片語（最多 4 個字）時按住 Alt（或選好後按一下 Alt），
 * 直接跳出查字卡片（音標、發音、常用詞義、連到 Moji 單字頁）。不按 Alt 的選取不打擾。
 * 卡片只負責查字；收藏要到網站上選單字本（收藏＝放進單字本），所以這裡不提供收藏。
 *
 * 所有 UI 放在 closed Shadow DOM 裡，不受網頁 CSS 影響、也不影響網頁。
 * API 呼叫交給 background.js（才能帶上 Moji 的登入 cookie）。
 * Content script 不能用 ES module，所以包在 IIFE 裡。
 */
(() => {
  if (window.__mojiExtensionLoaded) return;
  window.__mojiExtensionLoaded = true;

  const MAX_WORDS = 4;
  const MAX_LENGTH = 60;
  const WORD_LIKE = /^[A-Za-z]+(?:['-][A-Za-z]+)*(?: [A-Za-z]+(?:['-][A-Za-z]+)*)*$/;
  const POS_LABELS = { "n.": "名詞", "v.": "動詞", "adj.": "形容詞", "adv.": "副詞" };

  // ---------------------------------------------------------------- 根節點與樣式

  const host = document.createElement("moji-lookup");
  host.style.cssText = "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    /* 配色與元件樣式對齊網站的 Material 3 設計（DESIGN.md）：選單紙底、長春花藍、霧藍容器、state layer */
    .ui {
      --surface: #efedf4; --fg: #1b1b21; --muted: #5d5e67; --hairline: #c6c5d0;
      --primary: #4263eb; --on-primary: #ffffff; --tonal: #dee1f9; --on-tonal: #2e3245; --danger: #ba1a1a;
      font: 14px/1.55 "Roboto Flex", Roboto, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", system-ui, sans-serif;
      color: var(--fg);
    }
    @media (prefers-color-scheme: dark) {
      .ui {
        --surface: #2a292f; --fg: #e4e1e9; --muted: #b4b3be; --hairline: #46464f;
        --primary: #b9c3ff; --on-primary: #102a8f; --tonal: #424659; --on-tonal: #dee1f9; --danger: #ffb4ab;
      }
    }
    ::selection { background: var(--tonal); color: var(--on-tonal); }
    button { font: inherit; border: 0; padding: 0; margin: 0; cursor: pointer; }
    button:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 50%, transparent); outline-offset: 1px; }
    svg { display: block; flex-shrink: 0; }
    .card {
      position: absolute; width: 340px; max-width: calc(100vw - 16px); max-height: 420px; overflow: auto;
      background: var(--surface); border-radius: 12px; padding: 14px 16px 16px;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--fg) 10%, transparent),
        0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);
      scrollbar-width: thin; scrollbar-color: var(--hairline) transparent;
    }
    .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .word { font-size: 22px; line-height: 1.25; font-weight: 700; overflow-wrap: anywhere; }
    .phonetic { color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
    /* 圖示按鈕：standard（關閉）只有 state layer；outlined（發音）細框＋主色 */
    .icon-btn {
      width: 32px; height: 32px; border-radius: 999px; background: transparent; color: var(--muted);
      display: inline-flex; align-items: center; justify-content: center; transition: background-color 150ms, color 150ms;
    }
    .icon-btn:hover { background: color-mix(in srgb, var(--fg) 8%, transparent); color: var(--fg); }
    .icon-btn:active { background: color-mix(in srgb, var(--fg) 12%, transparent); }
    .speak { border: 1px solid var(--hairline); color: var(--primary); }
    .speak:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); color: var(--primary); }
    .speak:active { background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .close { margin-left: auto; }
    .note { color: var(--muted); font-size: 12px; margin: 2px 0 0; }
    ol { list-style: none; margin: 10px 0 0; padding: 0; }
    li { padding: 8px 0; border-top: 1px solid var(--hairline); }
    li:first-child { border-top: 0; padding-top: 0; }
    .pos { color: var(--primary); font-style: italic; font-size: 12px; margin-right: 6px; }
    .label { font-weight: 600; }
    .zh { color: var(--muted); margin: 1px 0 0; }
    .en { font-size: 13px; margin: 1px 0 0; }
    .foot { display: flex; justify-content: flex-end; margin: 10px -8px -6px 0; }
    /* text 按鈕（完整解釋、在 Moji 搜尋）：主色字＋state layer */
    .link {
      height: 36px; padding: 0 12px; border-radius: 999px; background: transparent; color: var(--primary); font-weight: 500;
      display: inline-flex; align-items: center; gap: 4px; transition: background-color 150ms;
    }
    .link:hover { background: color-mix(in srgb, var(--primary) 8%, transparent); }
    .link:active { background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .msg { color: var(--muted); margin: 6px 0 0; }
    .error { color: var(--danger); font-size: 13px; margin: 8px 0 0; }
  </style><div class="ui"></div>`;
  const ui = root.querySelector(".ui");

  let card = null;
  let pending = null; // { text, rect }
  let altAlone = false; // 按下 Alt 後還沒按其他鍵（放開時才算「單按 Alt」）

  function mount() {
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  /** 安全建立元素（不用 innerHTML 放資料） */
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "onClick") el.addEventListener("click", v);
      else if (k === "className") el.className = v;
      else if (v !== undefined && v !== null) el.setAttribute(k, v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
    return el;
  }

  // ---------------------------------------------------------------- 選取＋Alt → 卡片

  function cleanSelection(text) {
    return text
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
  }

  function isEditable(node) {
    const el = node instanceof Element ? node : node?.parentElement;
    return Boolean(el?.closest("input, textarea, [contenteditable=''], [contenteditable='true']"));
  }

  // 觸發方式一：按住 Alt 選取（拖曳或雙擊），放開滑鼠就查
  document.addEventListener(
    "mouseup",
    (event) => {
      if (event.button !== 0 || !event.altKey || event.composedPath().includes(host)) return;
      setTimeout(lookupSelection, 10); // 等瀏覽器更新選取範圍
    },
    true,
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      altAlone = false; // 按住 Alt 拖曳選取時，放開 Alt 不要再查一次
      if (!event.composedPath().includes(host)) hideCard();
    },
    true,
  );

  // 觸發方式二：選好之後單按一下 Alt（按下到放開之間沒有按其他鍵，避免攔到 Alt+Tab、Alt+← 等快捷鍵）
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Escape") hideCard();
      altAlone = event.key === "Alt" && !event.repeat;
    },
    true,
  );

  document.addEventListener(
    "keyup",
    (event) => {
      if (event.key !== "Alt" || !altAlone) return;
      altAlone = false;
      if (isEditable(document.activeElement)) return;
      // 有可查的選取才攔下 Alt（Windows 上單按 Alt 會把焦點移到瀏覽器選單）
      if (lookupSelection()) event.preventDefault();
    },
    true,
  );

  /** 讀目前的選取；是可查的英文字就開卡片並回傳 true */
  function lookupSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    const text = cleanSelection(sel.toString());
    if (!text || text.length > MAX_LENGTH || !WORD_LIKE.test(text) || text.split(" ").length > MAX_WORDS) return false;
    if (isEditable(sel.anchorNode)) return false;

    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
    if (!last || (last.width === 0 && last.height === 0)) return false;

    pending = { text, rect: toPageRect(last) };
    void openCard();
    return true;
  }

  function toPageRect(r) {
    return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
  }

  function hideCard() {
    card?.remove();
    card = null;
  }

  // ---------------------------------------------------------------- 查字卡片

  async function send(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch {
      return { ok: false, error: "Moji 擴充元件剛更新過，請重新整理這個網頁" };
    }
  }

  async function openCard() {
    if (!pending) return;
    const target = pending;
    mount();
    hideCard();
    card = h("div", { className: "card", role: "dialog", "aria-label": `Moji：${target.text}` });
    ui.append(card);
    renderInto(card, h("p", { className: "msg" }, "查詢中…"));
    placeCard(target.rect);

    const res = await send({ type: "lookup", text: target.text });
    if (!card) return; // 等待中已關閉
    if (!res?.ok) {
      renderInto(card, header(target.text, null), h("p", { className: "error" }, res?.error ?? "查詢失敗"));
    } else if (!res.data.word) {
      renderInto(
        card,
        header(target.text, null),
        h("p", { className: "msg" }, `Moji 字典裡找不到「${target.text}」。`),
        h("div", { className: "foot" }, h("button", { className: "link", onClick: () => open(`/search?q=${encodeURIComponent(target.text)}`) }, "在 Moji 搜尋 →")),
      );
    } else {
      renderWord(card, res.data);
    }
    placeCard(target.rect);
  }

  function renderInto(el, ...children) {
    el.replaceChildren(...children.filter(Boolean));
  }

  function header(display, phonetic) {
    return h(
      "div",
      { className: "head" },
      h("span", { className: "word" }, display),
      phonetic ? h("span", { className: "phonetic" }, `/${phonetic}/`) : null,
      h("button", { className: "icon-btn speak", title: "發音", "aria-label": "發音", onClick: () => speak(display) }, icon(ICONS.speaker, 16)),
      h("button", { className: "icon-btn close", title: "關閉", "aria-label": "關閉", onClick: hideCard }, icon(ICONS.close, 18)),
    );
  }

  function renderWord(el, { word }) {
    const list = h(
      "ol",
      {},
      word.senses.map((s) =>
        h(
          "li",
          {},
          h("div", {}, s.pos ? h("span", { className: "pos", title: POS_LABELS[s.pos] ?? "" }, s.pos) : null, h("span", { className: "label" }, s.label)),
          s.zh ? h("p", { className: "zh" }, s.zh) : null,
          s.en ? h("p", { className: "en" }, s.en) : null,
        ),
      ),
    );
    const foot = h(
      "div",
      { className: "foot" },
      h("button", { className: "link", onClick: () => open(`/word/${encodeURIComponent(word.headword)}`) }, "完整解釋", icon(ICONS.externalLink, 15)),
    );

    renderInto(
      el,
      header(word.display, word.phonetic),
      word.form ? h("p", { className: "note" }, `「${word.form}」的原形`) : null,
      word.senses.length ? list : h("p", { className: "msg" }, "還沒有釋義資料。"),
      foot,
    );
  }

  /** 卡片放在選取範圍下方；下方空間不夠時放上方，左右不超出視窗 */
  function placeCard(rect) {
    if (!card) return;
    const viewW = document.documentElement.clientWidth;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const left = Math.min(Math.max(scrollX + 8, rect.left), scrollX + viewW - width - 8);
    const below = rect.bottom + 8;
    const fitsBelow = below + height <= scrollY + innerHeight - 8;
    const top = fitsBelow || rect.top - scrollY < height + 16 ? below : rect.top - height - 8;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function open(path) {
    send({ type: "open", path });
  }

  /** 優先用女聲（與網站 src/components/speech.tsx 的 FEMALE_VOICES 相同順序） */
  const FEMALE_VOICES = ["Aria", "Jenny", "Ava", "Emma", "Michelle", "Google US English", "Zira", "Samantha", "Allison", "Susan"];

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    const candidates = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-") === "en-US");
    const voice = FEMALE_VOICES.map((name) => candidates.find((v) => v.name.includes(name))).find(Boolean) ?? candidates[0];
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  /** 線條圖示（路徑取自 lucide，與網站同一套） */
  const ICONS = {
    speaker: [
      "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
      "M16 9a5 5 0 0 1 0 6",
      "M19.364 18.364a9 9 0 0 0 0-12.728",
    ],
    close: ["M18 6 6 18", "m6 6 12 12"],
    externalLink: ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
  };

  function icon(paths, size) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    })) {
      svg.setAttribute(k, String(v));
    }
    for (const d of paths) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  }
})();
