'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavTab {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
}

// "Subs" not "Subscriptions" — matches the mock's own tab-bar label; the
// full name still appears as the page heading once you're on the screen.
const TABS: NavTab[] = [
  { href: '/', label: 'Dashboard', isActive: (p) => p === '/' },
  { href: '/shopping', label: 'Shopping', isActive: (p) => p === '/shopping' },
  { href: '/subscriptions', label: 'Subs', isActive: (p) => p.startsWith('/subscriptions') },
  { href: '/review', label: 'Review', isActive: (p) => p === '/review' },
  {
    href: '/more',
    label: 'More',
    isActive: (p) =>
      ['/more', '/accounts', '/insurance', '/trips', '/watchlist', '/stores'].some((route) =>
        p.startsWith(route),
      ),
  },
];

export function BottomNav({
  hasWatchlistDrop = false,
  pendingReviewCount = 0,
}: {
  hasWatchlistDrop?: boolean;
  pendingReviewCount?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-[66px] max-w-lg grid-cols-5 border-t border-rule bg-surface">
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center justify-center gap-1 pb-2 font-sans text-[11px] font-medium ${
              active ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            {active && <span className="absolute inset-x-0 top-[-1px] h-[2px] bg-ink" />}
            <span className="flex items-center gap-1">
              {tab.label}
              {tab.href === '/review' && pendingReviewCount > 0 && (
                <span className="font-mono text-[10px] text-pending">{pendingReviewCount}</span>
              )}
              {tab.href === '/more' && hasWatchlistDrop && (
                <span
                  aria-label="A watched item's price dropped"
                  className="size-[6px] rounded-full bg-verified"
                />
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
