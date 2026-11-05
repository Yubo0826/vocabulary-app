/**
 * 複習畫面需要的資料：下一張卡（含字典內容與四個評分的下次間隔）、佇列數量與統計。
 * 字典內容走 getWord（"use cache"），所以這個模組只在 Next 伺服器端使用；排程邏輯在 review.ts。
 */
import { getWord, type WordDetail } from "./dictionary";
import {
  getCard,
  getQueue,
  getReviewStats,
  getSettings,
  previewCard,
  type CardRow,
  type QueueCounts,
  type ReviewStats,
} from "./review";

const EXAMPLES_SHOWN = 2;
const EN_DEFS_SHOWN = 3;

export type ReviewItem = {
  cardId: string;
  headword: string;
  display: string;
  phonetic: string | null;
  state: number;
  zh: { pos: string | null; text: string }[];
  en: { pos: string | null; text: string }[];
  forms: string[];
  examples: WordDetail["examples"];
  /** 評分 1–4 的下次間隔文字，例如「10 分鐘」「3 天」 */
  intervals: Record<1 | 2 | 3 | 4, string>;
};

export type ReviewState = {
  item: ReviewItem | null;
  counts: QueueCounts;
  nextLearningDue: string | null;
  stats: ReviewStats;
};

/** 目前的複習狀態；cardId 有值時（復原後）優先顯示那張卡 */
export async function getReviewState(userId: string, cardId?: string): Promise<ReviewState> {
  const now = new Date();
  const settings = await getSettings(userId);
  const [queue, stats, forced] = await Promise.all([
    getQueue(userId, settings, now),
    getReviewStats(userId, settings, now),
    cardId ? getCard(userId, cardId) : null,
  ]);
  const card = forced ?? queue.next;
  return {
    item: card ? await toItem(card, now, settings) : null,
    counts: queue.counts,
    nextLearningDue: queue.nextLearningDue?.toISOString() ?? null,
    stats,
  };
}

async function toItem(card: CardRow, now: Date, settings: Awaited<ReturnType<typeof getSettings>>): Promise<ReviewItem> {
  const [word, preview] = await Promise.all([getWord(card.headword, EXAMPLES_SHOWN), previewCard(card, settings, now)]);
  return {
    cardId: card.id,
    headword: card.headword,
    display: word?.entry.display ?? card.headword,
    phonetic: word?.entry.phonetic ?? null,
    state: card.state,
    zh: word?.zh.map(({ pos, text }) => ({ pos, text })) ?? [],
    en: word?.en.slice(0, EN_DEFS_SHOWN).map(({ pos, text }) => ({ pos, text })) ?? [],
    forms: word?.inflections.map((f) => f.form) ?? [],
    examples: word?.examples ?? [],
    intervals: {
      1: formatInterval(preview[1].getTime() - now.getTime()),
      2: formatInterval(preview[2].getTime() - now.getTime()),
      3: formatInterval(preview[3].getTime() - now.getTime()),
      4: formatInterval(preview[4].getTime() - now.getTime()),
    },
  };
}

/** 間隔的顯示文字 */
export function formatInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} 分鐘`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小時`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天`;
  if (days < 365) return `${Math.round((days / 30) * 10) / 10} 個月`;
  return `${Math.round((days / 365) * 10) / 10} 年`;
}
