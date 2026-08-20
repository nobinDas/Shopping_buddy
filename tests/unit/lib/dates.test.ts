import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/dates';

describe('formatDate', () => {
  it('formats an ISO date-only string as "d MMM yyyy"', () => {
    expect(formatDate('2026-03-15')).toBe('15 Mar 2026');
  });

  it('does not shift the date across a month boundary', () => {
    // Guards against the classic bug this file exists to avoid: parsing a
    // bare date string with `new Date(...)` reads it as UTC midnight, which
    // some local timezones then read back as the last day of the prior
    // month. parseISO (used internally) avoids that.
    expect(formatDate('2026-01-01')).toBe('1 Jan 2026');
  });

  it('formats a leap day correctly', () => {
    expect(formatDate('2024-02-29')).toBe('29 Feb 2024');
  });
});