import { format, parseISO } from 'date-fns';

/**
 * Formats an ISO 'yyyy-MM-dd' date-only string for display: '2026-03-15' →
 * '15 Mar 2026'. Uses parseISO rather than `new Date(...)` for the same
 * reason src/server/domain/billing-cycle.ts does — the native constructor
 * reads a bare date string as UTC midnight, which can silently shift by a
 * day once read back through local-timezone getters.
 */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMM yyyy');
}