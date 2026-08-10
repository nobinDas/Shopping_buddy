import { describe, expect, it } from 'vitest';
import { addMoney } from '@/lib/money';

describe('addMoney', () => {
  it('adds two amounts in the same currency', () => {
    const a = { amountMinor: 1299, currency: 'USD' };
    const b = { amountMinor: 501, currency: 'USD' };

    const result = addMoney(a, b);

    expect(result).toEqual({ amountMinor: 1800, currency: 'USD' });
  });

  it('throws rather than silently mixing currencies', () => {
    const usd = { amountMinor: 1299, currency: 'USD' };
    const eur = { amountMinor: 501, currency: 'EUR' };

    expect(() => addMoney(usd, eur)).toThrow('Cannot add different currencies: USD and EUR');
  });
});
