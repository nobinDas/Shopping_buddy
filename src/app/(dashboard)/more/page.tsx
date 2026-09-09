import Link from 'next/link';
import { signOut } from '../actions';

/**
 * Entry point for everything not on the primary tab bar (Dashboard,
 * Subscriptions, Review, Shopping). Each row's badge mirrors that screen's
 * own mock data — see docs/DECISIONS.md for why these five screens moved
 * behind "More" instead of staying top-level.
 */
const SECTIONS = [
  { href: '/accounts', label: 'Accounts', badge: '1 NEEDS REAUTH', tone: 'text-pending' },
  { href: '/stores', label: 'Preferred stores', badge: '4', tone: 'text-ink-muted' },
  { href: '/insurance', label: 'Insurance', badge: '2', tone: 'text-ink-muted' },
  { href: '/trips', label: 'Trips', badge: '2 PLANNED', tone: 'text-ink-muted' },
  { href: '/watchlist', label: 'Watchlist', badge: '3', tone: 'text-ink-muted' },
] as const;

export default function MorePage() {
  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <p className="pb-4 font-display text-[28px] tracking-tight">More</p>

      <div className="border-t border-rule">
        {SECTIONS.map((section) => (
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
