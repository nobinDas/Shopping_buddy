import Link from 'next/link';
import { signOut } from '../actions';
import { getWatchlistDropCount } from '@/server/db/queries/watchlist';
import { getAllEmailAccounts } from '@/server/db/queries/email-accounts';
import { getAllStores } from '@/server/db/queries/stores';
import { getActivePolicies } from '@/server/db/queries/insurance';

/**
 * Entry point for everything not on the primary tab bar (Dashboard,
 * Subscriptions, Review, Shopping). Every row's badge is real data —
 * the Accounts/Preferred stores/Insurance badges were left as Phase 1.5
 * mock numbers through several later phases even after each screen went
 * real; fixed here rather than carried forward again.
 */
export default async function MorePage() {
  const [watchlistDropCount, accounts, stores, activePolicies] = await Promise.all([
    getWatchlistDropCount(),
    getAllEmailAccounts(),
    getAllStores(),
    getActivePolicies(),
  ]);

  const needsReauthCount = accounts.filter((account) => account.status === 'needs_reauth').length;

  const sections = [
    {
      href: '/accounts',
      label: 'Accounts',
      badge: needsReauthCount > 0 ? `${String(needsReauthCount)} NEEDS REAUTH` : '',
      tone: needsReauthCount > 0 ? 'text-pending' : 'text-ink-muted',
    },
    {
      href: '/stores',
      label: 'Preferred stores',
      badge: stores.length > 0 ? String(stores.length) : '',
      tone: 'text-ink-muted',
    },
    {
      href: '/insurance',
      label: 'Insurance',
      badge: activePolicies.length > 0 ? String(activePolicies.length) : '',
      tone: 'text-ink-muted',
    },
    { href: '/trips', label: 'Trips', badge: '', tone: 'text-ink-muted' },
    { href: '/settings', label: 'Settings', badge: '', tone: 'text-ink-muted' },
  ] as const;

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <p className="pb-4 font-display text-[28px] tracking-tight">More</p>

      <div className="border-t border-rule">
        <Link
          href="/watchlist"
          className="flex items-center justify-between border-b border-rule py-4 font-sans text-base text-ink"
        >
          Watchlist
          {watchlistDropCount > 0 && (
            <span aria-label="A watched item's price dropped" className="size-[6px] rounded-full bg-verified" />
          )}
        </Link>
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center justify-between border-b border-rule py-4 font-sans text-base text-ink"
          >
            {section.label}
            <span className={`font-mono text-[11px] ${section.tone}`}>{section.badge}</span>
          </Link>
        ))}
        <form action={signOut}>
          <button
            type="submit"
            className="w-full border-b border-rule py-4 text-left font-sans text-base text-ink-muted"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
