import { getAllLists } from '@/server/db/queries/shopping';
import { getAllStores } from '@/server/db/queries/stores';
import { ShoppingLists } from '@/components/shopping/ShoppingLists';

export default async function ShoppingListsPage() {
  const [lists, stores] = await Promise.all([getAllLists(), getAllStores()]);

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Shopping</p>

      <ShoppingLists lists={lists} storeOptions={stores.map((s) => s.name)} />
    </main>
  );
}
