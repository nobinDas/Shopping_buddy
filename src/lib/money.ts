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
