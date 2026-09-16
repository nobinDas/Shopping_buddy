import type {
  subscriptions,
  priceHistory,
  emailAccounts,
  insurancePolicies,
  shoppingLists,
  shoppingListItems,
  itemPriceHistory,
  preferredStores,
  watchlistItems,
  watchlistPriceHistory,
  detectedSignals,
  reconciliationProposals,
} from '@/server/db/schema';

type NewSubscription = typeof subscriptions.$inferInsert;
type NewPriceHistory = typeof priceHistory.$inferInsert;
type NewEmailAccount = typeof emailAccounts.$inferInsert;
type NewPolicy = typeof insurancePolicies.$inferInsert;
type NewShoppingList = typeof shoppingLists.$inferInsert;
type NewShoppingItem = typeof shoppingListItems.$inferInsert;
type NewItemPriceHistory = typeof itemPriceHistory.$inferInsert;
type NewPreferredStore = typeof preferredStores.$inferInsert;
type NewWatchlistItem = typeof watchlistItems.$inferInsert;
type NewWatchlistPriceHistory = typeof watchlistPriceHistory.$inferInsert;
type NewDetectedSignal = typeof detectedSignals.$inferInsert;
type NewReconciliationProposal = typeof reconciliationProposals.$inferInsert;

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

/** Builds a valid `shopping_lists` insert row. */
export function buildShoppingList(overrides: Partial<NewShoppingList> = {}): NewShoppingList {
  return {
    name: 'Test List',
    ...overrides,
  };
}

/**
 * Builds a valid `shopping_list_items` insert row. `listId` has no
 * default — every caller has a real list id to attach it to.
 */
export function buildShoppingItem(
  listId: string,
  overrides: Partial<NewShoppingItem> = {},
): NewShoppingItem {
  return {
    listId,
    name: 'Test Item',
    quantity: 1,
    ...overrides,
  };
}

/** Builds a valid `item_price_history` insert row. */
export function buildItemPriceHistory(
  itemId: string,
  overrides: Partial<NewItemPriceHistory> = {},
): NewItemPriceHistory {
  return {
    itemId,
    unitPriceMinor: 199,
    currency: 'USD',
    source: 'manual',
    ...overrides,
  };
}

/** Builds a valid `preferred_stores` insert row. */
export function buildPreferredStore(overrides: Partial<NewPreferredStore> = {}): NewPreferredStore {
  return {
    name: 'Test Store',
    address: '123 Test St, Testville, TS 00000',
    ...overrides,
  };
}

/** Builds a valid `watchlist_items` insert row. */
export function buildWatchlistItem(overrides: Partial<NewWatchlistItem> = {}): NewWatchlistItem {
  return {
    name: 'Test Watchlist Item',
    category: 'electronics',
    trackedSellers: ['Best Buy'],
    resolvedProductId: 'test-product-id',
    resolvedPageToken: 'test-page-token',
    resolvedTitle: 'Test Watchlist Item',
    ...overrides,
  };
}

/**
 * Builds a valid `watchlist_price_history` insert row. `itemId` has no
 * default — every caller has a real watchlist item id to attach it to.
 */
export function buildWatchlistPriceHistory(
  itemId: string,
  overrides: Partial<NewWatchlistPriceHistory> = {},
): NewWatchlistPriceHistory {
  return {
    itemId,
    unitPriceMinor: 9900,
    currency: 'USD',
    ...overrides,
  };
}

/**
 * Builds a valid `detected_signals` insert row. `accountId` has no
 * default — every caller has a real email account id to attach it to.
 * `confidence` is a numeric column (string mode in Drizzle), hence the
 * string default here rather than a plain number.
 */
export function buildDetectedSignal(
  accountId: string,
  overrides: Partial<NewDetectedSignal> = {},
): NewDetectedSignal {
  return {
    accountId,
    messageId: 'test-message-id',
    contentHash: 'test-content-hash',
    signalType: 'renewal',
    vendorKey: 'test vendor',
    confidence: '0.90',
    ...overrides,
  };
}

/**
 * Builds a valid `reconciliation_proposals` insert row. `signalId` has no
 * default — every caller has a real detected_signals id to attach it to.
 */
export function buildReconciliationProposal(
  signalId: string,
  overrides: Partial<NewReconciliationProposal> = {},
): NewReconciliationProposal {
  return {
    signalId,
    proposalType: 'discovery',
    proposedChanges: {},
    reasoning: 'Test reasoning',
    ...overrides,
  };
}
