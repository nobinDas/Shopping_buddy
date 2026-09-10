import { db, type DbClient } from '@/server/db';
import { insertStore, updateStoreHours, type PreferredStoreRow } from '@/server/db/queries/stores';
import { resolvePlaceHours } from '@/server/providers/google-maps';

/**
 * Inserts a store, then resolves its hours from Google Places using the
 * name + address just entered. A miss or a provider error isn't fatal —
 * the store still gets created with hours left null, same "unknown, not
 * blocking" posture Phase 3 took for an unmatched price search. Hours are
 * only ever resolved here, once, at add-time — no refresh action this
 * phase.
 */
export async function addStore(
  name: string,
  address: string,
  client: DbClient = db,
): Promise<PreferredStoreRow | undefined> {
  const store = await insertStore(name, address, client);
  if (!store) return store;

  let hours;
  try {
    hours = await resolvePlaceHours(`${name} ${address}`);
  } catch {
    return store;
  }
  if (!hours) return store;

  await updateStoreHours(
    store.id,
    {
      placeId: hours.placeId,
      openingHoursText: hours.openingHoursText,
      openingHoursPeriods: hours.openingHoursPeriods,
    },
    client,
  );

  return { ...store, ...hours };
}
