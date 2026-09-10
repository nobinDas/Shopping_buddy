import Link from 'next/link';
import { getAllStores } from '@/server/db/queries/stores';
import { PreferredStoresList } from '@/components/stores/PreferredStoresList';

export default async function PreferredStoresPage() {
  const stores = await getAllStores();

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Preferred stores</p>
      <p className="mb-5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        The stores offered when you set an item&apos;s store, and the ones trips are routed through.
      </p>

      <PreferredStoresList stores={stores} />
    </main>
  );
}
