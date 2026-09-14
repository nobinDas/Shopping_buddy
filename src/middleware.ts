import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// '/api/cron' is not "public" in the sense of unauthenticated — the
// route itself requires a valid CRON_SECRET bearer token (see
// api/cron/sync/route.ts) — it's exempted here because a scheduled
// Vercel Cron invocation is a server-to-server request with no
// Supabase session cookie at all. Without this, every cron request
// hits the `!user` branch below and gets redirected to /login before
// the route handler's own auth check ever runs — found live while
// wiring up the Phase 1e cron schedule (docs/LEARNED.md, 2026-09-14).
const PUBLIC_PATHS = ['/login', '/auth', '/api/cron'];

export async function middleware(request: NextRequest) {
  // Checked inside the function, not at module scope — narrowing an outer
  // const doesn't survive into a nested function body, since TS can't rule
  // out reassignment between module load and the function actually running.
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.');
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Required even though `user` isn't read directly below — this call is what
  // refreshes the session cookie via the setAll callback above.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
