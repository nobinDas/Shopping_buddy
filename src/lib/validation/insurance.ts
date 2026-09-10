import { z } from 'zod';
import { cycleValues } from './subscription';

export const policyTypeValues = ['medical', 'auto'] as const;

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates an insurance policy create/edit submission at the server-action
 * boundary — see docs/CLAUDE.md, "Zod-validate at every boundary." The
 * cycle/cycleDays cross-check mirrors subscription.ts's schema exactly —
 * same underlying domain/billing-cycle.ts contract, same rule.
 */
export const insuranceInputSchema = z
  .object({
    type: z.enum(policyTypeValues),
    insurer: z.string().trim().min(1, 'Insurer is required'),
    policyNumber: z.string().trim().min(1, 'Policy number is required'),
    premiumMinor: z.number().int().positive('Premium must be greater than zero'),
    currency: z
      .string()
      .trim()
      .length(3, 'Currency must be a 3-letter ISO-4217 code')
      .transform((value) => value.toUpperCase()),
    cycle: z.enum(cycleValues),
    cycleDays: z.number().int().positive().nullable().optional(),
    anchorDate: z.string().regex(isoDatePattern, 'Use YYYY-MM-DD'),
    reminderLeadDays: z.number().int().positive('Reminder lead time must be greater than zero'),
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

export type InsuranceInput = z.infer<typeof insuranceInputSchema>;
