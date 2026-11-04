/**
 * ECDICT → dict_entries、dict_definitions（lang = zh-TW）、dict_word_forms
 *
 * 原始檔：data/raw/ecdict/ecdict.csv
 *   https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
 *
 * 參數：
 *   --max-rank=30000   frq 或 bnc 詞頻排名在此以內的字視為常用字
 *   --tags=toefl,ielts,gre   有這些 tag 的字即使排名較後也保留（逗號分隔，空字串表示不保留）
 *
 * 可重複執行：在單一 transaction 中 TRUNCATE dict_entries（CASCADE）與 dict_word_forms 後重灌。
 * 因為 CASCADE，WordNet 釋義、例句關聯、易混淆字也會一併清空，跑完需重跑其他匯入腳本。
 */
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { sql } from "drizzle-orm";
import { definitions, entries, wordForms } from "../../src/db/schema";
import { normalizeHeadword } from "../../src/lib/headword";
import { connect, getArg, insertInBatches, requireRawFile, run, toTaiwanese } from "./lib";

const SOURCE = "ecdict";

type EcdictRow = {
  word: string;
  phonetic: string;
  translation: string;
  tag: string;
  bnc: string;
  frq: string;
  exchange: string;
};

// translation 開頭可能出現的詞性標記（ECDICT 實際出現過的值）
const POS = new Set([
  "n", "v", "vt", "vi", "a", "adj", "adv", "prep", "conj", "pron", "num", "art",
  "aux", "int", "interj", "abbr", "pl", "vbl", "pref", "suf", "phr", "comb", "na",
]);
// exchange 中「原形 → 變化形」的代碼；0 與 1 是變化形指回原形用的，另外處理
const FORM_KINDS = new Set(["p", "d", "i", "3", "r", "t", "s"]);

/** 拆出開頭的詞性，例如 "vt. 收到, 接到" → { pos: "vt.", text: "收到, 接到" }、"n. & v. ..." 也支援 */
function splitPos(line: string): { pos: string | null; text: string } {
  const m = /^((?:[a-z]+\.\s*(?:&\s*)?)+)\s*(.*)$/.exec(line);
  if (!m) return { pos: null, text: line };
  const tokens = m[1].match(/[a-z]+(?=\.)/g) ?? [];
  if (!m[2] || !tokens.every((t) => POS.has(t))) return { pos: null, text: line };
  return { pos: m[1].trim(), text: m[2] };
}

/** "p:went/d:gone/i:going/3:goes" → [["p","went"], ...] */
function parseExchange(exchange: string): [string, string][] {
  if (!exchange) return [];
  return exchange
    .split("/")
    .map((part) => {
      const i = part.indexOf(":");
      return [part.slice(0, i), part.slice(i + 1)] as [string, string];
    })
    .filter(([k, v]) => k && v);
}

/** frq 與 bnc 中較好的正排名；兩者皆 0 表示無排名 */
function rankOf(row: EcdictRow): number | null {
  const ranks = [Number(row.frq), Number(row.bnc)].filter((n) => Number.isFinite(n) && n > 0);
  return ranks.length ? Math.min(...ranks) : null;
}

run(async () => {
  const maxRank = Number(getArg("max-rank") ?? 30000);
  const keepTags = new Set((getArg("tags") ?? "toefl,ielts,gre").split(",").filter(Boolean));
  const file = requireRawFile(
    "ecdict/ecdict.csv",
    "請下載：curl -L -o data/raw/ecdict/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv",
  );
  console.log(`篩選條件：排名 ≤ ${maxRank}，或 tag 含 ${[...keepTags].join(", ") || "（無）"}`);

  // 第一輪：挑出常用字；非常用字只留下「指回原形」的 exchange，用來補詞形對照
  const selected = new Map<string, { row: EcdictRow; rank: number | null }>();
  const inflectedRows: { form: string; exchange: [string, string][] }[] = [];
  let total = 0;
  let collisions = 0;

  const parser = createReadStream(file).pipe(parse({ columns: true, relax_quotes: true }));
  for await (const row of parser as AsyncIterable<EcdictRow>) {
    total++;
    const headword = normalizeHeadword(row.word);
    if (!headword) continue;
    const exchange = parseExchange(row.exchange);
    if (exchange.some(([k]) => k === "0")) inflectedRows.push({ form: headword, exchange });

    const rank = rankOf(row);
    const tags = row.tag.split(" ").filter(Boolean);
    if (!((rank !== null && rank <= maxRank) || tags.some((t) => keepTags.has(t)))) continue;

    // 正規化後撞名（例如 "US" 與 "us"）：優先保留原本就是小寫的，其次保留排名較前的
    const prev = selected.get(headword);
    if (prev) {
      collisions++;
      const prevIsLower = prev.row.word.trim() === headword;
      const curIsLower = row.word.trim() === headword;
      const curBetterRank = (rank ?? Infinity) < (prev.rank ?? Infinity);
      if (prevIsLower && !curIsLower) continue;
      if (prevIsLower === curIsLower && !curBetterRank) continue;
    }
    selected.set(headword, { row, rank });
  }

  // 組出要寫入的資料
  const entryRows: (typeof entries.$inferInsert)[] = [];
  const definitionRows: (typeof definitions.$inferInsert)[] = [];
  const formKeys = new Set<string>();
  const formRows: (typeof wordForms.$inferInsert)[] = [];
  const addForm = (form: string, lemma: string, kind: string) => {
    if (!form || form === lemma || !selected.has(lemma)) return;
    const key = `${form}\t${lemma}\t${kind}`;
    if (formKeys.has(key)) return;
    formKeys.add(key);
    formRows.push({ form, lemma, kind });
  };

  for (const [headword, { row, rank }] of selected) {
    const tags = row.tag.split(" ").filter(Boolean);
    entryRows.push({
      headword,
      display: row.word.trim(),
      phonetic: row.phonetic.trim() || null,
      frequencyRank: rank,
      tags: tags.length ? tags : null,
      source: SOURCE,
    });

    // translation 以字面上的 "\n" 分隔（CSV 內也可能是真的換行）
    const lines = row.translation.split(/\\n|\r?\n/).map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      const { pos, text } = splitPos(line);
      definitionRows.push({
        headword,
        lang: "zh-TW",
        pos,
        text: toTaiwanese(text),
        sortOrder: i,
        source: SOURCE,
      });
    });

    for (const [kind, value] of parseExchange(row.exchange)) {
      if (FORM_KINDS.has(kind)) addForm(normalizeHeadword(value), headword, kind);
    }
  }

  // 變化形那一列的 "0:原形/1:代碼"（代碼可能是多個字元，例如 "pd" = 過去式兼過去分詞）
  for (const { form, exchange } of inflectedRows) {
    const lemma = normalizeHeadword(exchange.find(([k]) => k === "0")?.[1] ?? "");
    const kinds = exchange.find(([k]) => k === "1")?.[1] ?? "";
    for (const kind of kinds) if (FORM_KINDS.has(kind)) addForm(form, lemma, kind);
  }

  const { db, close } = connect();
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`TRUNCATE ${entries}, ${wordForms} RESTART IDENTITY CASCADE`);
      await insertInBatches(tx, entries, entryRows);
      await insertInBatches(tx, definitions, definitionRows);
      await insertInBatches(tx, wordForms, formRows);
    });
  } finally {
    await close();
  }

  console.log(`ECDICT 共 ${total} 列，選入 ${entryRows.length} 個詞條（正規化撞名 ${collisions} 次）`);
  console.log(`寫入中文釋義 ${definitionRows.length} 筆、詞形對照 ${formRows.length} 筆`);
  console.log("⚠️ dict_entries 以 CASCADE 清空過，請接著重跑 WordNet 與 Tatoeba 匯入");
});
