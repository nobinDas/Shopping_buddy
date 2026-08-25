import Link from 'next/link';
import { differenceInCalendarDays } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

/**
 * Phase 1.5 mock data — no insurance cost category exists yet (Phase 2).
 * Renders one hardcoded reminder on the real dashboard so the concept is
 * visible now; Phase 2 replaces the caller's hardcoded prop with a real
 * query for whichever policies fall inside their own reminder lead time.
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
  const daysRemaining = differenceInCalendarDays(new Date(renewalDate), new Date());

  return (
    <Alert className="border-flag">
      <AlertTitle className="text-flag">
        {insurer} renews in {daysRemaining} days
      </AlertTitle>
      <AlertDescription>
        <Link href="/insurance" className="underline">
          {formatMoney({ amountMinor: premiumMinor, currency })} due {formatDate(renewalDate)}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
