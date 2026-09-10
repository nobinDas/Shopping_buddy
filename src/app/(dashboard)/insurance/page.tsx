import { format } from 'date-fns';
import Link from 'next/link';
import { getAllPolicies } from '@/server/db/queries/insurance';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';
import { PolicyList, type PolicyWithNextBillingDate } from '@/components/insurance/PolicyList';

export default async function InsurancePage() {
  const policies = await getAllPolicies();
  const today = format(new Date(), 'yyyy-MM-dd');

  // nextBillingDate is recomputed here, not trusted from the stored
  // column — same reason and same pattern as every other date-derived
  // display in this app (see (dashboard)/page.tsx, subscriptions/[id]).
  const withNextBillingDate: PolicyWithNextBillingDate[] = policies.map((policy) => ({
    ...policy,
    nextBillingDate: computeNextBillingDate({
      anchorDate: policy.anchorDate,
      cycle: policy.cycle,
      cycleDays: policy.cycleDays,
      asOf: today,
    }),
  }));

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="font-display text-[28px] tracking-tight">Insurance</p>

      <PolicyList policies={withNextBillingDate} />
    </main>
  );
}
