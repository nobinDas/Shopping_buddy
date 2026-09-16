import 'server-only';
import type { OpeningPeriod } from '@/server/domain/store-hours';
import { EXTERNAL_FETCH_TIMEOUT_MS } from './http';

/**
 * Google Maps Platform — Places API (store hours) and Routes API (drive
 * times), per docs/TOOLS.md's Phase 4 pre-reasoning. Both need
 * GOOGLE_MAPS_API_KEY, a Maps Platform key restricted to these two APIs;
 * see docs/DECISIONS.md's Phase 4 ADR for the billing-account hand-off.
 * Neither function renders or returns anything map-shaped — both are
 * called purely for the numbers (hours, drive minutes) they return.
 */

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const ROUTES_COMPUTE_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

function requireApiKey(): string {
  const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
  if (!apiKey) {
    throw new Error('GOOGLE_MAPS_API_KEY is not set.');
  }
  return apiKey;
}

// ── Places: store hours ──────────────────────────────────────────────

export interface PlaceHoursResult {
  placeId: string;
  openingHoursText: string[] | null;
  openingHoursPeriods: OpeningPeriod[] | null;
}

interface PlacesSearchResponse {
  places?: {
    id?: string;
    regularOpeningHours?: {
      weekdayDescriptions?: string[];
      periods?: {
        open?: { day?: number; hour?: number; minute?: number };
        close?: { day?: number; hour?: number; minute?: number };
      }[];
    };
  }[];
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Takes the top place match as-is. Keeps only the first period per day —
 * a store with a split schedule (e.g. a lunch closure) only gets its
 * first period considered "open," a deliberate small cut.
 */
export function parsePlaceSearchResponse(data: unknown): PlaceHoursResult | null {
  const response = data as PlacesSearchResponse;
  const first = response.places?.[0];
  if (!first?.id) return null;

  const hours = first.regularOpeningHours;
  const periodsByDay = new Map<number, OpeningPeriod>();
  for (const period of hours?.periods ?? []) {
    const { open, close } = period;
    if (
      open?.day == null ||
      open.hour == null ||
      open.minute == null ||
      close?.hour == null ||
      close.minute == null
    ) {
      continue;
    }
    if (periodsByDay.has(open.day)) continue;
    periodsByDay.set(open.day, {
      day: open.day,
      opensAt: `${pad2(open.hour)}:${pad2(open.minute)}`,
      closesAt: `${pad2(close.hour)}:${pad2(close.minute)}`,
    });
  }

  return {
    placeId: first.id,
    openingHoursText: hours?.weekdayDescriptions ?? null,
    openingHoursPeriods: periodsByDay.size > 0 ? [...periodsByDay.values()] : null,
  };
}

/**
 * Resolves a store's opening hours from its name + address via Places
 * Text Search. Returns null (not a throw) when nothing matches — an
 * unmatched store isn't fatal, it just can't show an open-now chip. Only
 * throws on a genuine request failure.
 */
export async function resolvePlaceHours(query: string): Promise<PlaceHoursResult | null> {
  const apiKey = requireApiKey();

  const response = await fetch(PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.regularOpeningHours',
    },
    body: JSON.stringify({ textQuery: query }),
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Places responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  return parsePlaceSearchResponse(data);
}

// ── Places: address autocomplete ─────────────────────────────────────

export interface AddressSuggestion {
  placeId: string;
  description: string;
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
    };
  }[];
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Drops any suggestion missing a placeId or display text rather than
 * passing a half-formed row on to the UI.
 */
export function parseAutocompleteResponse(data: unknown): AddressSuggestion[] {
  const response = data as AutocompleteResponse;
  const suggestions: AddressSuggestion[] = [];
  for (const item of response.suggestions ?? []) {
    const placeId = item.placePrediction?.placeId;
    const description = item.placePrediction?.text?.text;
    if (!placeId || !description) continue;
    suggestions.push({ placeId, description });
  }
  return suggestions;
}

/**
 * Address suggestions for the store-add typeahead, via Places Autocomplete
 * (New) Text Search. A miss or a provider error isn't fatal here either —
 * callers should treat this the same "unknown, not blocking" way
 * resolvePlaceHours is treated.
 */
export async function autocompleteAddress(query: string): Promise<AddressSuggestion[]> {
  const apiKey = requireApiKey();

  const response = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({ input: query }),
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Places Autocomplete responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  return parseAutocompleteResponse(data);
}

// ── Routes: shortest multi-stop order + drive minutes ──────────────────

export interface RouteResult {
  /** Stop indices (into the caller's original stopAddresses array), in optimized visiting order. */
  order: number[];
  /** Drive minutes for each leg: home→order[0], order[0]→order[1], … — one entry per stop. */
  legMinutes: number[];
}

interface RoutesComputeResponse {
  routes?: {
    optimizedIntermediateWaypointIndex?: number[];
    legs?: { duration?: string }[];
  }[];
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const seconds = Number.parseInt(duration.replace('s', ''), 10);
  return Number.isNaN(seconds) ? 0 : seconds;
}

function naturalOrder(stopCount: number): number[] {
  return Array.from({ length: stopCount }, (_, i) => i);
}

/**
 * Google returns `optimizedIntermediateWaypointIndex` as a real
 * permutation only when there's something to optimize. With a single
 * intermediate it returns `[-1]` instead of `[0]` — confirmed live
 * against the real API, not documented anywhere obvious — so a
 * "present but not a valid permutation of 0..stopCount-1" result falls
 * back to natural order rather than propagating a bogus index.
 */
function isValidOrder(order: number[], stopCount: number): boolean {
  if (order.length !== stopCount) return false;
  const seen = new Set(order);
  if (seen.size !== stopCount) return false;
  return order.every((i) => i >= 0 && i < stopCount);
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * `stopCount` is needed because Google always returns a leg for the final
 * return-to-origin leg (a round trip is requested so the optimizer is
 * free to reorder every stop rather than pinning one as "last" — see
 * computeShortestRoute) — that final leg is sliced off here, since the UI
 * never shows a "drive home" duration.
 */
export function parseRouteResponse(data: unknown, stopCount: number): RouteResult | null {
  const response = data as RoutesComputeResponse;
  const route = response.routes?.[0];
  if (!route?.legs) return null;

  const candidateOrder = route.optimizedIntermediateWaypointIndex ?? naturalOrder(stopCount);
  const order = isValidOrder(candidateOrder, stopCount) ? candidateOrder : naturalOrder(stopCount);
  const legMinutes = route.legs
    .slice(0, stopCount)
    .map((leg) => Math.round(parseDurationSeconds(leg.duration) / 60));

  return { order, legMinutes };
}

/**
 * Computes the shortest visiting order across `stopAddresses`, starting
 * and (for optimization purposes only) ending at `originAddress`. A round
 * trip is requested — not because the UI shows a trip home, but because
 * Google's optimizeWaypointOrder needs a fixed destination to reorder
 * intermediates against; setting destination = origin lets every stop be
 * freely reordered rather than one being arbitrarily pinned as "last."
 * The final stop→origin leg is discarded by parseRouteResponse before
 * this returns.
 */
export async function computeShortestRoute(
  originAddress: string,
  stopAddresses: string[],
): Promise<RouteResult | null> {
  const apiKey = requireApiKey();

  const response = await fetch(ROUTES_COMPUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.legs.duration',
    },
    body: JSON.stringify({
      origin: { address: originAddress },
      destination: { address: originAddress },
      intermediates: stopAddresses.map((address) => ({ address })),
      travelMode: 'DRIVE',
      optimizeWaypointOrder: true,
    }),
    signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google Routes responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  return parseRouteResponse(data, stopAddresses.length);
}
