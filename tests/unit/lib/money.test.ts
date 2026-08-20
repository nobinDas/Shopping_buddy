import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney } from '@/lib/money';

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

describe('formatMoney', () => {
  it('formats a USD amount with two decimal places', () => {
    expect(formatMoney({ amountMinor: 1299, currency: 'USD' })).toBe('$12.99');
  });

  it('formats a zero amount as a real zero, not blank', () => {
    expect(formatMoney({ amountMinor: 0, currency: 'USD' })).toBe('$0.00');
  });

  it('formats a negative amount with a leading minus sign', () => {
    expect(formatMoney({ amountMinor: -500, currency: 'USD' })).toBe('-$5.00');
  });

  it('formats a non-USD currency with its own symbol', () => {
    expect(formatMoney({ amountMinor: 900, currency: 'EUR' })).toBe('€9.00');
  });
});