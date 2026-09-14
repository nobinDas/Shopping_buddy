import { describe, expect, it } from 'vitest';
import { levenshteinSimilarity } from '@/server/domain/levenshtein';

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('netflix', 'netflix')).toBe(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(levenshteinSimilarity('', '')).toBe(1);
  });

  it('returns 0 when one string is empty and the other is not', () => {
    expect(levenshteinSimilarity('', 'netflix')).toBe(0);
  });

  it('scores a single-character typo highly', () => {
    // "netflix" vs "netflx" — one deletion, length 7 -> similarity 6/7
    expect(levenshteinSimilarity('netflix', 'netflx')).toBeCloseTo(6 / 7, 5);
  });

  it('scores completely different strings low', () => {
    expect(levenshteinSimilarity('netflix', 'spotify')).toBeLessThan(0.5);
  });

  it('is symmetric', () => {
    expect(levenshteinSimilarity('adobe', 'adobee')).toBeCloseTo(
      levenshteinSimilarity('adobee', 'adobe'),
      5,
    );
  });
});
