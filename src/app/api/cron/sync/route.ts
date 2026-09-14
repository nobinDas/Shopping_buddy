import { NextResponse, type NextRequest } from 'next/server';
import { getAllEmailAccounts } from '@/server/db/queries/email-accounts';
import { syncAccount } from '@/server/services/detection.service';

/**
 * docs/TOOLS.md: "Daily sync | Vercel Cron → route handler." Wired to a
 * real schedule (Phase 1e, `vercel.json` — daily, 13:00 UTC) once
 * classification accuracy was verified against the golden-file set and
 * a real inbox (Phase 1d). Protected by CRON_SECRET regardless, since
 * this route is otherwise a public URL that would trigger real Gmail
 * reads + Claude calls across every connected account — Vercel's own
 * scheduled invocation sends `Authorization: Bearer <CRON_SECRET>`
 * automatically, using the same env var set in Production.
 */
export async function GET(request: NextRequest) {
  const secret = process.env['CRON_SECRET'];
  const authHeader = request.headers.get('authorization');
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const accounts = await getAllEmailAccounts();
  const active = accounts.filter((account) => account.status === 'active');

  const results = await Promise.all(
    active.map(async (account) => {
      try {
        const result = await syncAccount(account.id);
        return { accountId: account.id, ...result };
      } catch (error) {
        return {
          accountId: account.id,
          error: error instanceof Error ? error.message : 'Sync failed.',
        };
      }
    }),
  );

  return NextResponse.json({ accountsSynced: results.length, results });
}
