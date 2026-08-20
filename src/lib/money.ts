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