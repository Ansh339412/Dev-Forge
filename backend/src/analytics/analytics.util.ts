const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayCount {
  day: Date;
  count: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  created: number;
  completed: number;
}

const key = (d: Date) => d.toISOString().slice(0, 10);

/** Start of the window: UTC midnight, (days - 1) days before `today`. */
export const windowStart = (today: Date, days: number): Date =>
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY_MS);

/** Dense per-day series (zeros for quiet days) so charts have no gaps. */
export function buildDailySeries(
  today: Date,
  days: number,
  created: DayCount[],
  completed: DayCount[],
): DailyPoint[] {
  const createdBy = new Map(created.map((r) => [key(r.day), r.count]));
  const completedBy = new Map(completed.map((r) => [key(r.day), r.count]));
  const start = windowStart(today, days).getTime();
  return Array.from({ length: days }, (_, i) => {
    const date = key(new Date(start + i * DAY_MS));
    return { date, created: createdBy.get(date) ?? 0, completed: completedBy.get(date) ?? 0 };
  });
}
