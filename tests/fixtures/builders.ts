import type { subscriptions, priceHistory } from '@/server/db/schema';

type NewSubscription = typeof subscriptions.$inferInsert;
type NewPriceHistory = typeof priceHistory.$inferInsert;

/**
 * Builds a valid `subscriptions` insert row with sensible defaults,
 * overridable per field. Exists so a schema change touches this one file
 * rather than every test that constructs a subscription — see
 * docs/TESTING.md, "Conventions."
 */
export function buildSubscription(overrides: Partial<NewSubscription> = {}): NewSubscription {
  return {
    name: 'Test Subscription',
    vendorKey: 'test-vendor',
    amountMinor: 999,
    currency: 'USD',
    cycle: 'monthly',
    anchorDate: '2026-01-01',
    nextBillingDate: '2026-02-01',
    category: 'software',
    ...overrides,
  };
}

/**
 * Builds a valid `price_history` insert row. `subscriptionId` has no
 * default — every caller has a real subscription id to attach it to.
 */
export function buildPriceHistory(
  subscriptionId: string,
  overrides: Partial<NewPriceHistory> = {},
): NewPriceHistory {
  return {
    subscriptionId,
    amountMinor: 999,
    currency: 'USD',
    effectiveFrom: '2026-01-01',
    source: 'manual',
    ...overrides,
  };
}