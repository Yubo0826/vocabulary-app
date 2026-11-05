/**
 * 「學習日」的界線：依使用者的時區與換日時間（dayStartsAtHour，例如凌晨 4 點）計算。
 * 凌晨 4 點換日時，台灣時間 11/6 03:00 仍算 11/5。
 */

type LocalDate = { year: number; month: number; day: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function localParts(at: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(at).map((p) => [p.type, Number(p.value)]));
  return parts as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
}

/** 時區在某個時刻與 UTC 的差（毫秒，當地時間 − UTC） */
function offsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** 當地某日的某個整點，換算成 UTC 時刻（day 超出月份範圍時自動進位） */
function zonedTime({ year, month, day }: LocalDate, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  const first = guess - offsetMs(new Date(guess), timeZone);
  // 再算一次，修正剛好跨過夏令時間切換的情況
  return new Date(guess - offsetMs(new Date(first), timeZone));
}

/** now 所屬的學習日（當地日期） */
export function studyDate(now: Date, timeZone: string, dayStartsAtHour: number): LocalDate {
  const { year, month, day } = localParts(new Date(now.getTime() - dayStartsAtHour * 3_600_000), timeZone);
  return { year, month, day };
}

/** now 所屬學習日往後 offsetDays 天的開始時刻（offsetDays = 0 為今天開始、1 為明天開始） */
export function studyDayStart(now: Date, timeZone: string, dayStartsAtHour: number, offsetDays = 0): Date {
  const d = studyDate(now, timeZone, dayStartsAtHour);
  return zonedTime({ ...d, day: d.day + offsetDays }, dayStartsAtHour, timeZone);
}

/** 學習日的 YYYY-MM-DD 字串 */
export function studyDateKey(now: Date, timeZone: string, dayStartsAtHour: number): string {
  const { year, month, day } = studyDate(now, timeZone, dayStartsAtHour);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
