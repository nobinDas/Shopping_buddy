import { z } from 'zod';

export const cycleValues = ['monthly', 'quarterly', 'semiannual', 'annual', 'custom'] as const;
export const categoryValues = ['software', 'media', 'insurance', 'utility', 'other'] as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a subscription create/edit submission at the server-action
 * boundary — see docs/CLAUDE.md, "Zod-validate at every boundary." The
 * cycle/cycleDays cross-check mirrors domain/billing-cycle.ts's own
 * assertion; duplicating it here means a malformed submission is rejected
 * with a field-level message before it ever reaches domain code, which
 * throws instead.
 */
export const subscriptionInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    amountMinor: z.number().int().positive('Amount must be greater than zero'),
    currency: z
      .string()
      .trim()
      .length(3, 'Currency must be a 3-letter ISO-4217 code')
      .transform((value) => value.toUpperCase()),
    cycle: z.enum(cycleValues),
    cycleDays: z.number().int().positive().nullable().optional(),
    anchorDate: z.string().regex(isoDatePattern, 'Use YYYY-MM-DD'),
    category: z.enum(categoryValues),
    notes: z.string().trim().min(1).nullable().optional(),
  })
  .check((ctx) => {
    const { cycle, cycleDays } = ctx.value;
    if (cycle === 'custom') {
      if (!cycleDays || cycleDays <= 0) {
        ctx.issues.push({
          code: 'custom',
          input: cycleDays,
          path: ['cycleDays'],
          message: "cycleDays is required when cycle is 'custom'",
        });
      }
    } else if (cycleDays != null) {
      ctx.issues.push({
        code: 'custom',
        input: cycleDays,
        path: ['cycleDays'],
        message: `cycleDays must not be set when cycle is '${cycle}'`,
      });
    }
  });

export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;
