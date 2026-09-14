import { describe, expect, it } from 'vitest';
import { parseClassificationResponse, parseReviewBriefResponse } from '@/server/providers/anthropic';

describe('parseClassificationResponse', () => {
  it('extracts a valid relevant classification, parsing the verbatim date and amount spans', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      amountText: '$15.49',
      currency: 'USD',
      billingDateText: 'September 1, 2026',
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
      amountText: null,
      currency: null,
      billingDateText: null,
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

  it('resolves billingDate to null when billingDateText is present but unparseable, rather than failing the whole result', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      billingDateText: 'sometime soon-ish',
      confidence: 0.7,
    });
    expect(result?.billingDate).toBeNull();
    expect(result?.signalType).toBe('renewal');
  });

  it('parses a zero-decimal (JPY) amount span without multiplying by 100', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      amountText: '1,490円',
      currency: 'JPY',
      confidence: 0.9,
    });
    expect(result?.amountMinor).toBe(1490);
  });

  it('resolves amountMinor to null when amountText is present but unparseable, rather than failing the whole result', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      amountText: 'a few dollars',
      currency: 'USD',
      confidence: 0.6,
    });
    expect(result?.amountMinor).toBeNull();
    expect(result?.signalType).toBe('renewal');
  });

  it('deterministically nulls billingDate for a cancellation, even if the model returned one — a guaranteed contradiction, not a maybe', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'cancellation',
      vendorName: 'Adobe',
      billingDateText: 'October 1, 2026',
      confidence: 0.95,
    });
    expect(result?.billingDate).toBeNull();
    expect(result?.signalType).toBe('cancellation');
  });

  it('leaves a non-cancellation billingDate untouched', () => {
    const result = parseClassificationResponse({
      relevant: true,
      signalType: 'renewal',
      vendorName: 'Netflix',
      billingDateText: 'October 1, 2026',
      confidence: 0.9,
    });
    expect(result?.billingDate).toBe('2026-10-01');
  });
});

describe('parseReviewBriefResponse', () => {
  it('extracts a valid brief', () => {
    const result = parseReviewBriefResponse({
      summary: 'A one-time payment of $0.29 was received on this account.',
      actionRequired: false,
    });
    expect(result).toEqual({
      summary: 'A one-time payment of $0.29 was received on this account.',
      actionRequired: false,
    });
  });

  it('extracts a brief where action is required', () => {
    const result = parseReviewBriefResponse({
      summary: 'Your rate plan is expiring and a new plan must be chosen before September 30, 2026.',
      actionRequired: true,
    });
    expect(result?.actionRequired).toBe(true);
  });

  it('returns null when summary is missing', () => {
    const result = parseReviewBriefResponse({ actionRequired: false });
    expect(result).toBeNull();
  });

  it('returns null when actionRequired is missing', () => {
    const result = parseReviewBriefResponse({ summary: 'Something happened.' });
    expect(result).toBeNull();
  });

  it('returns null for malformed data', () => {
    expect(parseReviewBriefResponse(null)).toBeNull();
    expect(parseReviewBriefResponse('not an object')).toBeNull();
  });
});
