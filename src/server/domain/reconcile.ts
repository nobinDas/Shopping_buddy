import { differenceInCalendarDays, parseISO } from 'date-fns';
import { levenshteinSimilarity } from './levenshtein';

/**
 * Phase 1e's reconciliation algorithm — docs/DATA_MODEL.md's
 * "Reconciliation" section is the spec; if this file and that doc ever
 * disagree, the doc is the spec and this file is the bug. Pure, no I/O:
 * `services/reconciliation.service.ts` does the DB reads/writes and
 * calls in here per signal.
 *
 * Scope: only the signal types docs/DATA_MODEL.md's Step 3 table
 * actually classifies (`new`, `renewal`, `price_change`,
 * `trial_conversion`, `cancellation`). `payment_failed`/`paused`
 * (ADR-019, added after DATA_MODEL.md's reconciliation section was
 * written) already always get a review brief and surface on /review
 * through that separate ADR-018 path regardless of extraction
 * completeness — see docs/DECISIONS.md ADR-020. Giving them a
 * subscription-mutating outcome here as well isn't part of either ADR's
 * scope and isn't specified by docs/DATA_MODEL.md, so `reconcileSignal`
 * only accepts the five original signal types; a caller passing one of
 * the other two is a caller bug, not a case this function has an answer
 * for — see `services/reconciliation.service.ts` for where that's
 * actually filtered out.
 */

const CONFIDENT_MATCH_THRESHOLD = 0.7;
const AMBIGUOUS_MATCH_THRESHOLD = 0.4;
const AMOUNT_TOLERANCE_RATIO = 0.01;
const BILLING_DATE_TOLERANCE_DAYS = 3;
const FUZZY_VENDOR_SIMILARITY_THRESHOLD = 0.85;

export const RECONCILABLE_SIGNAL_TYPES = [
  'new',
  'renewal',
  'price_change',
  'trial_conversion',
  'cancellation',
] as const;

export type ReconcilableSignalType = (typeof RECONCILABLE_SIGNAL_TYPES)[number];

export function isReconcilableSignalType(signalType: string): signalType is ReconcilableSignalType {
  return (RECONCILABLE_SIGNAL_TYPES as readonly string[]).includes(signalType);
}

export interface SignalForMatching {
  signalType: ReconcilableSignalType;
  vendorKey: string;
  amountMinor: number | null;
  currency: string | null;
  billingDate: string | null; // ISO 'yyyy-MM-dd', nullable
}

export interface CandidateSubscription {
  id: string;
  name: string;
  vendorKey: string;
  amountMinor: number;
  currency: string;
  // The comparison point for "billing date within ±3 days of expected"
  // — approximated as the subscription's stored nextBillingDate rather
  // than the occurrence nearest the signal's own date. A documented
  // simplification, not an oversight: docs/DATA_MODEL.md itself calls
  // the weights "a starting point... tune against the golden-file
  // corpus," and nextBillingDate is the one date every subscription
  // already has on hand without computing a whole occurrence window for
  // an arbitrary past date.
  nextBillingDate: string;
}

export interface ScoredCandidate {
  subscription: CandidateSubscription;
  score: number;
}

/**
 * Step 2's per-candidate score. Currency is a hard gate, not a weighted
 * test — docs/DATA_MODEL.md lists it as "required — no cross-currency
 * match," not a number of points, so a currency mismatch disqualifies
 * the candidate outright regardless of how well anything else matches
 * (see docs/DATA_MODEL.md's "Currency change on the same subscription"
 * test case: a real currency change is deliberately *not* auto-matched
 * here — it surfaces as a discovery for the user to reconcile by hand,
 * rather than this function silently treating a currency swap as a
 * same-subscription price update). A null signal currency (not every
 * signal carries one) skips the gate rather than failing it — there's
 * nothing to compare.
 */
export function scoreCandidate(
  signal: SignalForMatching,
  subscription: CandidateSubscription,
): number {
  if (signal.currency && signal.currency !== subscription.currency) {
    return 0;
  }

  let score = 0;

  if (signal.vendorKey === subscription.vendorKey) {
    score += 0.5;
  } else if (
    levenshteinSimilarity(signal.vendorKey, subscription.vendorKey) >=
    FUZZY_VENDOR_SIMILARITY_THRESHOLD
  ) {
    score += 0.3;
  }

  if (signal.amountMinor != null && amountsAgree(signal.amountMinor, subscription.amountMinor)) {
    score += 0.3;
  }

  if (signal.billingDate && datesAgree(signal.billingDate, subscription.nextBillingDate)) {
    score += 0.2;
  }

  return score;
}

function amountsAgree(signalAmountMinor: number, subscriptionAmountMinor: number): boolean {
  if (subscriptionAmountMinor === 0) {
    return signalAmountMinor === 0;
  }
  return (
    Math.abs(signalAmountMinor - subscriptionAmountMinor) / subscriptionAmountMinor <=
    AMOUNT_TOLERANCE_RATIO
  );
}

function datesAgree(signalDate: string, subscriptionDate: string): boolean {
  return (
    Math.abs(differenceInCalendarDays(parseISO(signalDate), parseISO(subscriptionDate))) <=
    BILLING_DATE_TOLERANCE_DAYS
  );
}

/** Every candidate with a non-zero score, highest first (ties: input order). */
export function findCandidates(
  signal: SignalForMatching,
  subscriptions: CandidateSubscription[],
): ScoredCandidate[] {
  return subscriptions
    .map((subscription) => ({ subscription, score: scoreCandidate(signal, subscription) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}

export type ReconciliationOutcome =
  | { type: 'confirm'; subscriptionId: string; reasoning: string }
  | {
      type: 'price_update';
      subscriptionId: string;
      reasoning: string;
      proposedChanges: { amountMinor: number; currency: string };
    }
  | {
      type: 'date_update';
      subscriptionId: string;
      reasoning: string;
      proposedChanges: { billingDate: string };
    }
  | { type: 'cancellation'; subscriptionId: string; reasoning: string }
  | {
      type: 'discovery';
      subscriptionId: null;
      reasoning: string;
      proposedChanges: { vendorKey: string; amountMinor: number | null; currency: string | null };
    };

function discoveryOutcome(signal: SignalForMatching, reasoning: string): ReconciliationOutcome {
  return {
    type: 'discovery',
    subscriptionId: null,
    reasoning,
    proposedChanges: {
      vendorKey: signal.vendorKey,
      amountMinor: signal.amountMinor,
      currency: signal.currency,
    },
  };
}

/**
 * Step 2 (candidate matching) + Step 3 (classify the outcome), per
 * docs/DATA_MODEL.md. One signal in, one outcome out — the caller
 * decides what to do with it (auto-apply `confirm`, write a pending
 * `reconciliation_proposals` row for everything else).
 */
export function reconcileSignal(
  signal: SignalForMatching,
  subscriptions: CandidateSubscription[],
): ReconciliationOutcome {
  const candidates = findCandidates(signal, subscriptions);
  const best = candidates[0];

  if (!best || best.score < AMBIGUOUS_MATCH_THRESHOLD) {
    return discoveryOutcome(
      signal,
      `No recorded subscription scored ${AMBIGUOUS_MATCH_THRESHOLD.toString()} or above against this signal (best candidate: ${
        best ? `${best.subscription.name} at ${best.score.toFixed(2)}` : 'none'
      }) — treated as a subscription with no manual record.`,
    );
  }

  if (best.score < CONFIDENT_MATCH_THRESHOLD) {
    // Ambiguous (0.4–0.7): docs/DATA_MODEL.md says "surface to the user
    // with both candidates." There's no dedicated proposal_type for
    // this — see docs/DECISIONS.md ADR-020 — so it's surfaced as a
    // discovery (the safest default: it proposes nothing about an
    // existing record) whose reasoning names every candidate the user
    // may actually want to reconcile against by hand instead of adding
    // a new subscription.
    const named = candidates
      .slice(0, 3)
      .map((c) => `${c.subscription.name} (score ${c.score.toFixed(2)})`)
      .join(', ');
    return discoveryOutcome(
      signal,
      `Possible match, but not confident enough to auto-match: ${named}. None scored ${CONFIDENT_MATCH_THRESHOLD.toString()} or above, so this is surfaced as a discovery rather than silently attached — check whether it's actually one of these before adding it as new.`,
    );
  }

  const subscription = best.subscription;

  if (signal.signalType === 'cancellation') {
    return {
      type: 'cancellation',
      subscriptionId: subscription.id,
      reasoning: `Matched "${subscription.name}" at ${best.score.toFixed(2)} and the signal is a cancellation notice.`,
    };
  }

  // Narrowed inline (rather than through an intermediate boolean) so
  // `signal.amountMinor`/`signal.billingDate` are provably non-null in
  // each branch below, with no assertion needed to use them.
  if (
    signal.amountMinor != null &&
    !amountsAgree(signal.amountMinor, subscription.amountMinor)
  ) {
    return {
      type: 'price_update',
      subscriptionId: subscription.id,
      reasoning: `Matched "${subscription.name}" at ${best.score.toFixed(2)}. Detected amount ${signal.amountMinor.toString()} differs from the recorded ${subscription.amountMinor.toString()}, beyond the ${(AMOUNT_TOLERANCE_RATIO * 100).toString()}% match tolerance.`,
      proposedChanges: {
        amountMinor: signal.amountMinor,
        currency: signal.currency ?? subscription.currency,
      },
    };
  }

  if (signal.billingDate != null && !datesAgree(signal.billingDate, subscription.nextBillingDate)) {
    return {
      type: 'date_update',
      subscriptionId: subscription.id,
      reasoning: `Matched "${subscription.name}" at ${best.score.toFixed(2)}. Detected billing date ${signal.billingDate} is more than ${BILLING_DATE_TOLERANCE_DAYS.toString()} days from the recorded next billing date ${subscription.nextBillingDate}.`,
      proposedChanges: { billingDate: signal.billingDate },
    };
  }

  return {
    type: 'confirm',
    subscriptionId: subscription.id,
    reasoning: `Matched "${subscription.name}" at ${best.score.toFixed(2)}. Amount and billing date both agree within tolerance.`,
  };
}
