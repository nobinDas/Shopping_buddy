import { describe, expect, it } from 'vitest';
import { parseClassificationResponse } from '@/server/providers/gemini';

describe('parseClassificationResponse', () => {
  it('extracts a valid relevant classification', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      amountMinor: 1549,
      currency: 'USD',
      billingDate: '2026-09-01',
      confidence: 0.92,
    });

    expect(result).toEqual({
      signalType: 'renewal',
      vendorName: 'Netflix',
      amountMinor: 1549,
      currency: 'USD',
      billingDate: '2026-09-01',
      confidence: 0.92,
    });
  });

  it('returns null for a "not relevant" classification, even with other fields present', () => {
    const result = parseClassificationResponse({
      relevant: false,
      signalType: null,
      vendorName: null,
      amountMinor: null,
      currency: null,
      billingDate: null,
      confidence: 0.1,
    });
    expect(result).toBeNull();
  });

  it('returns null when relevant but missing a signal type', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: null,
      vendorName: 'Netflix',
      confidence: 0.5,
    });
    expect(result).toBeNull();
  });

  it('returns null when relevant but missing a vendor name', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: null,
      confidence: 0.5,
    });
    expect(result).toBeNull();
  });

  it('returns null when confidence is out of the 0-1 range', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      confidence: 1.5,
    });
    expect(result).toBeNull();
  });

  it('returns null when signalType is not one of the known enum values', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'refund',
      vendorName: 'Netflix',
      confidence: 0.5,
    });
    expect(result).toBeNull();
  });

  it('returns null for completely malformed input', () => {
    expect(parseClassificationResponse({})).toBeNull();
    expect(parseClassificationResponse(null)).toBeNull();
    expect(parseClassificationResponse('not an object')).toBeNull();
  });

  it('defaults optional nullable fields to null when omitted entirely', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'cancellation',
      vendorName: 'Spotify',
      confidence: 0.8,
    });
    expect(result).toEqual({
      signalType: 'cancellation',
      vendorName: 'Spotify',
      amountMinor: null,
      currency: null,
      billingDate: null,
      confidence: 0.8,
    });
  });
});
