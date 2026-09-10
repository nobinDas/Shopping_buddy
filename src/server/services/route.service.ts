import { db, type DbClient } from '@/server/db';
import { getHomeAddress } from '@/server/db/queries/settings';
import { getAllStores, type PreferredStoreRow } from '@/server/db/queries/stores';
import { computeShortestRoute } from '@/server/providers/google-maps';

export type PlanRouteResult =
  | { status: 'planned'; order: string[]; legMinutes: number[] }
  | { status: 'missing_home_address' }
  | { status: 'missing_store_address'; storeNames: string[] }
  | { status: 'error'; message: string };

/**
 * Computes the shortest visiting order across the given stores, starting
 * from the saved home address. No DB write — this is a pure computation
 * wrapped in a typed result, called on demand from a server action, never
 * automatically or persisted. See providers/google-maps.ts for why a
 * round trip is requested even though the UI never shows a "drive home"
 * leg.
 */
export async function planRoute(
  storeIds: string[],
  client: DbClient = db,
): Promise<PlanRouteResult> {
  const homeAddress = await getHomeAddress(client);
  if (!homeAddress) {
    return { status: 'missing_home_address' };
  }

  const allStores = await getAllStores(client);
  const storesById = new Map(allStores.map((store) => [store.id, store]));
  const stores = storeIds
    .map((id) => storesById.get(id))
    .filter((store): store is PreferredStoreRow => store !== undefined);

  const withoutAddress = stores.filter((store) => !store.address);
  if (withoutAddress.length > 0) {
    return { status: 'missing_store_address', storeNames: withoutAddress.map((s) => s.name) };
  }

  let route;
  try {
    route = await computeShortestRoute(
      homeAddress,
      stores.map((store) => store.address),
    );
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Route lookup failed.',
    };
  }
  if (!route) {
    return { status: 'error', message: 'Google Routes returned no route.' };
  }

  const order = route.order
    .map((index) => stores[index]?.id)
    .filter((id): id is string => id !== undefined);

  return { status: 'planned', order, legMinutes: route.legMinutes };
}
