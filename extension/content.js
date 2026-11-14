/**
 * 網頁上的查字：選取英文單字或短片語（最多 4 個字）後，選取範圍旁出現 Moji 小圖示；
 * 點圖示跳出查字卡片（音標、發音、常用詞義、收藏按鈕、連到 Moji 單字頁）。
 * 收藏時一併記錄這個網頁的網址與選字所在的句子。
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
  const MAX_SENTENCE = 500;
  const WORD_LIKE = /^[A-Za-z]+(?:['-][A-Za-z]+)*(?: [A-Za-z]+(?:['-][A-Za-z]+)*)*$/;
  const BLOCK_SELECTOR = "p, li, td, th, dd, dt, blockquote, figcaption, h1, h2, h3, h4, h5, h6, pre, article, section, div";
  const POS_LABELS = { "n.": "名詞", "v.": "動詞", "adj.": "形容詞", "adv.": "副詞" };

  // ---------------------------------------------------------------- 根節點與樣式

  const host = document.createElement("moji-lookup");
  host.style.cssText = "all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>
    :host { all: initial; }
    * { box-sizing: border-box; }
    .ui {
      --bg: #ffffff; --fg: #1f2340; --muted: #5c6080; --border: #dfe3f5; --primary: #4263eb; --primary-fg: #ffffff;
      --accent: #eef1ff; --danger: #c92a2a;
      font: 14px/1.55 "Nunito", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif; color: var(--fg);
    }
    @media (prefers-color-scheme: dark) {
      .ui { --bg: #1b1f38; --fg: #e8eaf7; --muted: #a3a8c7; --border: #2f3457; --primary: #748ffc; --primary-fg: #12152a; --accent: #262b4d; --danger: #ff8787; }
    }
    .icon {
      position: absolute; width: 26px; height: 26px; border-radius: 8px; border: 0; padding: 0; cursor: pointer;
      background: linear-gradient(135deg, #5c7cfa, #3b5bdb); color: #fff; font: 700 15px/26px system-ui, sans-serif;
      box-shadow: 0 2px 8px rgba(30, 40, 90, .35); text-align: center;
    }
    .icon:hover { filter: brightness(1.08); }
    .card {
      position: absolute; width: 340px; max-width: calc(100vw - 16px); max-height: 420px; overflow: auto;
      background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px;
      box-shadow: 0 10px 32px rgba(20, 25, 60, .25);
    }
    .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .word { font-size: 20px; font-weight: 700; }
    .phonetic { color: var(--muted); font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
    .speak, .close {
      border: 0; background: var(--accent); color: var(--primary); border-radius: 999px; width: 28px; height: 28px;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0;
    }
    .close { margin-left: auto; background: transparent; color: var(--muted); font-size: 18px; }
    .note { color: var(--muted); font-size: 12px; margin: 2px 0 0; }
    ol { list-style: none; margin: 10px 0 0; padding: 0; }
    li { padding: 7px 0; border-top: 1px solid var(--border); }
    li:first-child { border-top: 0; padding-top: 0; }
    .pos { color: var(--primary); font-style: italic; font-size: 12px; margin-right: 6px; }
    .label { font-weight: 700; }
    .zh { color: var(--muted); margin: 1px 0 0; }
    .en { font-size: 13px; margin: 1px 0 0; }
    .foot { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
    .btn {
      border: 0; border-radius: 999px; padding: 6px 16px; font: inherit; font-weight: 700; cursor: pointer;
      background: var(--primary); color: var(--primary-fg);
    }
    .btn.saved { background: var(--accent); color: var(--primary); }
    .btn:disabled { opacity: .6; cursor: default; }
    .link { border: 0; background: none; padding: 0; font: inherit; color: var(--primary); cursor: pointer; }
    .link:hover { text-decoration: underline; }
    .msg { color: var(--muted); margin: 6px 0 0; }
    .error { color: var(--danger); font-size: 13px; margin: 8px 0 0; }
  </style><div class="ui"></div>`;
  const ui = root.querySelector(".ui");

  let icon = null;
  let card = null;
  let pending = null; // { text, sentence, url, rect }

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

  // ---------------------------------------------------------------- 選取 → 小圖示

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

  document.addEventListener(
    "mouseup",
    (event) => {
      if (event.button !== 0 || event.composedPath().includes(host)) return;
      setTimeout(onSelection, 10); // 等瀏覽器更新選取範圍
    },
    true,
  );

  document.addEventListener(
    "mousedown",
    (event) => {
      if (!event.composedPath().includes(host)) hideAll();
    },
    true,
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideAll();
  });

  function onSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const text = cleanSelection(sel.toString());
    if (!text || text.length > MAX_LENGTH || !WORD_LIKE.test(text) || text.split(" ").length > MAX_WORDS) return;
    if (isEditable(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
    if (!last || (last.width === 0 && last.height === 0)) return;

    pending = { text, sentence: sentenceAround(range), url: location.href, rect: toPageRect(last) };
    showIcon(pending.rect);
  }

  function toPageRect(r) {
    return { left: r.left + scrollX, top: r.top + scrollY, right: r.right + scrollX, bottom: r.bottom + scrollY };
  }

  function showIcon(rect) {
    mount();
    hideCard();
    if (!icon) {
      icon = h("button", { className: "icon", title: "在 Moji 查詢", "aria-label": "在 Moji 查詢", onClick: openCard }, "M");
      ui.append(icon);
    }
    const left = Math.min(rect.right + 4, scrollX + document.documentElement.clientWidth - 30);
    icon.style.left = `${Math.max(scrollX + 4, left)}px`;
    icon.style.top = `${rect.bottom + 4}px`;
  }

  function hideIcon() {
    icon?.remove();
    icon = null;
  }

  function hideCard() {
    card?.remove();
    card = null;
  }

  function hideAll() {
    hideIcon();
    hideCard();
  }

  // ---------------------------------------------------------------- 選字所在的句子

  /** 取選取範圍所在段落裡、包含選取文字的那一句（給收藏記錄出處用） */
  function sentenceAround(range) {
    try {
      const start = range.startContainer;
      const startEl = start instanceof Element ? start : start.parentElement;
      const block = startEl?.closest(BLOCK_SELECTOR) ?? document.body;
      const before = document.createRange();
      before.selectNodeContents(block);
      before.setEnd(range.startContainer, range.startOffset);
      const text = block.textContent ?? "";
      const offset = before.toString().length;
      const end = offset + range.toString().length;

      const boundary = /[.!?。！？]["'”’)]*\s/g;
      let from = 0;
      let to = text.length;
      for (const m of text.matchAll(boundary)) {
        const stop = m.index + m[0].length;
        if (stop <= offset) from = stop;
        else if (m.index >= end - 1) {
          to = m.index + m[0].trimEnd().length;
          break;
        }
      }
      const sentence = text.slice(from, to).replace(/\s+/g, " ").trim();
      if (!sentence) return null;
      return sentence.length > MAX_SENTENCE ? null : sentence;
    } catch {
      return null;
    }
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
    hideIcon();
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
      renderWord(card, res.data, target);
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
      h("button", { className: "speak", title: "發音", "aria-label": "發音", onClick: () => speak(display) }, speakerIcon()),
      h("button", { className: "close", title: "關閉", "aria-label": "關閉", onClick: hideAll }, "×"),
    );
  }

  function renderWord(el, { word, loggedIn, saved }, target) {
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
    const error = h("p", { className: "error", hidden: "" });
    const foot = h("div", { className: "foot" });

    if (loggedIn) {
      let isSaved = saved;
      const button = h("button", { className: "btn" });
      const sync = () => {
        button.textContent = isSaved ? "✓ 已收藏" : "＋ 收藏";
        button.classList.toggle("saved", isSaved);
        button.title = isSaved ? "再按一次取消收藏" : "收藏到 Moji，並記下這句話的出處";
      };
      sync();
      button.addEventListener("click", async () => {
        button.disabled = true;
        error.hidden = true;
        const next = !isSaved;
        const res = await send({
          type: "save",
          headword: word.headword,
          saved: next,
          contextUrl: target.url,
          contextSentence: target.sentence,
        });
        button.disabled = false;
        if (res?.ok) {
          isSaved = next;
          sync();
        } else {
          error.textContent = res?.error ?? "收藏失敗";
          error.hidden = false;
        }
      });
      foot.append(button);
    } else {
      foot.append(h("button", { className: "link", onClick: () => open("/login") }, "登入 Moji 後即可收藏"));
    }
    foot.append(h("button", { className: "link", onClick: () => open(`/word/${encodeURIComponent(word.headword)}`) }, "完整解釋 →"));

    renderInto(
      el,
      header(word.display, word.phonetic),
      word.form ? h("p", { className: "note" }, `「${word.form}」的原形`) : null,
      word.senses.length ? list : h("p", { className: "msg" }, "還沒有釋義資料。"),
      foot,
      error,
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

  function speakerIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    for (const d of ["M11 5 6 9H2v6h4l5 4V5z", "M15.5 8.5a5 5 0 0 1 0 7", "M19 5a10 10 0 0 1 0 14"]) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      svg.append(p);
    }
    return svg;
  }
})();
