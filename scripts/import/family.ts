/**
 * 詞性家族 → dict_word_family（單字頁「詞性家族」區塊：diligent → diligence (n)、diligently (adv)）
 *
 * 1. Open English WordNet 2025（CC BY 4.0，source = 'oewn'）：sense 之間的 derivation（衍生）與
 *    pertainym（副詞 ← 形容詞）關係，視為雙向。取直接相連的字；再往外一層的字，
 *    只收和原字開頭至少 4 個字母相同的（decide → decisive → decisively 收，act → … → actuate 不收）。
 * 2. 字尾規則補缺漏（source = 'computed'）：例如 success → successful、beautiful → beauty。
 *    正反兩個方向都套用；衍生字與原字都必須在字典裡，且詞性符合規則（例如 -ly 的原字必須是形容詞，
 *    所以 early 不會被拆成 ear + ly）。
 *
 * 一律排除詞形變化（deciding、quicker，以及別的字的變化形如 faster，依 dict_word_forms）。
 * 只收 dict_entries 裡的字。必須在 ECDICT 與 WordNet 匯入之後執行。
 * 可重複執行：清空 dict_word_family 後重灌。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { wordFamily } from "../../src/db/schema";
import { connect, insertInBatches, requireRawFile, run } from "./lib";

type Pos = "n" | "v" | "adj" | "adv";
const POS_ORDER: Pos[] = ["n", "v", "adj", "adv"];
const MAX_PER_WORD = 12;

type OewnSense = { id: string; derivation?: string[]; pertainym?: string[] };
type OewnEntries = Record<string, Record<string, { sense?: OewnSense[] }>>;

/** sense key（diligence%1:07:00::）→ 字與詞性。ss_type：1 名詞、2 動詞、3/5 形容詞、4 副詞 */
const SS_TYPE: Record<string, Pos> = { "1": "n", "2": "v", "3": "adj", "4": "adv", "5": "adj" };
function parseSenseKey(key: string): { word: string; pos: Pos } | null {
  const m = /^(.+)%(\d):/.exec(key);
  const pos = m && SS_TYPE[m[2]];
  return m && pos ? { word: m[1], pos } : null;
}

/**
 * 字尾規則：原字以 baseEnd 結尾、詞性為 basePos 之一 ⇄ 衍生字以 derivedEnd 結尾、詞性為 derivedPos。
 * minStem：去掉字尾後至少要剩幾個字母（短字根容易誤判，例如 pig + ment）。
 * 只收準確度高的字尾；-al、-ic、-ous、-ive、-ion、-ize、-ance、-ment 誤判太多（leg/legal、lot/lotion、instant/instance、base/basement），
 * 而且這幾類 WordNet 的 derivation 本來就收得比較完整，不用規則補。
 */
type Rule = { baseEnd: string; basePos: Pos[]; derivedEnd: string; derivedPos: Pos; minStem: number };
const rule = (baseEnd: string, basePos: Pos[], derivedEnd: string, derivedPos: Pos, minStem = 4): Rule => ({
  baseEnd,
  basePos,
  derivedEnd,
  derivedPos,
  minStem,
});
const RULES: Rule[] = [
  // 副詞
  rule("", ["adj"], "ly", "adv", 3), // sad → sadly
  rule("y", ["adj"], "ily", "adv", 3), // happy → happily
  rule("le", ["adj"], "ly", "adv"), // gentle → gently
  rule("ic", ["adj"], "ically", "adv"), // magic → magically
  // 名詞
  rule("", ["adj"], "ness", "n", 3), // sad → sadness
  rule("y", ["adj"], "iness", "n", 3), // happy → happiness
  rule("", ["adj"], "ity", "n"), // acid → acidity
  rule("able", ["adj"], "ability", "n"),
  rule("ible", ["adj"], "ibility", "n"),
  rule("ent", ["adj"], "ence", "n"), // confident → confidence
  rule("ent", ["adj"], "ency", "n"),
  // 形容詞
  rule("", ["n", "v"], "ful", "adj", 3), // success → successful
  rule("y", ["n"], "iful", "adj", 3), // beauty → beautiful
  rule("", ["n"], "less", "adj", 3), // end → endless
  rule("", ["v"], "able", "adj"), // depend → dependable
  rule("e", ["v"], "able", "adj"), // remove → removable
  // 動詞
  rule("", ["adj"], "en", "v"), // dark → darken
];
/** 第二步（從規則找到的字再往外一步）只允許：形容詞 → -ly / -ness（success → successful → successfully） */
const SECOND_STEP = RULES.filter((r) => r.basePos.includes("adj") && (r.derivedPos === "adv" || r.derivedEnd.endsWith("ness")));

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i;
};

run(async () => {
  const dir = path.dirname(
    requireRawFile("oewn/entries-a.json", "請先依 scripts/import/wordnet.ts 的說明下載並解壓 Open English WordNet"),
  );

  // OEWN 的 derivation / pertainym 邊（雙向），記下兩端各自的詞性
  const edges = new Map<string, Map<string, Pos>>(); // word → (相連的字 → 那個字的詞性)
  const addEdge = (from: string, to: string, toPos: Pos) => {
    if (from === to) return;
    const m = edges.get(from) ?? edges.set(from, new Map()).get(from)!;
    if (!m.has(to)) m.set(to, toPos);
  };
  const isPlainWord = (w: string) => /^[a-z]+$/.test(w);
  for (const f of readdirSync(dir).filter((f) => f.startsWith("entries-") && f.endsWith(".json"))) {
    for (const [lemma, byPos] of Object.entries(readJson<OewnEntries>(path.join(dir, f)))) {
      if (!isPlainWord(lemma)) continue;
      for (const { sense = [] } of Object.values(byPos)) {
        for (const s of sense) {
          const self = parseSenseKey(s.id);
          if (!self) continue;
          for (const key of [...(s.derivation ?? []), ...(s.pertainym ?? [])]) {
            const other = parseSenseKey(key);
            if (!other || !isPlainWord(other.word)) continue;
            addEdge(lemma, other.word, other.pos);
            addEdge(other.word, lemma, self.pos);
          }
        }
      }
    }
  }

  const { db, close } = connect();
  try {
    const entryRows = await db.query.entries.findMany({ columns: { headword: true, frequencyRank: true } });
    if (entryRows.length === 0) throw new Error("dict_entries 是空的，請先執行 ECDICT 匯入");
    const rankOf = new Map(entryRows.map((e) => [e.headword, e.frequencyRank ?? 999_999]));

    // 每個字在字典裡的詞性（英英與中文釋義合併）
    const posOf = new Map<string, Set<Pos>>();
    const POS_MAP: Record<string, Pos> = { "n.": "n", "v.": "v", "vt.": "v", "vi.": "v", "vt.vi.": "v", "vi.vt.": "v", "adj.": "adj", "a.": "adj", "adv.": "adv" };
    for (const d of await db.query.definitions.findMany({ columns: { headword: true, pos: true } })) {
      const pos = d.pos ? POS_MAP[d.pos] : undefined;
      if (pos) (posOf.get(d.headword) ?? posOf.set(d.headword, new Set()).get(d.headword)!).add(pos);
    }
    const hasPos = (w: string, pos: Pos[]) => pos.some((p) => posOf.get(w)?.has(p));

    // 詞形變化：同一個字的變化形不算家族
    const lemmaOf = new Map<string, string>();
    for (const f of await db.query.wordForms.findMany({ columns: { form: true, lemma: true } })) lemmaOf.set(f.form, f.lemma);
    const root = (w: string) => lemmaOf.get(w) ?? w;

    /** 依字尾規則，從 w 往兩個方向找家族成員 */
    const bySuffix = (w: string, rules = RULES): [string, Pos][] => {
      const found: [string, Pos][] = [];
      for (const { baseEnd, basePos, derivedEnd, derivedPos, minStem } of rules) {
        // 正向：w 是原字
        if (w.endsWith(baseEnd) && w.length - baseEnd.length >= minStem && hasPos(w, basePos)) {
          const d = w.slice(0, w.length - baseEnd.length) + derivedEnd;
          if (rankOf.has(d) && hasPos(d, [derivedPos])) found.push([d, derivedPos]);
        }
        // 反向：w 是衍生字
        if (w.endsWith(derivedEnd) && w.length - derivedEnd.length >= minStem && hasPos(w, [derivedPos])) {
          const b = w.slice(0, w.length - derivedEnd.length) + baseEnd;
          const pos = basePos.find((p) => posOf.get(b)?.has(p));
          if (rankOf.has(b) && pos) found.push([b, pos]);
        }
      }
      return found;
    };

    const rows: (typeof wordFamily.$inferInsert)[] = [];
    const stats = { oewn: 0, computed: 0, words: 0 };
    for (const { headword: h } of entryRows) {
      if (!isPlainWord(h)) continue;
      const family = new Map<string, { pos: Pos; source: "oewn" | "computed" }>();
      const add = (w: string, pos: Pos, source: "oewn" | "computed") => {
        // 排除自己的變化形，以及本身是別的字變化形的字（quick 底下的 faster 是 fast 的比較級）
        if (w === h || !rankOf.has(w) || root(w) !== w || root(w) === root(h) || family.has(w)) return;
        family.set(w, { pos, source });
      };

      // 1. OEWN：直接相連，再加上開頭相同的第二層
      const first = edges.get(h) ?? new Map<string, Pos>();
      for (const [w, pos] of first) add(w, pos, "oewn");
      for (const w1 of first.keys()) {
        for (const [w2, pos] of edges.get(w1) ?? []) {
          if (commonPrefix(w2, h) >= 4) add(w2, pos, "oewn");
        }
      }

      // 2. 字尾規則：從原字出發，再從找到的字多走一步（success → successful → successfully）
      const level1 = bySuffix(h);
      for (const [w, pos] of level1) add(w, pos, "computed");
      for (const [w1, pos1] of level1) {
        if (pos1 !== "adj") continue;
        for (const [w2, pos] of bySuffix(w1, SECOND_STEP)) if (w2.startsWith(w1)) add(w2, pos, "computed");
      }

      if (family.size === 0) continue;
      stats.words++;
      [...family.entries()]
        .sort(([a, x], [b, y]) => POS_ORDER.indexOf(x.pos) - POS_ORDER.indexOf(y.pos) || rankOf.get(a)! - rankOf.get(b)! || a.localeCompare(b))
        .slice(0, MAX_PER_WORD)
        .forEach(([word, { pos, source }], i) => {
          rows.push({ headword: h, word, pos, rank: i, source });
          stats[source]++;
        });
    }

    await db.transaction(async (tx) => {
      await tx.delete(wordFamily);
      await insertInBatches(tx, wordFamily, rows);
    });
    console.log(
      `詞性家族：${stats.words} 個詞條有家族，共 ${rows.length} 筆（WordNet ${stats.oewn}、字尾規則 ${stats.computed}）`,
    );
  } finally {
    await close();
  }
});
