import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  char,
  date,
  timestamp,
  index,
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
