import Link from 'next/link';
import { AddWatchlistItemWizard } from '@/components/watchlist/AddWatchlistItemWizard';

export default function NewWatchlistItemPage() {
  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <Link href="/watchlist" className="font-mono text-xs text-ink-muted underline">
        ← Watchlist
      </Link>
      <p className="mt-3 mb-5 font-display text-[28px] tracking-tight">Track a price</p>
      <AddWatchlistItemWizard />
    </main>
  );
}
