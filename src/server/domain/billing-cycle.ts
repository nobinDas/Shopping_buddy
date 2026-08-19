import { addDays, addMonths, compareAsc, format, parseISO } from 'date-fns';

/**
 * Deliberately not imported from db/schema.ts — domain/ imports nothing from
 * db/, services/, or providers/ (see docs/ARCHITECTURE.md). This union is
 * kept in sync with the `cycle` pgEnum by hand; a mismatch would fail to
 * compile at the call site, since both are literal string unions.
 */
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

/**
 * `date` columns (anchor_date, next_billing_date) are plain 'yyyy-MM-dd'
 * strings on the wire — schema.ts uses Drizzle's default string mode for
 * `date()`, not `{ mode: 'date' }`. This type alias exists so the domain
 * layer's contract with the DB layer is explicit rather than implied.
 */
export type IsoDateString = string;

export interface NextBillingDateInput {
  /** The billing date all future dates derive from. Never itself recomputed. */
  anchorDate: IsoDateString;
  cycle: BillingCycle;
  /** Required, and only meaningful, when cycle === 'custom'. */
  cycleDays?: number | null;
  /** The reference "today". Passed in rather than read from the system
   * clock — required for this function to stay pure and deterministically
   * testable (see docs/TESTING.md: "Fixed clock in every date-sensitive
   * test. Never `new Date()` in a test.", which extends to the code under
   * test as well as the test itself). */
  asOf: IsoDateString;
}

const CYCLE_MONTHS: Record<Exclude<BillingCycle, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

// Guards a misconfigured cycle (e.g. cycleDays negative, or anchorDate far in
// the past with a slow cycle) from looping forever. 10,000 cycles is far
// beyond anything a real subscription will ever accumulate.
const MAX_ITERATIONS = 10_000;

function assertValidCycleDays(cycle: BillingCycle, cycleDays: number | null | undefined): void {
  if (cycle === 'custom') {
    if (!cycleDays || cycleDays <= 0) {
      throw new Error("billing-cycle: cycleDays must be a positive integer when cycle is 'custom'");
    }
    return;
  }

  if (cycleDays != null) {
    throw new Error(`billing-cycle: cycleDays must not be set when cycle is '${cycle}'`);
  }
}

/**
 * Computes the nth occurrence of the billing schedule, always measured from
 * the original anchor rather than chained from the previous occurrence.
 *
 * This is what makes month-end rollover correct rather than a one-way drift:
 * Jan 31 anchored monthly gives Feb 28 (or 29) for n=1, because February has
 * no 31st — date-fns' addMonths clamps to the month's last day. But n=2 is
 * computed as Jan 31 + 2 months = Mar 31, not Feb 28 + 1 month = Mar 28. The
 * 31st comes back in every month that has one. Chaining from the previous
 * result would instead permanently collapse the schedule onto the 28th.
 * The same logic is what makes an annual cycle anchored on Feb 29 correct:
 * addMonths(anchor, 12 * n) clamps to Feb 28 in non-leap years and lands
 * back on Feb 29 whenever the target year is itself a leap year.
 */
function occurrence(
  anchorDate: Date,
  cycle: BillingCycle,
  cycleDays: number | null | undefined,
  n: number,
): Date {
  if (cycle === 'custom') {
    if (cycleDays == null) {
      // Unreachable in practice — assertValidCycleDays already ran before
      // this is called — but narrows the type without an assertion.
      throw new Error("billing-cycle: cycleDays must be a positive integer when cycle is 'custom'");
    }
    return addDays(anchorDate, n * cycleDays);
  }

  return addMonths(anchorDate, n * CYCLE_MONTHS[cycle]);
}

/**
 * Returns the next billing date on the recurring schedule anchored at
 * `anchorDate`, on or after `asOf`.
 *
 * Pure and synchronous: same inputs always produce the same output, no I/O,
 * no implicit clock read. Callers (the service layer) decide what "today"
 * means for a given recomputation — e.g. the day after a confirmed charge,
 * or the actual current date for a dashboard render.
 */
export function computeNextBillingDate({
  anchorDate,
  cycle,
  cycleDays,
  asOf,
}: NextBillingDateInput): IsoDateString {
  assertValidCycleDays(cycle, cycleDays);

  const anchor = parseISO(anchorDate);
  const reference = parseISO(asOf);

  // Schedule hasn't started yet, or bills today — nothing has occurred yet
  // to advance past.
  if (compareAsc(anchor, reference) >= 0) {
    return format(anchor, 'yyyy-MM-dd');
  }

  for (let n = 1; n <= MAX_ITERATIONS; n++) {
    const candidate = occurrence(anchor, cycle, cycleDays, n);
    if (compareAsc(candidate, reference) >= 0) {
      return format(candidate, 'yyyy-MM-dd');
    }
  }

  throw new Error(
    'billing-cycle: exceeded max iterations searching for the next billing date — check cycle/cycleDays configuration',
  );
}
