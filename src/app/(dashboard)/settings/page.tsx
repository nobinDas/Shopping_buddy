import Link from 'next/link';
import { getHomeAddress } from '@/server/db/queries/settings';
import { getAllLists } from '@/server/db/queries/shopping';
import { getAllStores } from '@/server/db/queries/stores';
import { HomeAddressForm } from '@/components/settings/HomeAddressForm';
import { DefaultStoresForm } from '@/components/settings/DefaultStoresForm';

// One-off deliberately has no default store — its items are one-time
// buys with no consistent store, unlike the other three lists.
const DEFAULT_STORE_LIST_NAMES = ['Grocery', 'Household', 'Personal'];

export default async function SettingsPage() {
  const [homeAddress, lists, stores] = await Promise.all([
    getHomeAddress(),
    getAllLists(),
    getAllStores(),
  ]);
  const defaultStoreLists = DEFAULT_STORE_LIST_NAMES.map(
    (name) => lists.find((list) => list.name === name) ?? null,
  ).filter((list) => list !== null);

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Settings</p>
      <p className="mb-5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        Home address — the starting point Trips routes from.
      </p>

      <HomeAddressForm homeAddress={homeAddress} />

      <p className="mt-8 mb-2 font-mono text-[11px] tracking-wide text-ink-muted uppercase">
        Default stores
      </p>
      <p className="mb-4 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        A new item added to one of these lists with no store chosen falls back to its default.
        One-off has no default — its items vary too much for one.
      </p>

      <DefaultStoresForm lists={defaultStoreLists} storeOptions={stores.map((s) => s.name)} />
    </main>
  );
}
