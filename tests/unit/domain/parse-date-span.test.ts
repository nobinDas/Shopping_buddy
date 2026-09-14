import { describe, expect, it } from 'vitest';
import { parseDateSpan } from '@/server/domain/parse-date-span';

describe('parseDateSpan', () => {
  it('parses English long form', () => {
    expect(parseDateSpan('September 8, 2027')).toBe('2027-09-08');
    expect(parseDateSpan('October 1, 2026')).toBe('2026-10-01');
  });

  it('parses US slash MM/DD/YYYY', () => {
    expect(parseDateSpan('10/15/2026')).toBe('2026-10-15');
  });

  it('parses international "D Month YYYY" with no comma', () => {
    expect(parseDateSpan('15 October 2026')).toBe('2026-10-15');
  });

  it('parses German "D. Month YYYY"', () => {
    expect(parseDateSpan('7. Oktober 2026')).toBe('2026-10-07');
  });

  it('parses Japanese "YYYY年M月D日"', () => {
    expect(parseDateSpan('2026年10月5日')).toBe('2026-10-05');
  });

  it('passes through an already-ISO date', () => {
    expect(parseDateSpan('2026-10-05')).toBe('2026-10-05');
  });

  it('is not fooled by a far-future year — no special-casing by distance from now', () => {
    expect(parseDateSpan('September 10, 2029')).toBe('2029-09-10');
  });

  it('returns null for null, undefined, or empty input', () => {
    expect(parseDateSpan(null)).toBeNull();
    expect(parseDateSpan(undefined)).toBeNull();
    expect(parseDateSpan('')).toBeNull();
  });

  it('returns null for unrecognized text', () => {
    expect(parseDateSpan('sometime next month')).toBeNull();
    expect(parseDateSpan('in 3 days')).toBeNull();
    expect(parseDateSpan('not a date at all')).toBeNull();
  });

  it('returns null for an invalid calendar date', () => {
    expect(parseDateSpan('February 30, 2026')).toBeNull();
    expect(parseDateSpan('13/01/2026')).toBeNull(); // not a valid MM/DD
    expect(parseDateSpan('2026-02-30')).toBeNull();
  });
});
