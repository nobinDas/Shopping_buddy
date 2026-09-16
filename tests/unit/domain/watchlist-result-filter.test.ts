import { describe, expect, it } from 'vitest';
import { isLikelyAccessory } from '@/server/domain/watchlist-result-filter';

describe('isLikelyAccessory', () => {
  it('flags a title matching one of the planner-supplied exclude terms', () => {
    expect(isLikelyAccessory('iPhone 18 Pro Silicone Case', ['case', 'cover'])).toBe(true);
  });

  it('flags a title matching the default backstop list even with no exclude terms supplied', () => {
    expect(isLikelyAccessory('Tempered Glass Screen Protector for iPhone 18 Pro', [])).toBe(true);
  });

  it('matches multi-word default terms', () => {
    expect(isLikelyAccessory('iPhone 18 Pro Screen Protector 2-Pack', [])).toBe(true);
  });

  it('does not flag the real product', () => {
    expect(isLikelyAccessory('Apple iPhone 18 Pro 256GB', ['case', 'cover'])).toBe(false);
  });

  it('matches whole words only, not substrings inside unrelated words', () => {
    // "case" should not match inside "Showcase" — a single word that merely
    // contains those letters, not the word "case" itself.
    expect(isLikelyAccessory('Apple iPhone 18 Pro Retail Showcase Display', ['case'])).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isLikelyAccessory('iPhone 18 Pro CASE', ['case'])).toBe(true);
  });

  it('ignores blank exclude terms rather than matching everything', () => {
    expect(isLikelyAccessory('Apple iPhone 18 Pro', ['', '   '])).toBe(false);
  });
});
