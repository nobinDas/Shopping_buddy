import { describe, expect, it } from 'vitest';
import { subscriptionInputSchema } from '@/lib/validation/subscription';

const validInput = {
  name: 'Netflix',
  amountMinor: 1599,
  currency: 'usd',
  cycle: 'monthly',
  anchorDate: '2026-03-01',
  category: 'media',
};

describe('subscriptionInputSchema', () => {
  it('accepts a valid monthly subscription', () => {
    const result = subscriptionInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it('uppercases the currency code', () => {
    const result = subscriptionInputSchema.parse(validInput);

    expect(result.currency).toBe('USD');
  });

  it('rejects a blank name', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, name: '  ' });

    expect(result.success).toBe(false);
  });

  it('rejects a zero amount', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, amountMinor: 0 });

    expect(result.success).toBe(false);
  });

  it('rejects a negative amount', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, amountMinor: -500 });

    expect(result.success).toBe(false);
  });

  it('rejects a currency code that is not 3 letters', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, currency: 'US' });

    expect(result.success).toBe(false);
  });

  it('rejects an anchor date not in YYYY-MM-DD form', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, anchorDate: '03/01/2026' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown cycle value', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, cycle: 'weekly' });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown category value', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, category: 'travel' });

    expect(result.success).toBe(false);
  });

  it('accepts a custom cycle with a positive cycleDays', () => {
    const result = subscriptionInputSchema.safeParse({
      ...validInput,
      cycle: 'custom',
      cycleDays: 45,
    });

    expect(result.success).toBe(true);
  });

  it('rejects a custom cycle with no cycleDays', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, cycle: 'custom' });

    expect(result.success).toBe(false);
  });

  it('rejects a custom cycle with a zero cycleDays', () => {
    const result = subscriptionInputSchema.safeParse({
      ...validInput,
      cycle: 'custom',
      cycleDays: 0,
    });

    expect(result.success).toBe(false);
  });

  it('rejects cycleDays set on a non-custom cycle', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, cycleDays: 30 });

    expect(result.success).toBe(false);
  });

  it('accepts an absent notes field', () => {
    const result = subscriptionInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
  });

  it('rejects a blank notes string', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, notes: '   ' });

    expect(result.success).toBe(false);
  });

  it('accepts a null notes value', () => {
    const result = subscriptionInputSchema.safeParse({ ...validInput, notes: null });

    expect(result.success).toBe(true);
  });
});
