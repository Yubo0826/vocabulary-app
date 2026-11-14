/**
 * 查字歷史（伺服器端）。所有函式都以呼叫端傳入、已驗證過的 userId 過濾。
 * 未登入時歷史只存在瀏覽器（lookup-history-local.ts），登入後第一次讀取時合併進來。
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { lookupHistory } from "@/db/schema";
import { normalizeHeadword } from "./headword";

export const RECENT_LOOKUPS = 8; // 搜尋框顯示幾筆
export const MAX_MERGE = 50; // 一次最多合併幾筆瀏覽器暫存

export type LookupEntry = { headword: string; at: number };

/** 記錄（或批次合併）查過的字：已有的只更新 viewedAt（取較新的），並取消「已移除」 */
export async function recordLookups(userId: string, items: LookupEntry[]): Promise<void> {
  const rows = items
    .map((i) => ({ headword: normalizeHeadword(i.headword), viewedAt: new Date(i.at) }))
    .filter((r) => r.headword && !Number.isNaN(r.viewedAt.getTime()))
    .slice(0, MAX_MERGE);
  // 同一批裡重複的字只留最新一筆，避免 ON CONFLICT 同一列更新兩次
  const latest = new Map<string, Date>();
  for (const r of rows) if (!latest.has(r.headword) || latest.get(r.headword)! < r.viewedAt) latest.set(r.headword, r.viewedAt);
  if (latest.size === 0) return;

  await db
    .insert(lookupHistory)
    .values([...latest].map(([headword, viewedAt]) => ({ userId, headword, viewedAt })))
    .onConflictDoUpdate({
      target: [lookupHistory.userId, lookupHistory.headword],
      set: {
        viewedAt: sql`greatest(${lookupHistory.viewedAt}, excluded.viewed_at)`,
        deletedAt: null,
        updatedAt: sql`now()`,
      },
    });
}

/** 最近查過的字（新到舊） */
export async function listRecentLookups(userId: string, limit = RECENT_LOOKUPS): Promise<string[]> {
  const rows = await db
    .select({ headword: lookupHistory.headword })
    .from(lookupHistory)
    .where(and(eq(lookupHistory.userId, userId), isNull(lookupHistory.deletedAt)))
    .orderBy(desc(lookupHistory.viewedAt))
    .limit(limit);
  return rows.map((r) => r.headword);
}

/** 從歷史移除一個字（軟刪除） */
export async function removeLookup(userId: string, rawHeadword: string): Promise<void> {
  await db
    .update(lookupHistory)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(lookupHistory.userId, userId), eq(lookupHistory.headword, normalizeHeadword(rawHeadword))));
}
