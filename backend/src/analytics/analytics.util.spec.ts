import { buildDailySeries, windowStart } from './analytics.util';

describe('analytics.util', () => {
  const today = new Date('2026-11-05T15:30:00Z');

  it('starts the window at UTC midnight', () => {
    expect(windowStart(today, 3).toISOString()).toBe('2026-11-03T00:00:00.000Z');
  });

  it('fills quiet days with zeros and keeps order', () => {
    const series = buildDailySeries(
      today,
      3,
      [{ day: new Date('2026-11-04T00:00:00Z'), count: 4 }],
      [{ day: new Date('2026-11-05T00:00:00Z'), count: 2 }],
    );
    expect(series).toEqual([
      { date: '2026-11-03', created: 0, completed: 0 },
      { date: '2026-11-04', created: 4, completed: 0 },
      { date: '2026-11-05', created: 0, completed: 2 },
    ]);
  });
});
