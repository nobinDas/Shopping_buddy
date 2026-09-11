import { db, type DbClient } from '@/server/db';
import {
  insertItem,
  updateItemRow,
  deleteItemRow,
  type ShoppingItemRow,
} from '@/server/db/queries/shopping';

export interface ItemInput {
  name: string;
  quantity: number;
  notes: string | null;
  store: string | null;
  /** ISO date (YYYY-MM-DD), or null for no deadline. Drives /trips' urgency sort — see docs/DECISIONS.md's Phase 4 ADR. */
  dueAt: string | null;
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
      dueAt: input.dueAt,
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
      dueAt: input.dueAt,
    },
    client,
  );
}

export async function deleteItem(id: string, client: DbClient = db): Promise<void> {
  await deleteItemRow(id, client);
}

/**
 * Flips `checked` and stamps `checkedAt` to now (or clears it back to
 * null on uncheck) in the same update — the one place `checked` ever
 * changes, so the one place this needs to live. checkedAt is what
 * domain/shopping-visibility.ts uses to know when to stop showing a
 * bought item on /shopping.
 */
export async function toggleItemChecked(
  item: ShoppingItemRow,
  client: DbClient = db,
): Promise<ShoppingItemRow> {
  const checked = !item.checked;
  return updateItemRow(item.id, { checked, checkedAt: checked ? new Date() : null }, client);
}
