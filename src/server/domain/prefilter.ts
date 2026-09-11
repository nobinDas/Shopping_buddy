/**
 * Cheap, deterministic filter run against message metadata only
 * (subject/from/snippet — never a full body fetch) before any LLM call.
 * Most mail is obviously irrelevant; filtering it here costs nothing and
 * is what makes "email content sent to the LLM is limited to
 * pre-filtered candidates" (docs/SECURITY.md) literally true, not just a
 * policy. See docs/TOOLS.md.
 *
 * Deliberately vendor-name-agnostic — no hardcoded vendor allowlist — so
 * it generalizes to any subscription vendor, not just the ones in the
 * golden-file test set.
 */

const SUBJECT_KEYWORDS = [
  'receipt',
  'subscription',
  'renew',
  'renewal',
  'billing',
  'invoice',
  'trial',
  'charged',
  'payment',
  'order confirmation',
  'your plan',
  'membership',
];

const SENDER_PATTERNS = [/noreply@/i, /no-reply@/i, /billing@/i, /receipts?@/i, /support@/i];

export interface PrefilterInput {
  subject: string;
  from: string;
  snippet: string;
}

export function looksLikelySubscription({ subject, from, snippet }: PrefilterInput): boolean {
  const haystack = `${subject} ${snippet}`.toLowerCase();
  const matchesKeyword = SUBJECT_KEYWORDS.some((keyword) => haystack.includes(keyword));
  const matchesSender = SENDER_PATTERNS.some((pattern) => pattern.test(from));
  return matchesKeyword || matchesSender;
}
