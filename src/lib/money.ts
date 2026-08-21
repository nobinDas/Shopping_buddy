export interface Money {
  amountMinor: number;
  currency: string;
}

/**
 * Adds two money values. Throws rather than silently mixing currencies —
 * see docs/CLAUDE.md: "Never do arithmetic across currencies without an
 * explicit conversion step."
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add different currencies: ${a.currency} and ${b.currency}`);
  }

  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

/**
 * Formats a Money value for display: { amountMinor: 1299, currency: 'USD' }
 * → "$12.99". Assumes a 2-decimal-digit currency, true for USD/EUR/GBP —
 * the currencies this app actually deals with so far. A zero-decimal
 * currency (JPY) would format wrong; revisit if one is ever tracked.
 */
export function formatMoney({ amountMinor, currency }: Money): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100);
}

/**
 * Parses a user-entered decimal amount ("15.99") into integer minor units
 * (1599) by string arithmetic, never float multiplication — see
 * docs/CLAUDE.md: "Never store money as a float." Returns `null` for
 * anything that isn't a non-negative amount with at most two decimal places,
 * so the caller can turn that into a field-level validation error.
 */
export function parseAmountToMinorUnits(input: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, whole, fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/**
 * The inverse, for prefilling an edit form's amount field: 1599 → "15.99".
 * Display only — the result is never fed back into arithmetic.
 */
export function minorUnitsToAmountString(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}