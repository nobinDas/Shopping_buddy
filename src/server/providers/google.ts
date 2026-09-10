import 'server-only';

/**
 * Google OAuth adapter — one function per endpoint, matching
 * docs/ARCHITECTURE.md's "one adapter per external system" rule. This
 * file is identity/authorization only (getting and refreshing a token,
 * finding out which address it belongs to); actually reading Gmail
 * messages is Phase 1d's providers/gmail.ts, not built yet.
 *
 * Scope requested is gmail.readonly (docs/SECURITY.md's minimum-scope
 * rule) plus openid/email — the latter two grant no extra Gmail access,
 * they're what let the app know *which* address it connected, without
 * which the accounts screen couldn't tell two connections apart.
 */

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly openid email';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.');
  }
  return { clientId, clientSecret };
}

function getRedirectUri(): string {
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is not set.');
  }
  return `${siteUrl}/api/auth/google/callback`;
}

/**
 * Builds Google's consent-screen URL. Pure — no network call — so it's
 * unit-tested directly rather than through a mock.
 *
 * `access_type=offline` + `prompt=consent` together are what make Google
 * reliably return a refresh_token: without `offline`, only an
 * access_token comes back; without `prompt=consent`, a returning user
 * who already granted access once gets silently re-approved with no
 * refresh_token in the response at all.
 */
export function buildAuthorizationUrl({ state }: { state: string }): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

async function postForm(url: string, body: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    // Deliberately not including `body` in the error — it's the request
    // we sent, which can carry the client secret or a token. Google's
    // response is safe to include; ours isn't. See docs/SECURITY.md.
    throw new Error(`Google token endpoint ${url} responded ${String(response.status)}`);
  }

  return response.json();
}

/** Exchanges an authorization code for an access + refresh token pair. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const data = (await postForm(TOKEN_URL, {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  })) as { access_token?: string; refresh_token?: string; expires_in?: number };

  if (!data.access_token || !data.refresh_token || data.expires_in == null) {
    throw new Error(
      'exchangeCodeForTokens: Google did not return an access_token, refresh_token, and expires_in.',
    );
  }

  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

/**
 * Refreshes an access token. Google does not return a new refresh_token
 * here — the original one keeps working until revoked or expired.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getClientCredentials();
  const data = (await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })) as { access_token?: string; expires_in?: number };

  if (!data.access_token || data.expires_in == null) {
    throw new Error('refreshAccessToken: Google did not return an access_token and expires_in.');
  }

  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Revokes a token (access or refresh — Google revokes the whole grant
 * either way) with Google. Called before deleting the local row on
 * disconnect — see docs/SECURITY.md: "Disconnecting an account revokes
 * the token with the provider *and* deletes the local record."
 */
export async function revokeToken(token: string): Promise<void> {
  const response = await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Google revoke endpoint responded ${String(response.status)}`);
  }
}

/**
 * Fetches the email address for the account an access token belongs to.
 * Requires the `email`/`openid` scopes requested in buildAuthorizationUrl.
 */
export async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo endpoint responded ${String(response.status)}`);
  }

  const data = (await response.json()) as { email?: string };
  if (!data.email) {
    throw new Error('getUserInfo: Google did not return an email address.');
  }

  return { email: data.email };
}
