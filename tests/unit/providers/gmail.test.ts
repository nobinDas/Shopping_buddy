import { describe, expect, it } from 'vitest';
import {
  parseProfileResponse,
  parseMessageListResponse,
  parseHistoryResponse,
  parseMetadataResponse,
  parseBodyResponse,
} from '@/server/providers/gmail';

describe('parseProfileResponse', () => {
  it('extracts the historyId', () => {
    expect(parseProfileResponse({ historyId: '12345' })).toBe('12345');
  });

  it('returns null when missing', () => {
    expect(parseProfileResponse({})).toBeNull();
  });
});

describe('parseMessageListResponse', () => {
  it('extracts message ids', () => {
    expect(parseMessageListResponse({ messages: [{ id: 'a' }, { id: 'b' }] })).toEqual(['a', 'b']);
  });

  it('returns an empty array when there are no messages', () => {
    expect(parseMessageListResponse({})).toEqual([]);
  });
});

describe('parseHistoryResponse', () => {
  it('extracts added message ids and the new historyId', () => {
    const result = parseHistoryResponse(
      {
        history: [
          { messagesAdded: [{ message: { id: 'm1' } }, { message: { id: 'm2' } }] },
          { messagesAdded: [{ message: { id: 'm3' } }] },
        ],
        historyId: '999',
      },
      '100',
    );
    expect(result).toEqual({ messageIds: ['m1', 'm2', 'm3'], newHistoryId: '999' });
  });

  it('returns an empty list when nothing changed', () => {
    const result = parseHistoryResponse({ historyId: '101' }, '100');
    expect(result).toEqual({ messageIds: [], newHistoryId: '101' });
  });

  it('falls back to the given historyId when the response omits one', () => {
    const result = parseHistoryResponse({}, '100');
    expect(result.newHistoryId).toBe('100');
  });
});

describe('parseMetadataResponse', () => {
  it('extracts subject, from, and snippet', () => {
    const result = parseMetadataResponse({
      snippet: 'You were charged $15.49',
      payload: {
        headers: [
          { name: 'Subject', value: 'Your receipt' },
          { name: 'From', value: 'billing@netflix.com' },
        ],
      },
    });
    expect(result).toEqual({
      subject: 'Your receipt',
      from: 'billing@netflix.com',
      snippet: 'You were charged $15.49',
    });
  });

  it('defaults missing fields to empty strings', () => {
    expect(parseMetadataResponse({})).toEqual({ subject: '', from: '', snippet: '' });
  });
});

describe('parseBodyResponse', () => {
  it('decodes a base64url-encoded plain-text body', () => {
    const encoded = Buffer.from('Hello world').toString('base64url');
    const result = parseBodyResponse({
      payload: {
        headers: [{ name: 'Subject', value: 'Test' }],
        mimeType: 'text/plain',
        body: { data: encoded },
      },
    });
    expect(result.body).toBe('Hello world');
    expect(result.subject).toBe('Test');
  });

  it('finds the plain-text part in a multipart message', () => {
    const encoded = Buffer.from('Plain text version').toString('base64url');
    const result = parseBodyResponse({
      payload: {
        headers: [],
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/html', body: { data: Buffer.from('<p>html</p>').toString('base64url') } },
          { mimeType: 'text/plain', body: { data: encoded } },
        ],
      },
    });
    expect(result.body).toBe('Plain text version');
  });

  it('returns an empty body when no part has data', () => {
    const result = parseBodyResponse({ payload: { headers: [] } });
    expect(result.body).toBe('');
  });
});
