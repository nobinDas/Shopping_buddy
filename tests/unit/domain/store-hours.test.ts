import { describe, expect, it } from 'vitest';
import { isOpenNow } from '@/server/domain/store-hours';

// Fixed to a known weekday: 2026-09-10 is a Thursday (day 4).
const THURSDAY_PERIODS = [{ day: 4, opensAt: '09:00', closesAt: '21:00' }];

describe('isOpenNow', () => {
  it('returns null when hours are unknown', () => {
    expect(isOpenNow(null, new Date('2026-09-10T15:00:00'))).toBeNull();
    expect(isOpenNow([], new Date('2026-09-10T15:00:00'))).toBeNull();
  });

  it("is true within the day's open period", () => {
    expect(isOpenNow(THURSDAY_PERIODS, new Date(2026, 8, 10, 15, 0))).toBe(true);
  });

  it('is false before opening or after closing', () => {
    expect(isOpenNow(THURSDAY_PERIODS, new Date(2026, 8, 10, 7, 0))).toBe(false);
    expect(isOpenNow(THURSDAY_PERIODS, new Date(2026, 8, 10, 22, 0))).toBe(false);
  });

  it('is false on a day with no period listed', () => {
    // 2026-09-11 is a Friday (day 5) — not in THURSDAY_PERIODS.
    expect(isOpenNow(THURSDAY_PERIODS, new Date(2026, 8, 11, 15, 0))).toBe(false);
  });
});
