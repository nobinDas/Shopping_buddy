import { addMonths, format } from 'date-fns';
import { calculateMonthlyBurn, type BurnSubscription } from '@/server/domain/burn';
import { computeNextBillingDate, occurrencesInWindow } from '@/server/domain/billing-cycle';
import { getActiveSubscriptions } from '@/server/db/queries/subscriptions';
import { createClient } from '@/server/providers/supabase';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { BurnRibbon, type RibbonBand } from '@/components/dashboard/BurnRibbon';
import { RenewalReminder } from '@/components/insurance/RenewalReminder';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const activeSubscriptions = await getActiveSubscriptions();
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

  const burnInput: BurnSubscription[] = activeSubscriptions.map((sub) => ({
    amountMinor: sub.amountMinor,
    currency: sub.currency,
    cycle: sub.cycle,
    cycleDays: sub.cycleDays,
  }));

  const monthlyBurn = calculateMonthlyBurn(burnInput);
  // Annualising is just ×12 on an already-integer minor-unit value, so it
  // stays exact — no second rounding step needed the way a cycle
  // conversion does in burn.ts.
  const annualizedBurn = monthlyBurn.map((m) => ({ ...m, amountMinor: m.amountMinor * 12 }));

  // Burn ribbon: one band per billing occurrence in the next twelve months,
  // not one per subscription — a monthly subscription bills up to twelve
  // times in this window and each occurrence gets its own mark, which is
  // what makes clustering visible. See docs/DESIGN.md.
  const windowEnd = format(addMonths(new Date(), 12), 'yyyy-MM-dd');
  const ribbonBands: RibbonBand[] = activeSubscriptions.flatMap((sub) =>
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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 p-8">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl">Overhead</p>
        <div className="flex items-center gap-4">
          <p className="font-mono text-sm text-ink-muted">{user?.email}</p>
          <form action={signOut}>
            <button type="submit" className="font-mono text-sm text-flag underline">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <RenewalReminder
        insurer="State Farm"
        premiumMinor={84000}
        currency="USD"
        renewalDate="2026-11-20"
      />

      {activeSubscriptions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing tracked yet. Add the first subscription you know you pay for.
          </p>
        </div>
      ) : (
        <>
          <section>
            <BurnRibbon bands={ribbonBands} windowStart={today} windowEnd={windowEnd} />
          </section>

          <section className="grid grid-cols-2 gap-6">
            <div className="rounded border border-rule bg-surface-2 p-6">
              <p className="text-xs tracking-wide text-ink-muted uppercase">Monthly burn</p>
              <dl className="mt-2 flex flex-col gap-1">
                {monthlyBurn.map((m) => (
                  <dd key={m.currency} className="font-mono text-2xl text-ink">
                    {formatMoney(m)}
                  </dd>
                ))}
              </dl>
            </div>
            <div className="rounded border border-rule bg-surface-2 p-6">
              <p className="text-xs tracking-wide text-ink-muted uppercase">Annualised burn</p>
              <dl className="mt-2 flex flex-col gap-1">
                {annualizedBurn.map((m) => (
                  <dd key={m.currency} className="font-mono text-2xl text-ink">
                    {formatMoney(m)}
                  </dd>
                ))}
              </dl>
            </div>
          </section>

          <section>
            <h2 className="text-xs tracking-wide text-ink-muted uppercase">Upcoming billing</h2>
            <ul className="mt-3 flex flex-col divide-y divide-rule border-y border-rule">
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
