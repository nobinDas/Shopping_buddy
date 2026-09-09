'use client';

import { useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

/**
 * Phase 1.5 mock data — no insurance cost category exists yet (Phase 2).
 * Renders one hardcoded reminder on the real dashboard so the concept is
 * visible now; Phase 2 replaces the caller's hardcoded prop with a real
 * query for whichever policies fall inside their own reminder lead time.
 *
 * Dismissal is local, per-render state, not persisted — there's nowhere to
 * persist it yet (no insurance table). Phase 2's real version would likely
 * track a per-policy "reminder seen" flag instead of a client-only dismiss.
 */
interface RenewalReminderProps {
  insurer: string;
  premiumMinor: number;
  currency: string;
  renewalDate: string;
}

export function RenewalReminder({
  insurer,
  premiumMinor,
  currency,
  renewalDate,
}: RenewalReminderProps) {
  const [dismissed, setDismissed] = useState(false);
  const daysRemaining = differenceInCalendarDays(new Date(renewalDate), new Date());

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 bg-surface-2 px-3.5 py-3">
      <div className="flex-1">
        <p className="mb-1 font-mono text-[11px] font-semibold tracking-wide text-pending uppercase">
          Renews in {daysRemaining} days
        </p>
        <p className="text-[13px] text-ink">
          <Link href="/insurance" className="underline">
            {insurer} renews {formatDate(renewalDate)} at{' '}
            {formatMoney({ amountMinor: premiumMinor, currency })}.
          </Link>
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
        }}
        className="px-0.5 font-mono text-lg leading-none text-ink-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
