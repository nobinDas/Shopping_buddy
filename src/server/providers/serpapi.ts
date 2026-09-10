import 'server-only';

/**
 * SerpApi's Walmart search engine — the one price source Phase 3 scopes
 * to (docs/TOOLS.md, docs/DECISIONS.md). Free tier is rate-limited
 * (250 searches/month, 50/hour), so every call here corresponds to one
 * explicit, user-triggered "check this item's price" click — never
 * automatic, never bulk. See services/shopping.service.ts's
 * checkItemPrice, the only caller.
 */

const SEARCH_URL = 'https://serpapi.com/search';

export interface WalmartPriceResult {
  title: string;
  unitPriceMinor: number;
  currency: string;
}

interface SerpApiWalmartResponse {
  organic_results?: {
    title?: string;
    primary_offer?: {
      offer_price?: number;
    };
  }[];
}

/**
 * Pure — no network call — so it's unit-tested directly against fixture
 * JSON rather than through a mock. Takes the top search result as-is; no
 * fuzzy matching against quantity/size, per this phase's "deliberately
 * narrow" scope (docs/PHASES.md).
 */
export function parseWalmartSearchResponse(data: unknown): WalmartPriceResult | null {
  const response = data as SerpApiWalmartResponse;
  const first = response.organic_results?.[0];

  if (!first?.title || first.primary_offer?.offer_price == null) {
    return null;
  }

  return {
    title: first.title,
    // Walmart search results carry an ordinary decimal dollar amount
    // (e.g. 1.98) — converted to integer minor units here, once, at the
    // system boundary, never as a float beyond this point. See
    // docs/CLAUDE.md: "Never store money as a float."
    unitPriceMinor: Math.round(first.primary_offer.offer_price * 100),
    currency: 'USD',
  };
}

/**
 * Searches Walmart via SerpApi for the given query and returns the top
 * match, or null if nothing matched. Throws — rather than returning
 * null — on a non-OK response (including a 429 rate limit), so the
 * caller can distinguish "no product found" from "the lookup itself
 * failed" and surface each honestly.
 */
export async function searchWalmartPrice(query: string): Promise<WalmartPriceResult | null> {
  const apiKey = process.env['SERPAPI_API_KEY'];
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not set.');
  }

  const url = new URL(SEARCH_URL);
  url.searchParams.set('engine', 'walmart');
  url.searchParams.set('query', query);
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpApi responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  return parseWalmartSearchResponse(data);
}
