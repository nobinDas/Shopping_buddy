import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthorizationUrl } from '@/server/providers/google';

const STATE_COOKIE = 'google_oauth_state';
const STATE_COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes — long enough to complete Google's consent screen

interface RouteParams {
  params: Promise<{ provider: string }>;
}

/**
 * Starts an OAuth connect (or reconnect — same flow, see
 * services/email-account.service.ts's find-or-update). Only 'google' is
 * implemented; anything else 404s rather than silently pretending to
 * work — see docs/CLAUDE.md: "don't scaffold future-phase features."
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  if (provider !== 'google') {
    return NextResponse.json({ error: 'Unknown or unsupported provider.' }, { status: 404 });
  }

  const state = randomUUID();
  const response = NextResponse.redirect(buildAuthorizationUrl({ state }));

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
