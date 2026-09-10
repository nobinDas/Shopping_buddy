import { db, type DbClient } from '@/server/db';
import {
  insertItem,
  updateItemRow,
  deleteItemRow,
  getItemById,
  insertItemPriceHistory,
  type ShoppingItemRow,
} from '@/server/db/queries/shopping';
import { searchWalmartPrice } from '@/server/providers/serpapi';

export interface ItemInput {
  name: string;
  quantity: number;
  notes: string | null;
  store: string | null;
}

export async function addItem(
  listId: string,
  input: ItemInput,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  return insertItem(
    {
      listId,
      name: input.name,
      quantity: input.quantity,
      notes: input.notes,
      store: input.store,
    },
    client,
  );
}

export async function updateItem(
  id: string,
  input: ItemInput,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  return updateItemRow(
    id,
    {
      name: input.name,
      quantity: input.quantity,
      notes: input.notes,
      store: input.store,
    },
    client,
  );
}

export async function deleteItem(id: string, client: DbClient = db): Promise<void> {
  await deleteItemRow(id, client);
}

export async function toggleItemChecked(
  item: ShoppingItemRow,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  return updateItemRow(item.id, { checked: !item.checked }, client);
}

export type PriceCheckResult =
  | { status: 'found'; item: ShoppingItemRow }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

/**
 * Checks one item's price against Walmart, via SerpApi
 * (providers/serpapi.ts) — the only place in the app that calls it, and
 * only ever for exactly one item, on an explicit user action. Never
 * called in a loop or on a schedule — see docs/DECISIONS.md: the free
 * tier's rate limit (250/month, 50/hour) makes that actively harmful,
 * not just wasteful.
 *
 * Searches by the item's own `name` — no fuzzy matching against
 * quantity/size this phase (docs/PHASES.md: "deliberately narrow").
 */
export async function checkItemPrice(
  itemId: string,
  client: DbClient = db,
): Promise<PriceCheckResult> {
  const item = await getItemById(itemId, client);
  if (!item) {
    return { status: 'error', message: 'Item not found.' };
  }

  let result: Awaited<ReturnType<typeof searchWalmartPrice>>;
  try {
    result = await searchWalmartPrice(item.name);
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Price lookup failed.',
    };
  }

  if (!result) {
    return { status: 'not_found' };
  }

  await insertItemPriceHistory(
    {
      itemId,
      unitPriceMinor: result.unitPriceMinor,
      currency: result.currency,
      source: 'walmart',
    },
    client,
  );

  const updated = await updateItemRow(
    itemId,
    {
      unitPriceMinor: result.unitPriceMinor,
      currency: result.currency,
      lastPriceCheckedAt: new Date(),
    },
    client,
  );

  return { status: 'found', item: updated };
}
