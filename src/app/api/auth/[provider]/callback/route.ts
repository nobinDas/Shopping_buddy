import { NextResponse, type NextRequest } from 'next/server';
import { connectGoogleAccount } from '@/server/services/email-account.service';

const STATE_COOKIE = 'google_oauth_state';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

function redirectToAccounts(request: NextRequest, error?: string): NextResponse {
  const url = new URL('/accounts', request.url);
  if (error) {
    url.searchParams.set('error', error);
  }
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/**
 * Google redirects here after the user approves or declines the consent
 * screen. Only 'google' is implemented — see start/route.ts for why
 * anything else 404s.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  if (provider !== 'google') {
    return NextResponse.json({ error: 'Unknown or unsupported provider.' }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const error = searchParams.get('error');
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;

  // User declined on Google's consent screen — not a bug, nothing to log.
  if (error) {
    return redirectToAccounts(request, 'denied');
  }

  // Missing or mismatched state means this request didn't originate from
  // our own start/route.ts redirect — reject rather than proceed.
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return redirectToAccounts(request, 'invalid_state');
  }

  try {
    await connectGoogleAccount(code);
  } catch {
    // Never surface the underlying error to the client — it can carry
    // provider response detail. See docs/SECURITY.md's logging rules;
    // this catches the equivalent case for an error path, not just logs.
    return redirectToAccounts(request, 'connect_failed');
  }

  return redirectToAccounts(request);
}
