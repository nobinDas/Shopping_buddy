import { NextResponse, type NextRequest } from 'next/server';
import { getAllEmailAccounts } from '@/server/db/queries/email-accounts';
import { syncAccount } from '@/server/services/detection.service';

/**
 * docs/TOOLS.md: "Daily sync | Vercel Cron → route handler." Not wired
 * to an actual schedule yet (Phase 1d) — that's a vercel.json/dashboard
 * config change, left for the user to enable once satisfied with
 * classification accuracy. Protected by CRON_SECRET regardless, since
 * this route is otherwise a public URL that would trigger real Gmail
 * reads + Gemini calls across every connected account.
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
