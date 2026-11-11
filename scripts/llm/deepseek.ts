/**
 * DeepSeek Chat API（OpenAI 相容格式）：送出 system + user 訊息，要求回傳 JSON。
 * 失敗時重試 3 次（間隔遞增）。需要 .env.local 的 DEEPSEEK_API_KEY。
 */
const API_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-chat";

export type Usage = { prompt_tokens: number; completion_tokens: number; prompt_cache_hit_tokens?: number };

export async function chatJson(
  apiKey: string,
  system: string,
  user: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ model: string; json: unknown; usage: Usage }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8000,
        }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      // API 回報的 model 是實際版本（例如 deepseek-flash），記錄這個而不是請求用的別名
      return { model: data.model ?? DEEPSEEK_MODEL, json: JSON.parse(content), usage: data.usage };
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  請求失敗（第 ${attempt} 次），稍後重試：${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** 依序累加多次請求的 token 用量 */
export function usageTotals() {
  const total = { prompt: 0, completion: 0, cacheHit: 0, requests: 0 };
  return {
    add(u: Usage | undefined) {
      total.requests++;
      total.prompt += u?.prompt_tokens ?? 0;
      total.completion += u?.completion_tokens ?? 0;
      total.cacheHit += u?.prompt_cache_hit_tokens ?? 0;
    },
    toString: () =>
      `token：輸入 ${total.prompt}（快取命中 ${total.cacheHit}），輸出 ${total.completion}，共 ${total.requests} 個請求`,
  };
}
