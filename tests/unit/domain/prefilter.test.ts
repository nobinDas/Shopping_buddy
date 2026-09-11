import { describe, expect, it } from 'vitest';
import { looksLikelySubscription } from '@/server/domain/prefilter';

describe('looksLikelySubscription', () => {
  it('matches a typical receipt subject', () => {
    expect(
      looksLikelySubscription({
        subject: 'Your Netflix receipt',
        from: 'info@netflix.com',
        snippet: 'Thanks for being a member. You were charged $15.49.',
      }),
    ).toBe(true);
  });

  it('matches a renewal notice by subject keyword', () => {
    expect(
      looksLikelySubscription({
        subject: 'Your subscription will renew soon',
        from: 'updates@example.com',
        snippet: '',
      }),
    ).toBe(true);
  });

  it('matches a transactional sender pattern even with a generic subject', () => {
    expect(
      looksLikelySubscription({
        subject: 'Account update',
        from: 'noreply@somevendor.com',
        snippet: '',
      }),
    ).toBe(true);
  });

  it('does not match an unrelated personal email', () => {
    expect(
      looksLikelySubscription({
        subject: 'Dinner Friday?',
        from: 'friend@example.com',
        snippet: 'Want to grab dinner this Friday?',
      }),
    ).toBe(false);
  });

  it('does not match a newsletter with no billing language', () => {
    expect(
      looksLikelySubscription({
        subject: 'This week in tech',
        from: 'newsletter@example.com',
        snippet: 'Top stories curated for you.',
      }),
    ).toBe(false);
  });
});
