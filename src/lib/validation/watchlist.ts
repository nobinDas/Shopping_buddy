import { z } from 'zod';

export const watchlistCategoryValues = [
  'electronics',
  'appliances',
  'furniture',
  'apparel',
  'beauty',
  'sports_outdoors',
  'toys_games',
  'home_kitchen',
  'books_media',
  'automotive',
  'other',
] as const;

/**
 * Validates the add-watchlist-item form's own fields (everything except
 * the product-resolution step, which happens server-side after this
 * validates) at the server-action boundary — see docs/CLAUDE.md,
 * "Zod-validate at every boundary." Mirrors
 * `lib/validation/subscription.ts`'s shape: name/category mandatory,
 * everything else optional, matching the user's own explicit "only a
 * few should be mandatory" requirement — at least one tracked seller
 * being the one cross-field rule worth a `.check()`.
 */
export const watchlistItemInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    category: z.enum(watchlistCategoryValues),
    brand: z.string().trim().min(1).nullable().optional(),
    variant: z.string().trim().min(1).nullable().optional(),
    notes: z.string().trim().min(1).nullable().optional(),
    expectedPriceMinMinor: z.number().int().nonnegative().nullable().optional(),
    expectedPriceMaxMinor: z.number().int().positive().nullable().optional(),
    expectedPriceCurrency: z
      .string()
      .trim()
      .length(3, 'Currency must be a 3-letter ISO-4217 code')
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
    trackedSellers: z.array(z.string().trim().min(1)).min(1, 'Add at least one store to track'),
  })
  .check((ctx) => {
    const { expectedPriceMinMinor, expectedPriceMaxMinor } = ctx.value;
    if (
      expectedPriceMinMinor != null &&
      expectedPriceMaxMinor != null &&
      expectedPriceMinMinor > expectedPriceMaxMinor
    ) {
      ctx.issues.push({
        code: 'custom',
        input: expectedPriceMinMinor,
        path: ['expectedPriceMinMinor'],
        message: 'Minimum price must not be greater than the maximum',
      });
    }
  });

export type WatchlistItemInput = z.infer<typeof watchlistItemInputSchema>;
