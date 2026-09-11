import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  char,
  date,
  timestamp,
  index,
  uniqueIndex,
  boolean,
  jsonb,
  customType,
} from 'drizzle-orm/pg-core';

// Drizzle's pg-core has no built-in `bytea` column (unlike e.g. `jsonb`),
// so it's defined here as a custom type. The `postgres` driver this app
// uses already parses `bytea` to/from a Node `Buffer` at the wire level,
// so no toDriver/fromDriver mapping is needed — see
// src/server/providers/crypto.ts, whose encrypt/decrypt functions this
// column type exists to store the output of.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Phase 0 plumbing only. Proves the Supabase → Drizzle → migration pipeline
 * works end to end. Still exercised by tests/integration/db.test.ts, so it
 * stays until that test is retargeted at a real table.
 */
export const phase0Healthcheck = pgTable('phase0_healthcheck', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// ── Enums ──────────────────────────────────────────────────────────────

export const cycleEnum = pgEnum('cycle', [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'custom',
]);

export const categoryEnum = pgEnum('category', [
  'software',
  'media',
  'insurance',
  'utility',
  'other',
]);

export const subscriptionSourceEnum = pgEnum('subscription_source', [
  'manual',
  'detected',
  'manual_confirmed',
]);

export const statusEnum = pgEnum('status', ['active', 'paused', 'cancelled', 'archived']);

// price_history.source is a narrower vocabulary than subscriptions.source —
// a price entry is either typed in by hand or lifted from a detected signal.
// There's no `manual_confirmed` state for a single append-only price row; that
// state describes a subscription record, not a point-in-time price. See
// docs/DATA_MODEL.md.
export const priceHistorySourceEnum = pgEnum('price_history_source', ['manual', 'detected']);

// ── subscriptions ──────────────────────────────────────────────────────
// The canonical record. Manual entry is the primary, authoritative source —
// see docs/DECISIONS.md ADR-001. Nothing is written directly as `detected`
// without user acceptance through the review queue.

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    name: text('name').notNull(),
    vendorKey: text('vendor_key').notNull(),

    amountMinor: integer('amount_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    cycle: cycleEnum('cycle').notNull(),
    // Only meaningful when cycle = 'custom'. Enforced in
    // domain/billing-cycle.ts rather than a DB CHECK — see CLAUDE.md on
    // deferring nuanced logic to the app layer.
    cycleDays: integer('cycle_days'),

    anchorDate: date('anchor_date').notNull(),
    // Derived by domain/billing-cycle.ts — never hand-edited from the UI.
    nextBillingDate: date('next_billing_date').notNull(),

    category: categoryEnum('category').notNull(),
    source: subscriptionSourceEnum('source').notNull().default('manual'),
    status: statusEnum('status').notNull().default('active'),

    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('subscriptions_vendor_key_idx').on(table.vendorKey),
    index('subscriptions_status_idx').on(table.status),
    index('subscriptions_next_billing_date_idx').on(table.nextBillingDate),
  ],
).enableRLS();

// ── price_history ──────────────────────────────────────────────────────
// Append-only by convention: a subscription's price is never edited in
// place, only ever inserted as a new row. Application code must never issue
// an UPDATE against this table. See docs/DATA_MODEL.md.

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    subscriptionId: uuid('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),

    amountMinor: integer('amount_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    effectiveFrom: date('effective_from').notNull(),
    source: priceHistorySourceEnum('source').notNull(),

    // No FK reference: `signals` (detected_signals in DATA_MODEL.md) is a
    // Phase 1d table and doesn't exist yet. Left as a bare nullable uuid on
    // purpose — see CLAUDE.md: "Don't scaffold future-phase features."
    signalId: uuid('signal_id'),
  },
  (table) => [
    index('price_history_subscription_id_idx').on(table.subscriptionId),
    index('price_history_effective_from_idx').on(table.effectiveFrom),
  ],
).enableRLS();

// ── email_accounts ────────────────────────────────────────────────────
// Phase 1c. A connected inbox, read-only — see docs/SECURITY.md. Tokens
// are never stored plaintext: accessTokenEnc/refreshTokenEnc hold
// AES-256-GCM ciphertext produced by providers/crypto.ts, never a raw
// token. Schema matches docs/DATA_MODEL.md's `email_accounts` table.

export const emailProviderEnum = pgEnum('email_provider', ['google', 'microsoft']);

export const emailAccountStatusEnum = pgEnum('email_account_status', [
  'active',
  'needs_reauth',
  'disconnected',
]);

export const emailAccounts = pgTable(
  'email_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    provider: emailProviderEnum('provider').notNull(),
    emailAddress: text('email_address').notNull(),

    accessTokenEnc: bytea('access_token_enc').notNull(),
    refreshTokenEnc: bytea('refresh_token_enc').notNull(),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),

    // Provider history ID / delta token — Phase 1c's incremental sync
    // resumes from here rather than re-scanning the whole inbox. Null
    // until the first sync runs.
    syncCursor: text('sync_cursor'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

    status: emailAccountStatusEnum('status').notNull().default('active'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('email_accounts_status_idx').on(table.status)],
).enableRLS();

// ── detected_signals ────────────────────────────────────────────────
// Phase 1d. What extraction produced — never the email body. See
// docs/SECURITY.md: "Email bodies are never persisted. Extraction
// happens in memory; only the structured signal is stored." Reused by
// Phase 1e's (not yet built) reconciliation, which only ever reads
// `pending` signals — deduplication (this phase) already resolved
// cross-inbox duplicates by the time 1e runs.

export const signalTypeEnum = pgEnum('signal_type', [
  'new',
  'renewal',
  'price_change',
  'trial_conversion',
  'cancellation',
]);

export const signalStatusEnum = pgEnum('signal_status', [
  'pending',
  'matched',
  'merged_duplicate',
  'dismissed',
]);

export const detectedSignals = pgTable(
  'detected_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    accountId: uuid('account_id')
      .notNull()
      .references(() => emailAccounts.id, { onDelete: 'cascade' }),

    // Provider message ID — the unique index below is what makes a sync
    // retry safe (re-processing an already-seen message is a no-op via
    // onConflictDoNothing), see docs/DATA_MODEL.md.
    messageId: text('message_id').notNull(),
    // Sender + subject + extracted amount + extracted date, hashed
    // (domain/content-hash.ts) — the cross-inbox dedupe key. The same
    // receipt landing in two connected inboxes has two message IDs and
    // one contentHash.
    contentHash: text('content_hash').notNull(),

    signalType: signalTypeEnum('signal_type').notNull(),
    vendorKey: text('vendor_key').notNull(),

    // Nullable — not every signal carries a price (e.g. a cancellation
    // notice).
    amountMinor: integer('amount_minor'),
    currency: char('currency', { length: 3 }),
    billingDate: date('billing_date'),

    confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),

    status: signalStatusEnum('status').notNull().default('pending'),
    // Set on the losing row when domain/dedupe-signals.ts collapses
    // duplicates — points at the surviving signal.
    supersededBy: uuid('superseded_by'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('detected_signals_account_message_idx').on(table.accountId, table.messageId),
    index('detected_signals_status_idx').on(table.status),
    index('detected_signals_content_hash_idx').on(table.contentHash),
  ],
).enableRLS();

// ── insurance_policies ───────────────────────────────────────────────
// Phase 2. Proves the recurring-cost model generalises beyond
// subscriptions, literally: reuses cycleEnum and statusEnum rather than
// inventing a parallel termMonths/renewalDate concept, so a policy's
// next renewal and its contribution to the aggregate burn are computed
// by the exact same domain/billing-cycle.ts and domain/burn.ts functions
// subscriptions already use. See docs/DECISIONS.md if this needs
// revisiting later.

export const policyTypeEnum = pgEnum('policy_type', ['medical', 'auto']);

export const insurancePolicies = pgTable(
  'insurance_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    type: policyTypeEnum('type').notNull(),
    insurer: text('insurer').notNull(),
    policyNumber: text('policy_number').notNull(),

    premiumMinor: integer('premium_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    cycle: cycleEnum('cycle').notNull(),
    // Only meaningful when cycle = 'custom' — same convention as
    // subscriptions.cycleDays.
    cycleDays: integer('cycle_days'),

    // Last known renewal/start date — plays the same role as
    // subscriptions.anchorDate in computeNextBillingDate.
    anchorDate: date('anchor_date').notNull(),
    // Derived by domain/billing-cycle.ts — never hand-edited from the UI.
    nextBillingDate: date('next_billing_date').notNull(),

    reminderLeadDays: integer('reminder_lead_days').notNull().default(30),

    status: statusEnum('status').notNull().default('active'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('insurance_policies_status_idx').on(table.status),
    index('insurance_policies_next_billing_date_idx').on(table.nextBillingDate),
  ],
).enableRLS();

// ── shopping_lists / shopping_list_items / item_price_history ─────────
// Phase 3. The per-item Walmart price-check (providers/serpapi.ts) that
// once wrote item_price_history rows was retired in favor of a dedicated
// Watchlist feature in Phase 5 — see docs/DECISIONS.md. unitPriceMinor /
// currency / lastPriceCheckedAt and the historical item_price_history
// rows are kept as-is, unused by any code path now, rather than
// migrated or dropped.

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Set from /settings — a new item added to this list with no store
  // explicitly chosen falls back to this one. Free text, matching
  // shoppingListItems.store's own free-text convention (not a FK to
  // preferredStores). Null means "no default," not "no store" — an item
  // can still be created with no store when this is unset.
  defaultStore: text('default_store'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const shoppingListItems = pgTable(
  'shopping_list_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    quantity: integer('quantity').notNull().default(1),
    notes: text('notes'),
    // Free-text preference, independent of the Walmart price lookup — an
    // item can prefer a different store entirely and still have its
    // Walmart price checked for reference.
    store: text('store'),

    // Null until first checked — "not looked up yet," not zero. See
    // docs/DESIGN.md: "'$0.00' and '—' mean different things."
    unitPriceMinor: integer('unit_price_minor'),
    currency: char('currency', { length: 3 }),
    lastPriceCheckedAt: timestamp('last_price_checked_at', { withTimezone: true }),

    // Persisted, unlike the Phase 1.5 mock's ephemeral client-only
    // checked state — a real list should remember what's checked off
    // across a session, not reset on reload.
    checked: boolean('checked').notNull().default(false),
    // Set the moment `checked` flips true, cleared back to null if
    // unchecked — Phase 4 uses this (not updatedAt, which bumps on any
    // edit) to know precisely when to stop showing a bought item on
    // /shopping: visible through the rest of the day it was checked,
    // hidden after. See domain/shopping-visibility.ts.
    checkedAt: timestamp('checked_at', { withTimezone: true }),

    // Phase 4: optional per-item shopping deadline. Drives /trips'
    // urgency sort and overdue flag — there is no trip-level due date,
    // see docs/DECISIONS.md's Phase 4 ADR.
    dueAt: date('due_at'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('shopping_list_items_list_id_idx').on(table.listId)],
).enableRLS();

// Append-only, same convention as price_history — never UPDATEd, only
// inserted. Accumulates starting this phase; Phase 5 reads from it
// (docs/TOOLS.md: "Price history | Own Postgres tables | Accumulated
// from Phase 3").
export const itemPriceHistorySourceEnum = pgEnum('item_price_history_source', [
  'manual',
  'walmart',
]);

export const itemPriceHistory = pgTable(
  'item_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    itemId: uuid('item_id')
      .notNull()
      .references(() => shoppingListItems.id, { onDelete: 'cascade' }),

    unitPriceMinor: integer('unit_price_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    source: itemPriceHistorySourceEnum('source').notNull(),

    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('item_price_history_item_id_idx').on(table.itemId)],
).enableRLS();

// ── preferred_stores ────────────────────────────────────────────────
// The list offered when setting a shopping item's store preference —
// see docs/DECISIONS.md ADR-009's note that this fits Phase 3's scope.

export const preferredStores = pgTable(
  'preferred_stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    // Phase 4: plain free-text address (no Places Autocomplete — a
    // deliberate scope cut, see docs/DECISIONS.md). Required for a store
    // to be included in route planning.
    address: text('address').notNull(),
    // Resolved once, at add-time, via providers/google-maps.ts's
    // Places lookup keyed on name + address — null if no confident match
    // was found. Not re-resolved automatically; no refresh action this
    // phase.
    placeId: text('place_id'),
    // Human-readable weekly hours (Places' regularOpeningHours
    // .weekdayDescriptions), shown as-is in the UI.
    openingHoursText: text('opening_hours_text').array(),
    // Normalized `{ day: 0-6, opensAt: "HH:mm", closesAt: "HH:mm" }[]`,
    // first period per day only — used for /trips' open-now chip. A
    // split-schedule store (e.g. a lunch closure) only gets its first
    // period considered, a deliberate small cut.
    openingHoursPeriods: jsonb('opening_hours_periods'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('preferred_stores_name_idx').on(table.name)],
).enableRLS();

// ── user_settings ──────────────────────────────────────────────────────
// Phase 4. A single row (id is always the literal 'default') — one setting
// exists so far (the route-planning origin address), not a speculative
// key/value table for settings that don't exist yet.

export const userSettings = pgTable('user_settings', {
  id: text('id').primaryKey(),
  homeAddress: text('home_address'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}).enableRLS();

// ── watchlist_items / watchlist_price_history ──────────────────────────
// Phase 5, redesigned mid-planning — see docs/DECISIONS.md's ADR on
// retiring Phase 3's per-item Walmart price-check in favor of this
// standalone watchlist. Deliberately separate from shopping_list_items:
// these are long-term-tracked, big-ticket items, not short-lived grocery
// entries — no quantity, no store, no due date. Priced via Google
// Shopping (providers/google-shopping.ts), not Walmart-only.

export const watchlistItems = pgTable('watchlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),

  // Set true when a price check finds a lower price than the previously
  // cached one; cleared when /watchlist is opened
  // (services/watchlist.service.ts#markWatchlistSeen). Read by the nav
  // badges (BottomNav's More tab, and the Watchlist row inside /more) via
  // a single count query — cheaper than recomputing "did the last two
  // prices differ" on every page load.
  hasPriceDrop: boolean('has_price_drop').notNull().default(false),

  // Cached from the most recent price check, for fast list rendering —
  // same pattern shoppingListItems.unitPriceMinor already uses. Null
  // until first checked, not zero — see docs/DESIGN.md.
  latestPriceMinor: integer('latest_price_minor'),
  latestCurrency: char('latest_currency', { length: 3 }),
  latestSellerName: text('latest_seller_name'),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

// Append-only, same convention as price_history/item_price_history —
// never UPDATEd, only inserted.
export const watchlistPriceHistory = pgTable(
  'watchlist_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    itemId: uuid('item_id')
      .notNull()
      .references(() => watchlistItems.id, { onDelete: 'cascade' }),

    unitPriceMinor: integer('unit_price_minor').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    // Which seller Google Shopping attributed the lowest price to — shown
    // for context, not used in any logic.
    sellerName: text('seller_name'),
    productLink: text('product_link'),

    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('watchlist_price_history_item_id_idx').on(table.itemId)],
).enableRLS();
