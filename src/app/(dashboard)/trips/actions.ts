'use server';

import { planRoute, type PlanRouteResult } from '@/server/services/route.service';

/**
 * Computes the shortest visiting order across the given stores, on
 * demand — never automatic. Returns the result to the client rather than
 * persisting anything: there is no "trip" record, see
 * docs/DECISIONS.md's Phase 4 ADR.
 */
export async function planRouteAction(storeIds: string[]): Promise<PlanRouteResult> {
  return planRoute(storeIds);
}
