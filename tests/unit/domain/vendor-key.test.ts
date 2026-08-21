import { describe, expect, it } from 'vitest';
import { normalizeVendorKey } from '@/server/domain/vendor-key';

describe('normalizeVendorKey', () => {
  it('lowercases the name', () => {
    expect(normalizeVendorKey('Netflix')).toBe('netflix');
  });

  it('strips punctuation', () => {
    expect(normalizeVendorKey('Netflix, Inc.')).toBe('netflix inc');
  });

  it('strips diacritics', () => {
    expect(normalizeVendorKey('Café Deluxe')).toBe('cafe deluxe');
  });

  it('collapses repeated internal whitespace', () => {
    expect(normalizeVendorKey('Spotify   Premium')).toBe('spotify premium');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeVendorKey('  HBO Max  ')).toBe('hbo max');
  });

  it('produces the same key for two different-looking names of the same vendor', () => {
    expect(normalizeVendorKey('Amazon Prime')).toBe(normalizeVendorKey('AMAZON, PRIME!'));
  });
});
