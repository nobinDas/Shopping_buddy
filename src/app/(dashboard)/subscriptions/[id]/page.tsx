import { format } from 'date-fns';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getSubscriptionById,
  getPriceHistoryForSubscription,
} from '@/server/db/queries/subscriptions';
import { computeNextBillingDate } from '@/server/domain/billing-cycle';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

interface SubscriptionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SubscriptionDetailPage({ params }: SubscriptionDetailPageProps) {
  const { id } = await params;
  const subscription = await getSubscriptionById(id);

  if (!subscription) {
    notFound();
  }

  const history = await getPriceHistoryForSubscription(id);
  const today = format(new Date(), 'yyyy-MM-dd');
  const nextBillingDate = computeNextBillingDate({
    anchorDate: subscription.anchorDate,
    cycle: subscription.cycle,
    cycleDays: subscription.cycleDays,
    asOf: today,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/subscriptions" className="font-mono text-xs text-ink-muted underline">
            ← Subscriptions
          </Link>
          <p className="mt-2 font-display text-2xl">{subscription.name}</p>
          <p className="font-mono text-xs text-ink-muted">
            {subscription.cycle} · {subscription.category} · {subscription.status}
          </p>
        </div>
        <Link
          href={`/subscriptions/${subscription.id}/edit`}
          className="bg-ink px-3 py-2 font-mono text-sm text-surface"
        >
          Edit
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-6">
        <div className="rounded border border-rule bg-surface-2 p-6">
          <p className="text-xs tracking-wide text-ink-muted uppercase">Current price</p>
          <p className="mt-2 font-mono text-2xl text-ink">
            {formatMoney({
              amountMinor: subscription.amountMinor,
              currency: subscription.currency,
            })}
          </p>
        </div>
        <div className="rounded border border-rule bg-surface-2 p-6">
          <p className="text-xs tracking-wide text-ink-muted uppercase">Next billing date</p>
          <p className="mt-2 font-mono text-2xl text-ink">{formatDate(nextBillingDate)}</p>
        </div>
      </section>

      {subscription.notes && (
        <section>
          <h2 className="text-xs tracking-wide text-ink-muted uppercase">Notes</h2>
          <p className="mt-2 text-sm text-ink">{subscription.notes}</p>
        </section>
      )}

      <section>
        <h2 className="text-xs tracking-wide text-ink-muted uppercase">Price history</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">No price history recorded yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-rule border-y border-rule">
            {history.map((entry, index) => {
              const previous = history[index - 1];
              const sameCurrencyChange = previous?.currency === entry.currency;
              const increased = sameCurrencyChange && entry.amountMinor > previous.amountMinor;

              return (
                <li key={entry.id} className="flex items-center justify-between py-3">
                  {index === 0 ? (
                    <p className="text-sm text-ink">
                      Started at{' '}
                      <span className="font-mono">
                        {formatMoney({ amountMinor: entry.amountMinor, currency: entry.currency })}
                      </span>
                    </p>
                  ) : (
                    <p className={`text-sm ${increased ? 'text-flag' : 'text-ink'}`}>
                      {sameCurrencyChange ? (
                        <>
                          Went from{' '}
                          <span className="font-mono">
                            {formatMoney({
                              amountMinor: previous.amountMinor,
                              currency: previous.currency,
                            })}
                          </span>{' '}
                          to{' '}
                          <span className="font-mono">
                            {formatMoney({
                              amountMinor: entry.amountMinor,
                              currency: entry.currency,
                            })}
                          </span>
                        </>
                      ) : (
                        <>
                          Changed to{' '}
                          <span className="font-mono">
                            {formatMoney({
                              amountMinor: entry.amountMinor,
                              currency: entry.currency,
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                  <p className="font-mono text-xs text-ink-muted">
                    {formatDate(entry.effectiveFrom)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
