import { describe, expect, it } from 'vitest';
import { parseAmountSpan } from '@/server/domain/parse-amount-span';

describe('parseAmountSpan', () => {
  it('parses a plain USD decimal amount', () => {
    expect(parseAmountSpan('$9.99', 'USD')).toBe(999);
    expect(parseAmountSpan('$99.00', 'USD')).toBe(9900);
    expect(parseAmountSpan('$0.00', 'USD')).toBe(0);
  });

  it('parses US-style thousands-plus-decimal', () => {
    expect(parseAmountSpan('$1,200.00', 'USD')).toBe(120000);
  });

  it('parses a bare integer with no decimal shown, applying the implied .00', () => {
    expect(parseAmountSpan('Rs. 499', 'INR')).toBe(49900);
  });

  it('parses a zero-decimal currency amount with a thousands separator, without multiplying', () => {
    expect(parseAmountSpan('1,490円', 'JPY')).toBe(1490);
  });

  it('parses a zero-decimal currency amount with no separator', () => {
    expect(parseAmountSpan('500', 'KRW')).toBe(500);
  });

  it('parses European comma-as-decimal-separator notation', () => {
    expect(parseAmountSpan('8,99 EUR', 'EUR')).toBe(899);
  });

  it('is case-insensitive on the currency code', () => {
    expect(parseAmountSpan('1,490円', 'jpy')).toBe(1490);
  });

  it('returns null for null, undefined, or empty text or currency', () => {
    expect(parseAmountSpan(null, 'USD')).toBeNull();
    expect(parseAmountSpan(undefined, 'USD')).toBeNull();
    expect(parseAmountSpan('', 'USD')).toBeNull();
    expect(parseAmountSpan('$9.99', null)).toBeNull();
    expect(parseAmountSpan('$9.99', undefined)).toBeNull();
  });

  it('returns null for text with no recognizable number', () => {
    expect(parseAmountSpan('free', 'USD')).toBeNull();
    expect(parseAmountSpan('no charge', 'USD')).toBeNull();
  });

  it('handles a bare negative amount with no currency symbol between the sign and the digits', () => {
    expect(parseAmountSpan('-12.99', 'USD')).toBe(-1299);
  });

  it('parses a three-decimal currency amount (KWD, BHD, JOD, OMR, etc.)', () => {
    expect(parseAmountSpan('12.345 KWD', 'KWD')).toBe(12345);
    expect(parseAmountSpan('OMR 0.500', 'OMR')).toBe(500);
  });

  it('parses a bare integer three-decimal currency amount, applying the implied .000', () => {
    expect(parseAmountSpan('KWD 5', 'KWD')).toBe(5000);
  });

  it('parses a three-decimal currency amount with a thousands separator', () => {
    expect(parseAmountSpan('1,234.567 KWD', 'KWD')).toBe(1234567);
  });

  it('is case-insensitive on a three-decimal currency code', () => {
    expect(parseAmountSpan('12.345 KWD', 'kwd')).toBe(12345);
  });
});
