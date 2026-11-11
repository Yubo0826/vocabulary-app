/**
 * 用 DeepSeek 產生中英例句 → data/llm/examples/<檔名>.json（之後由 npm run import:llm-examples 匯入）
 *
 * 挑字：詞頻前 20,000、目前沒有任何例句的字，排除專有名詞與縮寫
 *   （原始寫法含大寫、中文釋義標示人名／地名／縮寫、或沒有英英釋義且 ≤ 4 個字母）。
 * 已出現在 data/llm/examples/ 任一檔案的字會跳過，所以中斷後重跑會接續。
 * 每批結果檢查（validate.ts）後才寫入；沒通過的字再送一次，仍失敗就列出不寫入。
 *
 * 需要 .env.local 的 DEEPSEEK_API_KEY。
 * 參數：--limit=250（這次最多處理幾個字）--batch=20（每次請求幾個字）--concurrency=4 --out=檔名.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { connect, getArg, ROOT, run } from "../import/lib";
import { checkWord, type Example } from "./validate";

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";
const DATA_DIR = path.join(ROOT, "data/llm/examples");
const MAX_ATTEMPTS = 2;

type Word = { headword: string; zh: string; en: string };
type OutWord = { headword: string; examples: Example[] };
type OutFile = { model: string; generatedAt: string; method: string; words: OutWord[] };

const SYSTEM_PROMPT = `你是英文學習字典的例句編輯。使用者會給你一組英文單字（JSON），每個字附中文與英英釋義。
請為每個字寫 2 句例句，每句附台灣繁體中文翻譯，以 JSON 回覆：
{"words":[{"headword":"...","examples":[{"en":"...","zh":"..."},{"en":"...","zh":"..."}]}]}

英文例句：
- 8–20 個英文字，自然、現代的英文，像優質學習字典裡的例句。
- 句中必須出現該字本身或它的變化形（複數、-ed、-ing、-s、比較級…）。
- 用最常見的詞義（依釋義判斷）；若有兩個明顯不同的常用詞義，兩句各示範一個。
- 情境要能看出字義。不要出現真實在世名人。避免血腥、色情、歧視與政治爭議內容；若這個字只有粗俗或冒犯性的意思，回傳 "examples": []。
- 句型要有變化：主詞可以是人名、代名詞（I、She、They…）、名詞片語或子句，也可以用疑問句、祈使句或以副詞／介系詞片語開頭。同一個字的兩句不可都用 The 開頭，整批用 The 開頭的句子不超過四分之一。

中文翻譯：
- 台灣繁體中文，依意思自然翻譯，不要逐字直譯。
- 一律使用台灣用語：軟體（不是軟件）、品質（不是質量）、資訊（不是信息）、網路（不是網絡）、影片（不是視頻）、計程車（不是出租車）、螢幕（不是屏幕）、程式（不是程序）。
- 使用全形中文標點（，。？！：「」）。
- 絕對不要出現簡體字。

headword 必須與輸入完全相同、依輸入順序、不可遺漏。只回覆 JSON。`;

async function loadCandidates(db: ReturnType<typeof connect>["db"], done: Set<string>, limit: number) {
  const { rows } = await db.execute<Word & { forms: string[] | null }>(sql`
    SELECT e.headword,
      coalesce((SELECT string_agg(coalesce(d.pos, '') || ' ' || d.text, ' ／ ' ORDER BY d.id)
                FROM dict_definitions d WHERE d.headword = e.headword AND d.lang = 'zh-TW'), '') AS zh,
      coalesce((SELECT string_agg(coalesce(d.pos, '') || ' ' || d.text, ' ／ ' ORDER BY d.id)
                FROM (SELECT * FROM dict_definitions d2 WHERE d2.headword = e.headword AND d2.lang = 'en' ORDER BY d2.id LIMIT 3) d), '') AS en,
      (SELECT array_agg(f.form) FROM dict_word_forms f WHERE f.lemma = e.headword) AS forms
    FROM dict_entries e
    WHERE e.frequency_rank <= 20000
      AND e.headword ~ '^[a-z][a-z -]*[a-z]$'
      AND e.display = lower(e.display)
      AND NOT EXISTS (SELECT 1 FROM dict_example_words w WHERE w.headword = e.headword)
    ORDER BY e.frequency_rank, e.headword`);
  const excluded = (w: Word) =>
    /(縮寫|abbr|人名|地名|男子名|女子名|姓氏|（[A-Z])/.test(w.zh) || (!w.en && w.headword.length <= 4);
  return rows
    .filter((w) => !done.has(w.headword) && !excluded(w))
    .slice(0, limit)
    .map((w) => ({ word: { headword: w.headword, zh: w.zh, en: w.en }, forms: new Set(w.forms ?? []) }));
}

/** 已經產生過的字（data/llm/examples/ 所有檔案） */
function existingHeadwords(): Set<string> {
  const set = new Set<string>();
  for (const f of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
    for (const w of (JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8")) as OutFile).words) set.add(w.headword);
  }
  return set;
}

type Usage = { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number };

async function callDeepSeek(apiKey: string, words: Word[]): Promise<{ model: string; words: unknown; usage: Usage }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(words) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 8000,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      return { model: data.model ?? MODEL, words: JSON.parse(content).words, usage: data.usage };
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  請求失敗（第 ${attempt} 次），稍後重試：${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

run(async () => {
  const limit = Number(getArg("limit") ?? 250);
  const batchSize = Number(getArg("batch") ?? 20);
  const concurrency = Number(getArg("concurrency") ?? 4);
  const outPath = path.join(DATA_DIR, getArg("out") ?? `${new Date().toISOString().slice(0, 10)}-deepseek.json`);

  const { db, close } = connect(); // 也會載入 .env.local
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set（請確認 .env.local）");

  let queue: { word: Word; forms: Set<string>; attempts: number }[];
  try {
    queue = (await loadCandidates(db, existingHeadwords(), limit)).map((c) => ({ ...c, attempts: 0 }));
  } finally {
    await close();
  }
  console.log(`這次處理 ${queue.length} 個字，每次 ${batchSize} 個、同時 ${concurrency} 個請求 → ${path.relative(ROOT, outPath)}`);

  const out: OutFile = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : {
        model: MODEL,
        generatedAt: new Date().toISOString().slice(0, 10),
        method: "scripts/llm/generate-examples.ts：每字 2 句，依 ECDICT 中文釋義與 OEWN 英英釋義選常見詞義，中文為台灣用語意譯",
        words: [],
      };
  const failed: { headword: string; problems: string[] }[] = [];
  const skipped: string[] = [];
  const total = { prompt: 0, completion: 0, cacheHit: 0 };
  let requests = 0;

  const worker = async () => {
    while (queue.length) {
      const batch = queue.splice(0, batchSize);
      batch.forEach((b) => b.attempts++);
      const result = await callDeepSeek(key, batch.map((b) => b.word));
      requests++;
      out.model = result.model; // 記錄 API 實際回報的模型版本
      total.prompt += result.usage?.prompt_tokens ?? 0;
      total.completion += result.usage?.completion_tokens ?? 0;
      total.cacheHit += result.usage?.prompt_cache_hit_tokens ?? 0;

      const byHeadword = new Map<string, unknown>();
      if (Array.isArray(result.words)) {
        for (const w of result.words as { headword?: string; examples?: unknown }[]) {
          if (typeof w?.headword === "string") byHeadword.set(w.headword.trim().toLowerCase(), w.examples);
        }
      }
      for (const b of batch) {
        const examples = byHeadword.get(b.word.headword);
        if (Array.isArray(examples) && examples.length === 0) {
          skipped.push(b.word.headword); // 模型判斷只有冒犯性意思
          continue;
        }
        const problems = examples === undefined ? ["回覆中沒有這個字"] : checkWord(b.word.headword, b.forms, examples);
        if (problems.length === 0) {
          const list = (examples as Example[]).map((e) => ({ en: e.en.trim(), zh: e.zh.trim() }));
          out.words.push({ headword: b.word.headword, examples: list });
        } else if (b.attempts < MAX_ATTEMPTS) {
          queue.push(b);
        } else {
          failed.push({ headword: b.word.headword, problems });
        }
      }
      writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n"); // 每批存檔，中斷也不會白跑
      console.log(`  第 ${requests} 個請求完成：累計 ${out.words.length} 字，剩 ${queue.length} 字待處理`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  console.log(`\n成功 ${out.words.length} 字（檔案累計），失敗 ${failed.length} 字，略過 ${skipped.length} 字`);
  console.log(`token：輸入 ${total.prompt}（快取命中 ${total.cacheHit}），輸出 ${total.completion}，共 ${requests} 個請求`);
  if (skipped.length) console.log(`略過（只有冒犯性意思）：${skipped.join("、")}`);
  for (const f of failed) console.log(`失敗 ${f.headword}：${f.problems.join("；")}`);
});
