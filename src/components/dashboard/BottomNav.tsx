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
  { href: '/subscriptions', label: 'Subs', isActive: (p) => p.startsWith('/subscriptions') },
  { href: '/review', label: 'Review', isActive: (p) => p === '/review' },
  { href: '/shopping', label: 'Shopping', isActive: (p) => p === '/shopping' },
  {
    href: '/more',
    label: 'More',
    isActive: (p) =>
      ['/more', '/accounts', '/insurance', '/trips', '/watchlist', '/stores'].some((route) =>
        p.startsWith(route),
      ),
  },
];

// Mirrors review/page.tsx's own mock `initialProposals` pending count (4).
// No shared state yet — Phase 1e's real reconciliation_proposals table is
// what eventually makes this a live count instead of a fixture echo.
const PENDING_REVIEW_COUNT = 4;

export function BottomNav() {
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
              {tab.href === '/review' && (
                <span className="font-mono text-[10px] text-pending">{PENDING_REVIEW_COUNT}</span>
              )}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
