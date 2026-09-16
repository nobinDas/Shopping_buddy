import Link from 'next/link';
import { getAllWatchlistItems } from '@/server/db/queries/watchlist';
import { WatchlistItems } from '@/components/watchlist/WatchlistItems';

export default async function WatchlistPage() {
  const items = await getAllWatchlistItems();

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <div className="flex items-baseline justify-between pb-3.5">
        <Link href="/more" className="font-mono text-xs text-ink-muted underline">
          ← More
        </Link>
        <Link
          href="/watchlist/new"
          className="border border-control-border px-3 py-2 font-sans text-xs font-medium"
        >
          Add
        </Link>
      </div>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Watchlist</p>
      <p className="mb-5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        Big-ticket items tracked for a price drop, checked against Google Shopping on demand.
      </p>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing on your watchlist yet. Add an item to start tracking its price.
          </p>
        </div>
      ) : (
        <WatchlistItems items={items} />
      )}
    </main>
  );
}
