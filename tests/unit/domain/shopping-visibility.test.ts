import { describe, expect, it } from 'vitest';
import { isVisibleOnShoppingList } from '@/server/domain/shopping-visibility';

describe('isVisibleOnShoppingList', () => {
  it('is always visible when unchecked', () => {
    const now = new Date('2026-09-10T18:00:00Z');
    expect(isVisibleOnShoppingList({ checked: false, checkedAt: null }, now)).toBe(true);
  });

  it('is visible when checked earlier the same day', () => {
    // Both at local midday (12:00 UTC), a few hours apart, well clear of
    // any timezone's midnight boundary — see the next test's comment on
    // why boundary-adjacent fixture times are avoided here.
    const now = new Date('2026-09-10T18:00:00Z');
    const checkedAt = new Date('2026-09-10T12:00:00Z');
    expect(isVisibleOnShoppingList({ checked: true, checkedAt }, now)).toBe(true);
  });

  it('is not visible when checked on a previous day', () => {
    // Exactly 24h apart at the same UTC clock time (noon), so they land
    // on different local calendar days under any fixed-offset timezone —
    // deliberately not right at a midnight boundary, where the outcome
    // would depend on the test runner's own local timezone (isSameDay
    // compares in local time, per docs/CLAUDE.md's "convert to the
    // user's timezone only at the render layer" convention).
    const now = new Date('2026-09-11T12:00:00Z');
    const checkedAt = new Date('2026-09-10T12:00:00Z');
    expect(isVisibleOnShoppingList({ checked: true, checkedAt }, now)).toBe(false);
  });

  it('is visible when checked but checkedAt is missing (defensive default)', () => {
    const now = new Date('2026-09-11T00:05:00Z');
    expect(isVisibleOnShoppingList({ checked: true, checkedAt: null }, now)).toBe(true);
  });
});
