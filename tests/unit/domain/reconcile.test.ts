import { describe, expect, it } from 'vitest';
import {
  scoreCandidate,
  findCandidates,
  reconcileSignal,
  type SignalForMatching,
  type CandidateSubscription,
} from '@/server/domain/reconcile';

function signal(overrides: Partial<SignalForMatching> = {}): SignalForMatching {
  return {
    signalType: 'renewal',
    vendorKey: 'netflix',
    amountMinor: 1549,
    currency: 'USD',
    billingDate: '2026-09-05',
    ...overrides,
  };
}

function subscription(overrides: Partial<CandidateSubscription> = {}): CandidateSubscription {
  return {
    id: 'sub-1',
    name: 'Netflix',
    vendorKey: 'netflix',
    amountMinor: 1549,
    currency: 'USD',
    nextBillingDate: '2026-09-05',
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('scores a perfect match at 1.0', () => {
    expect(scoreCandidate(signal(), subscription())).toBeCloseTo(1.0, 5);
  });

  it('gives 0.5 for an exact vendor_key match alone', () => {
    const score = scoreCandidate(
      signal({ amountMinor: null, billingDate: null }),
      subscription(),
    );
    expect(score).toBeCloseTo(0.5, 5);
  });

  it('gives 0.3 for a fuzzy (not exact) vendor match', () => {
    // "netflex" is a single substitution from "netflix" — distance 1 over
    // length 7 = 0.857 similarity, just above the 0.85 fuzzy threshold.
    const score = scoreCandidate(
      signal({ vendorKey: 'netflex', amountMinor: null, billingDate: null }),
      subscription(),
    );
    expect(score).toBeCloseTo(0.3, 5);
  });

  it('gives no vendor credit below the fuzzy threshold', () => {
    const score = scoreCandidate(
      signal({ vendorKey: 'spotify', amountMinor: null, billingDate: null }),
      subscription(),
    );
    expect(score).toBe(0);
  });

  it('scores amount within 1% as agreeing', () => {
    const score = scoreCandidate(
      signal({ vendorKey: 'x', amountMinor: 1560, billingDate: null }), // 1560 vs 1549, ~0.7% off
      subscription({ vendorKey: 'y' }),
    );
    expect(score).toBeCloseTo(0.3, 5);
  });

  it('does not credit amount more than 1% off', () => {
    const score = scoreCandidate(
      signal({ vendorKey: 'x', amountMinor: 1700, billingDate: null }),
      subscription({ vendorKey: 'y' }),
    );
    expect(score).toBe(0);
  });

  it('credits a billing date within 3 days', () => {
    const score = scoreCandidate(
      signal({ vendorKey: 'x', amountMinor: null, billingDate: '2026-09-07' }),
      subscription({ vendorKey: 'y', nextBillingDate: '2026-09-05' }),
    );
    expect(score).toBeCloseTo(0.2, 5);
  });

  it('does not credit a billing date more than 3 days off', () => {
    const score = scoreCandidate(
      signal({ vendorKey: 'x', amountMinor: null, billingDate: '2026-09-20' }),
      subscription({ vendorKey: 'y', nextBillingDate: '2026-09-05' }),
    );
    expect(score).toBe(0);
  });

  it('disqualifies a candidate outright on a currency mismatch, regardless of other agreement', () => {
    const score = scoreCandidate(signal({ currency: 'EUR' }), subscription({ currency: 'USD' }));
    expect(score).toBe(0);
  });

  it('does not gate on currency when the signal has none extracted', () => {
    const score = scoreCandidate(signal({ currency: null, billingDate: null, amountMinor: null }), subscription());
    expect(score).toBeCloseTo(0.5, 5);
  });
});

describe('findCandidates', () => {
  it('sorts candidates highest score first and drops zero-scoring ones', () => {
    const s = signal();
    const candidates = findCandidates(s, [
      subscription({ id: 'low', vendorKey: 'unrelated-vendor', amountMinor: 1 }),
      subscription({ id: 'high' }),
      subscription({ id: 'zero', vendorKey: 'totally-different', currency: 'EUR' }),
    ]);

    expect(candidates.map((c) => c.subscription.id)).not.toContain('zero');
    expect(candidates[0]?.subscription.id).toBe('high');
  });
});

describe('reconcileSignal', () => {
  it('confirms when amount and date both agree above the confidence threshold', () => {
    const outcome = reconcileSignal(signal(), [subscription()]);
    expect(outcome.type).toBe('confirm');
    if (outcome.type === 'confirm') {
      expect(outcome.subscriptionId).toBe('sub-1');
      expect(outcome.reasoning).toContain('Netflix');
    }
  });

  it('proposes a price_update when the amount disagrees', () => {
    const outcome = reconcileSignal(signal({ amountMinor: 1799 }), [subscription()]);
    expect(outcome.type).toBe('price_update');
    if (outcome.type === 'price_update') {
      expect(outcome.proposedChanges.amountMinor).toBe(1799);
    }
  });

  it('proposes a date_update when only the date disagrees', () => {
    const outcome = reconcileSignal(signal({ billingDate: '2026-09-20' }), [subscription()]);
    expect(outcome.type).toBe('date_update');
    if (outcome.type === 'date_update') {
      expect(outcome.proposedChanges.billingDate).toBe('2026-09-20');
    }
  });

  it('proposes a cancellation when the signal is a cancellation notice', () => {
    // billingDate is always null for a real cancellation signal (ADR-019's
    // invariant) — vendor + amount agreement is what needs to carry the
    // score past the confident-match threshold here.
    const outcome = reconcileSignal(
      signal({ signalType: 'cancellation', amountMinor: 1549, billingDate: null }),
      [subscription()],
    );
    expect(outcome.type).toBe('cancellation');
  });

  it('proposes a discovery when no candidate reaches the ambiguous floor', () => {
    const outcome = reconcileSignal(signal({ vendorKey: 'apple.com/bill', amountMinor: 499, currency: 'USD', billingDate: null }), [
      subscription(),
    ]);
    expect(outcome.type).toBe('discovery');
    if (outcome.type === 'discovery') {
      expect(outcome.subscriptionId).toBeNull();
      expect(outcome.proposedChanges.amountMinor).toBe(499);
    }
  });

  it('proposes a discovery (not a silent match) when the best score is only ambiguous', () => {
    // vendor exact (0.5) + nothing else = 0.5, in the 0.4-0.7 ambiguous band
    const outcome = reconcileSignal(signal({ amountMinor: null, billingDate: null }), [
      subscription(),
    ]);
    expect(outcome.type).toBe('discovery');
    if (outcome.type === 'discovery') {
      expect(outcome.reasoning).toContain('Netflix');
    }
  });

  it('treats a free trial converting to paid as a price change from zero, not a new subscription', () => {
    const trialSub = subscription({ amountMinor: 0 });
    const outcome = reconcileSignal(
      signal({ signalType: 'trial_conversion', amountMinor: 999 }),
      [trialSub],
    );
    expect(outcome.type).toBe('price_update');
    if (outcome.type === 'price_update') {
      expect(outcome.subscriptionId).toBe('sub-1');
      expect(outcome.proposedChanges.amountMinor).toBe(999);
    }
  });

  it('disambiguates two tiers of the same vendor by amount (personal vs family plan)', () => {
    const personal = subscription({ id: 'personal', amountMinor: 999 });
    const family = subscription({ id: 'family', amountMinor: 1999 });
    const outcome = reconcileSignal(signal({ amountMinor: 1999 }), [personal, family]);
    expect(outcome.type).toBe('confirm');
    if (outcome.type === 'confirm') {
      expect(outcome.subscriptionId).toBe('family');
    }
  });

  it('does not auto-match a currency change on the same subscription — surfaces as discovery instead', () => {
    const outcome = reconcileSignal(signal({ currency: 'EUR', amountMinor: 1549 }), [
      subscription({ currency: 'USD' }),
    ]);
    expect(outcome.type).toBe('discovery');
  });

  it('does not match a third-party billing vendor string against the underlying service', () => {
    const outcome = reconcileSignal(
      signal({ vendorKey: 'applecombill', amountMinor: 499, billingDate: null }),
      [subscription({ vendorKey: 'netflix', amountMinor: 1549 })],
    );
    expect(outcome.type).toBe('discovery');
  });
});
