import type {
  subscriptions,
  priceHistory,
  emailAccounts,
  insurancePolicies,
} from '@/server/db/schema';

type NewSubscription = typeof subscriptions.$inferInsert;
type NewPriceHistory = typeof priceHistory.$inferInsert;
type NewEmailAccount = typeof emailAccounts.$inferInsert;
type NewPolicy = typeof insurancePolicies.$inferInsert;

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

/**
 * Builds a valid `email_accounts` insert row. The token fields take real
 * `Buffer`s (not real ciphertext) since the column type is `bytea` — tests
 * that need actual encrypted values should run them through
 * providers/crypto.ts's encryptToken themselves.
 */
export function buildEmailAccount(overrides: Partial<NewEmailAccount> = {}): NewEmailAccount {
  return {
    provider: 'google',
    emailAddress: 'test@example.com',
    accessTokenEnc: Buffer.from('test-access-token-ciphertext'),
    refreshTokenEnc: Buffer.from('test-refresh-token-ciphertext'),
    tokenExpiresAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Builds a valid `insurance_policies` insert row. Reuses cycleEnum, same
 * as subscriptions — see docs/DECISIONS.md's Phase 2 ADR.
 */
export function buildPolicy(overrides: Partial<NewPolicy> = {}): NewPolicy {
  return {
    type: 'auto',
    insurer: 'Test Insurer',
    policyNumber: 'TEST-0001',
    premiumMinor: 60000,
    currency: 'USD',
    cycle: 'semiannual',
    anchorDate: '2026-01-01',
    nextBillingDate: '2026-07-01',
    reminderLeadDays: 30,
    ...overrides,
  };
}
