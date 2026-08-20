import type { subscriptions } from '@/server/db/schema';

type NewSubscription = typeof subscriptions.$inferInsert;

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