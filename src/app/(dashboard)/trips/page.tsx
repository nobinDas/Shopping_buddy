import Link from 'next/link';
import { getAllOutstandingItems } from '@/server/db/queries/shopping';
import { getAllStores } from '@/server/db/queries/stores';
import { planRoute } from '@/server/services/route.service';
import { OutstandingStops } from '@/components/trips/OutstandingStops';

export default async function TripsPage() {
  const [items, stores] = await Promise.all([getAllOutstandingItems(), getAllStores()]);

  // Auto-plans on every visit, using whichever stores are currently
  // represented among outstanding items — no manual "Plan route" trigger.
  // Real Google Routes call each time; safe at this app's volume given
  // the daily request quota set on the API key (docs/DECISIONS.md).
  const storesByName = new Map(stores.map((store) => [store.name, store]));
  const storeIds = [
    ...new Set(
      items
        .map((item) => (item.store ? storesByName.get(item.store)?.id : undefined))
        .filter((id): id is string => id !== undefined),
    ),
  ];
  const route = storeIds.length > 0 ? await planRoute(storeIds) : null;

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="font-display text-[28px] tracking-tight">Trips</p>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">Nothing outstanding. Everything on your lists is checked off.</p>
        </div>
      ) : (
        <OutstandingStops items={items} stores={stores} route={route} />
      )}
    </main>
  );
}
