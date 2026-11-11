/**
 * LLM 例句的檢查規則：產生時用來決定要不要重試，也可單獨跑 check-examples 檢查整批資料。
 */
import * as OpenCC from "opencc-js/cn2t";

export type Example = { en: string; zh: string };

/**
 * 簡體字判斷：不在 Big5（常用＋次常用字，lead byte 0xA4–0xF9）裡、而且 OpenCC 有對應繁體字的字。
 * - 只用 OpenCC：郁、岩、准、划、台、布這類台灣也通用的寫法會被誤判（它們都在 Big5 裡）
 * - 只用 Big5：酶、肽、苷、蟎這類 Big5 沒收的罕用繁體字會被誤判（OpenCC 轉換後不變）
 */
const BIG5 = (() => {
  const decoder = new TextDecoder("big5");
  const set = new Set<string>();
  for (let lead = 0xa4; lead <= 0xf9; lead++) {
    for (const [from, to] of [[0x40, 0x7e], [0xa1, 0xfe]]) {
      for (let trail = from; trail <= to; trail++) {
        const c = decoder.decode(new Uint8Array([lead, trail]));
        if (c.length === 1 && c !== "\ufffd") set.add(c);
      }
    }
  }
  return set;
})();
const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
/** Big5 裡也有、但實際上幾乎都是被當成簡體字使用的字（机＝機、网＝網…） */
const SIMPLIFIED_IN_BIG5 = new Set([..."机网么叶云"]);
const isSimplified = (c: string) =>
  /[\u4e00-\u9fff]/.test(c) && (SIMPLIFIED_IN_BIG5.has(c) || (!BIG5.has(c) && toTraditional(c) !== c));
/** 常見的大陸用語（不含「質量」：物理的質量是正確用法）。Tatoeba 匯入也用這份清單替翻譯扣分 */
export const MAINLAND_TERMS = ["信息", "軟件", "硬件", "網絡", "視頻", "出租車", "屏幕", "鼠標", "程序員", "默認", "博客", "短信", "公交", "激光", "數據庫", "土豆", "打印", "漲工資", "加工資"];

export const MIN_WORDS = 6;
export const MAX_WORDS = 22;

/** 斷詞；連字號複合詞（well-funded）另外拆出各部分 */
const tokenize = (s: string) => {
  const tokens = s.toLowerCase().replace(/’/g, "'").match(/[a-z]+(?:['-][a-z]+)*/g) ?? [];
  return [...tokens, ...tokens.filter((t) => t.includes("-")).flatMap((t) => t.split("-"))];
};
const countWords = (s: string) => (s.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) ?? []).length;

/** 句中有沒有這個字：本身、字典記錄的變化形，或常見字尾變化（-s、-ed、-ing、-ies…） */
function containsWord(headword: string, forms: Set<string>, en: string): boolean {
  if (headword.includes(" ")) return en.toLowerCase().includes(headword);
  const base = headword.replace(/(e|y)$/, "");
  // 拉丁／希臘式不規則複數：thesis → theses、cactus → cacti、datum → data、criterion → criteria
  const latin = headword.match(/^(.+)(is|us|um|on)$/);
  const latinPlurals = latin ? { is: ["es"], us: ["i"], um: ["a"], on: ["a"] }[latin[2]]!.map((end) => latin[1] + end) : [];
  return tokenize(en).some(
    (t) =>
      t === headword ||
      forms.has(t) ||
      latinPlurals.includes(t) ||
      (t.startsWith(base) && t.length - headword.length <= 4 && t.length >= headword.length - 1),
  );
}

/** 中文的問題：簡體字、大陸用語、半形標點、沒有中文。補例句與詞義分組（標籤、翻譯修正）共用 */
export function zhProblems(zh: string): string[] {
  const problems: string[] = [];
  const simplified = [...new Set([...zh].filter(isSimplified))];
  if (simplified.length) problems.push(`簡體字 ${simplified.join("")}：${zh}`);
  const mainland = MAINLAND_TERMS.filter((m) => zh.includes(m));
  if (mainland.length) problems.push(`大陸用語 ${mainland.join("、")}：${zh}`);
  if (/[,?!:;]/.test(zh)) problems.push(`中文用了半形標點：${zh}`);
  if (!/[\u4e00-\u9fff]/.test(zh)) problems.push(`沒有中文：${zh}`);
  return problems;
}

/** 回傳這個字的問題清單；空陣列代表通過 */
export function checkWord(headword: string, forms: Set<string>, examples: unknown): string[] {
  if (!Array.isArray(examples)) return ["examples 不是陣列"];
  if (examples.length !== 2) return [`應有 2 句，實際 ${examples.length} 句`];
  const problems: string[] = [];
  for (const ex of examples as Partial<Example>[]) {
    const en = typeof ex?.en === "string" ? ex.en.trim() : "";
    const zh = typeof ex?.zh === "string" ? ex.zh.trim() : "";
    if (!en || !zh) {
      problems.push("有空白的英文或中文");
      continue;
    }
    const n = countWords(en);
    if (n < MIN_WORDS || n > MAX_WORDS) problems.push(`英文 ${n} 字：${en}`);
    if (!containsWord(headword, forms, en)) problems.push(`句中沒有該字：${en}`);
    problems.push(...zhProblems(zh));
  }
  return problems;
}
