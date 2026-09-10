import { getAllLists } from '@/server/db/queries/shopping';
import { getAllStores } from '@/server/db/queries/stores';
import { isVisibleOnShoppingList } from '@/server/domain/shopping-visibility';
import { ShoppingLists } from '@/components/shopping/ShoppingLists';

export default async function ShoppingListsPage() {
  const [lists, stores] = await Promise.all([getAllLists(), getAllStores()]);
  const now = new Date();
  // A checked item stays visible (struck through) through the rest of
  // the day it was checked, then drops out — see
  // domain/shopping-visibility.ts. Nothing is deleted; this only governs
  // what renders here.
  const visibleLists = lists.map((list) => ({
    ...list,
    items: list.items.filter((item) => isVisibleOnShoppingList(item, now)),
  }));

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Shopping</p>

      <ShoppingLists lists={visibleLists} storeOptions={stores.map((s) => s.name)} />
    </main>
  );
}
