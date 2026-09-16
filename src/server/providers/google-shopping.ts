import 'server-only';
import { parseAmountSpan } from '@/server/domain/parse-amount-span';
import type { ProductCandidate } from '@/server/domain/watchlist-candidates';
import type { ProductOffer } from '@/server/domain/watchlist-offers';

/**
 * Two SerpApi engines, both Google Shopping data, two different jobs —
 * see docs/DECISIONS.md's watchlist identity-resolution ADR:
 *
 * - `google_shopping` (`searchProductCandidates`): a keyword search
 *   returning many candidate listings. Used only at add-item time, to
 *   let the user confirm which specific product they mean.
 * - `google_immersive_product` (`getImmersiveProductOffers`): fetches
 *   current seller offers for one already-known product, identified by
 *   its `immersive_product_page_token` (captured from the
 *   `google_shopping` result the user confirmed at add time) — no
 *   search, no ambiguity. This is what makes price history actually
 *   comparable across checks: every poll is the same product, not a
 *   fresh best-effort match that could silently drift to a different
 *   listing or variant. This engine replaced `google_product` +
 *   `product_id` — Google shut that service down (confirmed live,
 *   2026-09-15: "The Google Product service is no longer offered by
 *   Google.", reproduced with several real, previously-working
 *   `product_id`s). Whether `page_token` itself stays valid for the same
 *   long stretch `product_id` was assumed to is unverified — this
 *   engine's own errors, not a guess, are what decide when an item needs
 *   re-resolution (see `getImmersiveProductOffers`'s doc comment).
 *
 * Same SerpApi account/key as the rest of this app's SerpApi usage
 * (SERPAPI_API_KEY).
 */

const SEARCH_URL = 'https://serpapi.com/search';

function requireApiKey(): string {
  const apiKey = process.env['SERPAPI_API_KEY'];
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not set.');
  }
  return apiKey;
}

interface SerpApiMetadata {
  search_metadata?: { status?: string };
  error?: string;
}

/**
 * SerpApi returns HTTP 200 even when the search itself failed upstream —
 * confirmed live, hitting a real (apparently transient) failure while
 * debugging this feature: `error: "We couldn't get valid results for
 * this search. Please try again later."` with no `shopping_results` key
 * at all, indistinguishable from a genuine zero-result search by
 * response shape alone. `search_metadata.status` is the actual signal:
 * `"Success"` even for a real, deliberate zero-result answer (e.g.
 * `error: "Google hasn't returned any results for this query."`, seen
 * live for an over-constrained query — a legitimate "nothing found," not
 * a failure), anything else for a genuine upstream failure. Thrown here
 * rather than silently parsed into an empty array, so a transient
 * provider failure surfaces as `{ status: 'error' }` instead of being
 * indistinguishable from "this product truly isn't listed anywhere."
 */
export function assertSerpApiSucceeded(data: unknown, engine: string): void {
  const meta = data as SerpApiMetadata;
  const status = meta.search_metadata?.status;
  if (status !== undefined && status !== 'Success') {
    throw new Error(`SerpApi (${engine}) search failed: ${meta.error ?? status}`);
  }
}

// ── google_shopping — candidate search (add-time only) ─────────────────

interface GoogleShoppingResponse {
  shopping_results?: {
    title?: string;
    product_id?: string;
    immersive_product_page_token?: string;
    extracted_price?: number;
    source?: string;
    product_link?: string;
  }[];
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Returns every candidate with a title, product_id, and price; no
 * relevance filtering here — that's `domain/watchlist-result-filter.ts`
 * and `providers/anthropic.ts#validateShoppingCandidates`'s job, one
 * layer up, since it needs the query plan's exclude terms and (for the
 * LLM step) real API access this function deliberately doesn't have.
 * `immersive_product_page_token` is captured whenever present — it's
 * optional on the response (never confirmed missing in practice, but
 * not documented as guaranteed either), so a candidate without one still
 * comes through rather than being dropped; it just can't be checked for
 * a price later (see `services/watchlist.service.ts#checkWatchlistItemPrice`).
 */
export function parseGoogleShoppingCandidates(data: unknown): ProductCandidate[] {
  const response = data as GoogleShoppingResponse;
  return (response.shopping_results ?? [])
    .filter(
      (
        result,
      ): result is typeof result & {
        title: string;
        product_id: string;
        extracted_price: number;
      } =>
        typeof result.title === 'string' &&
        typeof result.product_id === 'string' &&
        typeof result.extracted_price === 'number',
    )
    .map((result) => ({
      productId: result.product_id,
      pageToken: result.immersive_product_page_token ?? null,
      title: result.title,
      // extracted_price is an ordinary decimal dollar amount — converted
      // to integer minor units here, once, at the system boundary. See
      // docs/CLAUDE.md: "Never store money as a float."
      unitPriceMinor: Math.round(result.extracted_price * 100),
      currency: 'USD',
      sellerName: result.source ?? null,
      productLink: result.product_link ?? null,
    }));
}

/**
 * Searches Google Shopping for `query`, returning every priced candidate
 * found (possibly none). No price-range parameter is sent here — SerpApi's
 * `google_shopping` engine was confirmed live (2026-09-15) to silently
 * ignore both its documented `tbs=mr:1,price:1,ppr_min:X,ppr_max:Y`
 * filter and the `low_price`/`high_price` params: an impossible range
 * ($99,999-$100,000) still returned ordinary accessory listings
 * unfiltered. Expected-price-range filtering happens after the fact
 * instead, against the returned candidates — see
 * `domain/watchlist-candidates.ts#filterByExpectedPriceRange`.
 */
export async function searchProductCandidates(query: string): Promise<ProductCandidate[]> {
  const apiKey = requireApiKey();
  const url = new URL(SEARCH_URL);
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpApi (google_shopping) responded ${String(response.status)}`);
  }

  const data: unknown = await response.json();
  assertSerpApiSucceeded(data, 'google_shopping');
  return parseGoogleShoppingCandidates(data);
}

// ── google_immersive_product — offers for a known product (check-time only) ──

/**
 * Thrown when SerpApi rejects a `page_token` as invalid — confirmed live
 * (2026-09-15) that this is SerpApi's exact wording (backtick-quoted, no
 * `search_metadata` on the response at all): `"Invalid \`page_token\`
 * parameter."`, HTTP 400. Distinguished from other failures with its own
 * error type, not string-matched at the call site, so
 * `checkWatchlistItemPrice` can treat an expired/invalid token the same
 * way it already treats a resolved product that stops returning offers —
 * `needs_reresolution`, not a raw error.
 */
export class InvalidPageTokenError extends Error {}

interface GoogleImmersiveProductResponse {
  product_results?: {
    stores?: {
      name?: string;
      link?: string;
      // A pre-extracted number, unlike google_product's total_price
      // string — no parseAmountSpan needed on the happy path. total
      // (the display string) is kept as a fallback in case a future
      // response omits extracted_total for some row, same
      // discard-on-failure posture parse-amount-span.ts documents.
      // Deliberately the *total* (base + shipping, and for carrier
      // financing offers, the full multi-month total) rather than the
      // headline price — a $9.99/mo financing offer isn't actually
      // cheaper than a $960 outright price, and this app tracks what
      // you'd actually pay. See docs/LEARNED.md's google_product
      // deprecation entry for a real example of this distinction
      // mattering (AT&T/Verizon listings showing a monthly `price` far
      // below the real `total`).
      extracted_total?: number;
      total?: string;
    }[];
  };
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Silently drops any seller row whose total doesn't parse (same
 * discard-on-failure posture `parse-amount-span.ts` itself documents)
 * rather than crashing the whole check over one malformed row.
 */
export function parseImmersiveProductOffers(data: unknown): ProductOffer[] {
  const response = data as GoogleImmersiveProductResponse;
  const stores = response.product_results?.stores ?? [];

  return stores
    .map((store): ProductOffer | null => {
      const unitPriceMinor =
        typeof store.extracted_total === 'number'
          ? Math.round(store.extracted_total * 100)
          : parseAmountSpan(store.total, 'USD');
      if (unitPriceMinor === null) return null;
      return {
        unitPriceMinor,
        currency: 'USD',
        sellerName: store.name ?? null,
        productLink: store.link ?? null,
      };
    })
    .filter((offer): offer is ProductOffer => offer !== null);
}

/**
 * Fetches current seller offers for one already-resolved product, by its
 * `pageToken` (see this file's own top-of-file doc comment for why this
 * replaced `product_id`-based lookup). Throws `InvalidPageTokenError`
 * specifically when SerpApi rejects the token — every other failure
 * (network, other 4xx/5xx, a real search failure per
 * `assertSerpApiSucceeded`) throws a plain `Error` instead, so the two
 * cases stay distinguishable at the call site.
 */
export async function getImmersiveProductOffers(pageToken: string): Promise<ProductOffer[]> {
  const apiKey = requireApiKey();
  const url = new URL(SEARCH_URL);
  url.searchParams.set('engine', 'google_immersive_product');
  url.searchParams.set('page_token', pageToken);
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  const data: unknown = await response.json();

  if (!response.ok) {
    const message = (data as SerpApiMetadata).error;
    if (typeof message === 'string' && message.includes('page_token')) {
      throw new InvalidPageTokenError(message);
    }
    throw new Error(
      `SerpApi (google_immersive_product) responded ${String(response.status)}${message ? `: ${message}` : ''}`,
    );
  }

  assertSerpApiSucceeded(data, 'google_immersive_product');
  return parseImmersiveProductOffers(data);
}
