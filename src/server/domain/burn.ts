import { addMoney, type Money } from '@/lib/money';
import type { BillingCycle } from './billing-cycle';

/**
 * The subset of a subscription's fields the burn calculation actually
 * needs — not imported from db/schema.ts, since domain/ stays independent
 * of db/ (see docs/ARCHITECTURE.md). This function has no opinion on
 * `status`: callers decide which subscriptions belong in the total (e.g.
 * filtering to `active`) before calling it.
 */
export interface BurnSubscription {
  amountMinor: number;
  currency: string;
  cycle: BillingCycle;
  /** Required, and only meaningful, when cycle === 'custom'. */
  cycleDays?: number | null;
}

// Average calendar month length (365.25 / 12), not a flat 30. A flat-30
// convention would under-normalize a genuinely annual custom cycle (e.g.
// cycleDays = 365) to slightly more than one twelfth of the true annual
// cost, and the error compounds the longer the interval runs. 365.25
// accounts for leap years over a long horizon.
const AVERAGE_DAYS_PER_MONTH = 365.25 / 12;

const CYCLE_MONTHS: Record<Exclude<BillingCycle, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/**
 * Converts one subscription's amount to its monthly-equivalent, rounding to
 * the nearest integer minor unit immediately. Per docs/TESTING.md, rounding
 * happens at every cycle conversion rather than being deferred to a single
 * final total — every intermediate value stays an integer; no float ever
 * appears, even transiently.
 */
function monthlyEquivalent(sub: BurnSubscription): Money {
  if (sub.cycle === 'custom') {
    if (!sub.cycleDays || sub.cycleDays <= 0) {
      throw new Error("burn: cycleDays must be a positive integer when cycle is 'custom'");
    }
    const perDay = sub.amountMinor / sub.cycleDays;
    return {
      amountMinor: Math.round(perDay * AVERAGE_DAYS_PER_MONTH),
      currency: sub.currency,
    };
  }

  if (sub.cycleDays != null) {
    throw new Error(`burn: cycleDays must not be set when cycle is '${sub.cycle}'`);
  }

  return {
    amountMinor: Math.round(sub.amountMinor / CYCLE_MONTHS[sub.cycle]),
    currency: sub.currency,
  };
}

/**
 * Normalizes every subscription to a monthly-equivalent amount and sums
 * per currency. Never blends currencies into one number: subscriptions are
 * bucketed by currency first, and each bucket is summed with `addMoney`,
 * which throws if currencies are ever mixed — the same rule this function
 * is built to respect, not a separate one.
 *
 * Returns one `Money` entry per distinct currency present in the input, in
 * the order each currency first appears. An empty input returns an empty
 * array rather than a zero — there is no currency to attach a zero to.
 */
export function calculateMonthlyBurn(subscriptions: BurnSubscription[]): Money[] {
  const totals = new Map<string, Money>();

  for (const sub of subscriptions) {
    const equivalent = monthlyEquivalent(sub);
    const running = totals.get(equivalent.currency);
    totals.set(equivalent.currency, running ? addMoney(running, equivalent) : equivalent);
  }

  return [...totals.values()];
}
