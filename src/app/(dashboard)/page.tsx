import { addMonths, format } from 'date-fns';
import {
  calculateMonthlyBurn,
  groupOccurrencesByMonth,
  type BurnOccurrence,
  type BurnSubscription,
} from '@/server/domain/burn';
import { computeNextBillingDate, occurrencesInWindow } from '@/server/domain/billing-cycle';
import { getActiveSubscriptions } from '@/server/db/queries/subscriptions';
import { getActivePolicies } from '@/server/db/queries/insurance';
import { createClient } from '@/server/providers/supabase';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { BurnMonths } from '@/components/dashboard/BurnMonths';
import { RenewalReminder } from '@/components/insurance/RenewalReminder';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeSubscriptions = await getActiveSubscriptions();
  const activePolicies = await getActivePolicies();
  const today = format(new Date(), 'yyyy-MM-dd');

  // next_billing_date is recomputed here rather than trusted from the
  // stored column. Nothing in the codebase writes to that column yet — the
  // create/edit subscription flow (PHASES.md, Phase 1a) isn't built, so
  // there's no guarantee it's been kept fresh for any given row. Recomputing
  // from anchorDate + cycle is always correct regardless of write-path
  // history; safe to drop in favour of the stored column later purely for
  // performance, once that flow exists and is trusted, but not for
  // correctness — this data volume never makes recomputing expensive.
  const upcoming = activeSubscriptions
    .map((sub) => ({
      ...sub,
      nextBillingDate: computeNextBillingDate({
        anchorDate: sub.anchorDate,
        cycle: sub.cycle,
        cycleDays: sub.cycleDays,
        asOf: today,
      }),
    }))
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  // Insurance folds into the same aggregate burn a subscription would —
  // see docs/DECISIONS.md ADR (Phase 2): a policy's premium/cycle/anchor
  // shape is the same recurring-cost shape a subscription's is, so it
  // flows through calculateMonthlyBurn unchanged rather than needing a
  // second, parallel calculation.
  const burnInput: BurnSubscription[] = [
    ...activeSubscriptions.map((sub) => ({
      amountMinor: sub.amountMinor,
      currency: sub.currency,
      cycle: sub.cycle,
      cycleDays: sub.cycleDays,
    })),
    ...activePolicies.map((policy) => ({
      amountMinor: policy.premiumMinor,
      currency: policy.currency,
      cycle: policy.cycle,
      cycleDays: policy.cycleDays,
    })),
  ];

  const monthlyBurn = calculateMonthlyBurn(burnInput);
  // Annualising is just ×12 on an already-integer minor-unit value, so it
  // stays exact — no second rounding step needed the way a cycle
  // conversion does in burn.ts.
  const annualizedBurn = monthlyBurn.map((m) => ({ ...m, amountMinor: m.amountMinor * 12 }));

  // Monthly drill-down: one occurrence per billing event in the next twelve
  // months, not one per subscription — a monthly subscription bills up to
  // twelve times in this window. groupOccurrencesByMonth buckets these into
  // the 12 calendar months the tap-a-month chart renders. See docs/DESIGN.md.
  const windowEnd = format(addMonths(new Date(), 12), 'yyyy-MM-dd');
  const occurrences: BurnOccurrence[] = activeSubscriptions.flatMap((sub) =>
    occurrencesInWindow({
      anchorDate: sub.anchorDate,
      cycle: sub.cycle,
      cycleDays: sub.cycleDays,
      windowStart: today,
      windowEnd,
    }).map((date) => ({
      id: `${sub.id}-${date}`,
      subscriptionId: sub.id,
      name: sub.name,
      amountMinor: sub.amountMinor,
      currency: sub.currency,
      date,
    })),
  );
  const monthlyBuckets = groupOccurrencesByMonth(occurrences, today);

  // One reminder per policy whose next renewal falls inside its own
  // reminderLeadDays — replaces the single hardcoded RenewalReminder call
  // this dashboard used before Phase 2. 0, 1, or many.
  const dueReminders = activePolicies
    .map((policy) => ({
      ...policy,
      nextBillingDate: computeNextBillingDate({
        anchorDate: policy.anchorDate,
        cycle: policy.cycle,
        cycleDays: policy.cycleDays,
        asOf: today,
      }),
    }))
    .filter((policy) => {
      const daysUntil = Math.round(
        (new Date(policy.nextBillingDate).getTime() - new Date(today).getTime()) / 86_400_000,
      );
      return daysUntil <= policy.reminderLeadDays;
    });

  return (
    <main className="flex min-h-screen flex-col gap-5 px-5 pt-6">
      <header className="flex items-center justify-between">
        <p className="font-display text-lg">Overhead</p>
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs text-ink-muted">{user?.email}</p>
          <form action={signOut}>
            <button type="submit" className="font-mono text-xs text-flag underline">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {activeSubscriptions.length === 0 && activePolicies.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing tracked yet. Add the first subscription you know you pay for.
          </p>
        </div>
      ) : (
        <>
          <section className="flex items-end justify-between">
            <div>
              <p className="mb-1.5 font-mono text-[11px] tracking-wide text-ink-muted uppercase">
                Monthly burn
              </p>
              {monthlyBurn.map((m) => (
                <p key={m.currency} className="font-mono text-4xl leading-none text-ink">
                  {formatMoney(m)}
                </p>
              ))}
            </div>
            <div className="text-right">
              <p className="mb-1.5 font-mono text-[11px] tracking-wide text-ink-muted uppercase">
                Annualised
              </p>
              {annualizedBurn.map((m) => (
                <p key={m.currency} className="font-mono text-xl leading-none text-ink">
                  {formatMoney(m)}
                </p>
              ))}
            </div>
          </section>

          {dueReminders.map((policy) => (
            <RenewalReminder
              key={policy.id}
              insurer={policy.insurer}
              premiumMinor={policy.premiumMinor}
              currency={policy.currency}
              renewalDate={policy.nextBillingDate}
            />
          ))}

          <section>
            <BurnMonths months={monthlyBuckets} />
          </section>

          <section>
            <h2 className="mb-2 font-mono text-[11px] tracking-wide text-ink-muted uppercase">
              Upcoming billing
            </h2>
            <ul className="flex flex-col divide-y divide-rule border-y border-rule">
              {upcoming.map((sub) => (
                <li key={sub.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-ink">{sub.name}</p>
                    <p className="font-mono text-xs text-ink-muted">
                      {formatDate(sub.nextBillingDate)}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-ink">
                    {formatMoney({ amountMinor: sub.amountMinor, currency: sub.currency })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
