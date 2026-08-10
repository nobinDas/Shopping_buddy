import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';

/**
 * Phase 0 plumbing only. Proves the Supabase → Drizzle → migration pipeline
 * works end to end. Replaced by the real `subscriptions` schema in Phase 1a
 * — see docs/DATA_MODEL.md and docs/PHASES.md.
 */
export const phase0Healthcheck = pgTable('phase0_healthcheck', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
});
