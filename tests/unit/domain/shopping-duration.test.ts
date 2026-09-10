import { describe, expect, it } from 'vitest';
import { estimateShoppingMinutes } from '@/server/domain/shopping-duration';

describe('estimateShoppingMinutes', () => {
  it('returns zero for an empty list', () => {
    expect(estimateShoppingMinutes(0)).toBe(0);
  });

  it('scales with item count', () => {
    expect(estimateShoppingMinutes(1)).toBe(7);
    expect(estimateShoppingMinutes(5)).toBe(15);
  });
});
