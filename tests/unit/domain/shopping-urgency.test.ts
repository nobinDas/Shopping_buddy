import { describe, expect, it } from 'vitest';
import { sortItemsByUrgency, storeUrgency, isOverdue } from '@/server/domain/shopping-urgency';

describe('sortItemsByUrgency', () => {
  it('sorts ascending by due date', () => {
    const items = [{ dueAt: '2026-09-20' }, { dueAt: '2026-09-10' }, { dueAt: '2026-09-15' }];
    expect(sortItemsByUrgency(items).map((i) => i.dueAt)).toEqual([
      '2026-09-10',
      '2026-09-15',
      '2026-09-20',
    ]);
  });

  it('sorts items with no due date last', () => {
    const items = [{ dueAt: null }, { dueAt: '2026-09-10' }];
    expect(sortItemsByUrgency(items).map((i) => i.dueAt)).toEqual(['2026-09-10', null]);
  });

  it('does not mutate the input array', () => {
    const items = [{ dueAt: '2026-09-20' }, { dueAt: '2026-09-10' }];
    const original = [...items];
    sortItemsByUrgency(items);
    expect(items).toEqual(original);
  });
});

describe('storeUrgency', () => {
  it('returns the soonest due date among items that have one', () => {
    const items = [{ dueAt: '2026-09-20' }, { dueAt: '2026-09-10' }, { dueAt: null }];
    expect(storeUrgency(items)).toBe('2026-09-10');
  });

  it('returns null when no item has a due date', () => {
    expect(storeUrgency([{ dueAt: null }, { dueAt: null }])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(storeUrgency([])).toBeNull();
  });
});

describe('isOverdue', () => {
  it('is false when there is no due date', () => {
    expect(isOverdue(null, '2026-09-10')).toBe(false);
  });

  it('is false when the due date is today', () => {
    expect(isOverdue('2026-09-10', '2026-09-10')).toBe(false);
  });

  it('is false when the due date is in the future', () => {
    expect(isOverdue('2026-09-15', '2026-09-10')).toBe(false);
  });

  it('is true when the due date has passed', () => {
    expect(isOverdue('2026-09-05', '2026-09-10')).toBe(true);
  });
});
