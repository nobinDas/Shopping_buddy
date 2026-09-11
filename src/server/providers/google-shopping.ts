import 'server-only';

/**
 * Google Shopping via SerpApi (`engine=google_shopping`) — the Watchlist's
 * one price source. Same SerpApi account/key as Phase 3's retired Walmart
 * check (SERPAPI_API_KEY), a different engine. Unlike Phase 3's "take the
 * top result," this deliberately picks the minimum-priced listing across
 * sellers — the user explicitly wants the lowest price available, not just
 * Google's top-ranked one.
 */

const SEARCH_URL = 'https://serpapi.com/search';

export interface LowestPriceResult {
  title: string;
  unitPriceMinor: number;
  currency: string;
  sellerName: string | null;
  productLink: string | null;
}

interface GoogleShoppingResponse {
  shopping_results?: {
    title?: string;
    extracted_price?: number;
    source?: string;
    product_link?: string;
  }[];
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Returns null when there are no results with a usable price, which also
 * doubles as this app's "not currently available anywhere" signal — see
 * services/watchlist.service.ts. No dedicated in-stock/out-of-stock field
 * exists in this API (confirmed via research), so presence of any priced
 * listing is the proxy, not a true inventory feed.
 */
export function parseGoogleShoppingResponse(data: unknown): LowestPriceResult | null {
  const response = data as GoogleShoppingResponse;
  const priced = (response.shopping_results ?? []).filter(
    (result): result is typeof result & { title: string; extracted_price: number } =>
      typeof result.title === 'string' && typeof result.extracted_price === 'number',
  );

  if (priced.length === 0) return null;

  const lowest = priced.reduce((min, result) =>
    result.extracted_price < min.extracted_price ? result : min,
  );

  return {
    title: lowest.title,
    // Google Shopping's extracted_price is an ordinary decimal dollar
    // amount — converted to integer minor units here, once, at the
    // system boundary. See docs/CLAUDE.md: "Never store money as a float."
    unitPriceMinor: Math.round(lowest.extracted_price * 100),
    currency: 'USD',
    sellerName: lowest.source ?? null,
    productLink: lowest.product_link ?? null,
  };
}

/**
 * Searches Google Shopping for the given query and returns the
 * lowest-priced match, or null if nothing priced was found. Throws on a
 * non-OK response so the caller can distinguish "nothing found" from "the
 * lookup itself failed."
 */
export async function searchLowestPrice(query: string): Promise<LowestPriceResult | null> {
  const apiKey = process.env['SERPAPI_API_KEY'];
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not set.');
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpApi responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  return parseGoogleShoppingResponse(data);
}
