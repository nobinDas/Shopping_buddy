import { NextResponse, type NextRequest } from 'next/server';
import { checkAllWatchlistItemPrices } from '@/server/services/watchlist.service';

/**
 * Monthly automatic price check for every watchlist item — see
 * docs/DECISIONS.md's watchlist identity-resolution ADR (amended) for why
 * this exists alongside the manual per-item check button, not instead of
 * it. Wired to `vercel.json`'s `0 14 1 * *` schedule (1st of the month,
 * 14:00 UTC — an hour after the existing daily sync's 13:00 slot, so the
 * two never contend for the same minute).
 *
 * `/api/cron` is exempted from the login-redirect in `middleware.ts` (a
 * scheduled Vercel Cron request carries no Supabase session cookie), so
 * this route's own `CRON_SECRET` check, same as `/api/cron/sync`, is the
 * only thing standing between this route and an unauthenticated caller
 * triggering a real SerpApi call per watchlist item.
 */
export async function GET(request: NextRequest) {
  const secret = process.env['CRON_SECRET'];
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const results = await checkAllWatchlistItemPrices();
  return NextResponse.json({ itemsChecked: results.length, results });
}
