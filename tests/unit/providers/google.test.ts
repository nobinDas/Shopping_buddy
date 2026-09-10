import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildAuthorizationUrl } from '@/server/providers/google';

const originalEnv = {
  GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'],
  GOOGLE_CLIENT_SECRET: process.env['GOOGLE_CLIENT_SECRET'],
  NEXT_PUBLIC_SITE_URL: process.env['NEXT_PUBLIC_SITE_URL'],
};

beforeEach(() => {
  process.env['GOOGLE_CLIENT_ID'] = 'test-client-id.apps.googleusercontent.com';
  process.env['GOOGLE_CLIENT_SECRET'] = 'test-client-secret';
  process.env['NEXT_PUBLIC_SITE_URL'] = 'http://localhost:3000';
});

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
});

describe('buildAuthorizationUrl', () => {
  it('points at Google\'s authorization endpoint', () => {
    const url = new URL(buildAuthorizationUrl({ state: 'abc123' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  });

  it('includes the client id, redirect uri, and state', () => {
    const url = new URL(buildAuthorizationUrl({ state: 'abc123' }));
    expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/google/callback',
    );
    expect(url.searchParams.get('state')).toBe('abc123');
  });

  it('requests only the read-only Gmail scope plus identity, never a write scope', () => {
    const url = new URL(buildAuthorizationUrl({ state: 'abc123' }));
    const scope = url.searchParams.get('scope');
    expect(scope).toContain('https://www.googleapis.com/auth/gmail.readonly');
    expect(scope).toContain('openid');
    expect(scope).toContain('email');
    expect(scope).not.toMatch(/gmail\.(modify|send|compose)/);
  });

  it('requests offline access and forces consent, so a refresh token is reliably returned', () => {
    const url = new URL(buildAuthorizationUrl({ state: 'abc123' }));
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('throws when GOOGLE_CLIENT_ID is missing', () => {
    delete process.env['GOOGLE_CLIENT_ID'];
    expect(() => buildAuthorizationUrl({ state: 'abc123' })).toThrow('GOOGLE_CLIENT_ID');
  });

  it('throws when NEXT_PUBLIC_SITE_URL is missing', () => {
    delete process.env['NEXT_PUBLIC_SITE_URL'];
    expect(() => buildAuthorizationUrl({ state: 'abc123' })).toThrow('NEXT_PUBLIC_SITE_URL');
  });
});
