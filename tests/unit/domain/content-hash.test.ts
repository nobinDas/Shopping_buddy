import { describe, expect, it } from 'vitest';
import { computeContentHash } from '@/server/domain/content-hash';

const BASE = {
  sender: 'billing@netflix.com',
  subject: 'Your Netflix receipt',
  amountMinor: 1549,
  billingDate: '2026-09-01',
};

describe('computeContentHash', () => {
  it('is deterministic for identical inputs', () => {
    expect(computeContentHash(BASE)).toBe(computeContentHash({ ...BASE }));
  });

  it('is case-insensitive on sender and subject', () => {
    expect(computeContentHash(BASE)).toBe(
      computeContentHash({ ...BASE, sender: 'BILLING@NETFLIX.COM', subject: 'YOUR NETFLIX RECEIPT' }),
    );
  });

  it('changes when the amount differs', () => {
    expect(computeContentHash(BASE)).not.toBe(computeContentHash({ ...BASE, amountMinor: 999 }));
  });

  it('changes when the billing date differs', () => {
    expect(computeContentHash(BASE)).not.toBe(
      computeContentHash({ ...BASE, billingDate: '2026-10-01' }),
    );
  });

  it('changes when the sender differs', () => {
    expect(computeContentHash(BASE)).not.toBe(
      computeContentHash({ ...BASE, sender: 'billing@spotify.com' }),
    );
  });

  it('handles null amount and date distinctly from any real value', () => {
    const withNulls = computeContentHash({ ...BASE, amountMinor: null, billingDate: null });
    expect(withNulls).not.toBe(computeContentHash(BASE));
  });
});
