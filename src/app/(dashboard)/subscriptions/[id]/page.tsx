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
import { archiveSubscriptionAction, restoreSubscriptionAction } from '../actions';

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

  const archived = subscription.status === 'archived';

  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <Link href="/subscriptions" className="font-mono text-xs text-ink-muted underline">
        ← Subscriptions
      </Link>

      <p className="mt-3 font-display text-[28px] leading-[1.1] tracking-tight">
        {subscription.name}
      </p>

      <div className="mt-4 mb-1 flex items-baseline gap-2.5">
        <span
          className={`font-mono text-4xl leading-none ${archived ? 'text-ink-muted' : 'text-ink'}`}
        >
          {formatMoney({ amountMinor: subscription.amountMinor, currency: subscription.currency })}
        </span>
        <span className="text-[13px] text-ink-muted">
          per {subscription.cycle.replace(/ly$/, '')}
        </span>
      </div>
      <p className="mb-5 font-mono text-xs text-ink-muted">
        {archived ? 'NOT BILLING' : `NEXT BILLED ${formatDate(nextBillingDate)} · RECOMPUTED`}
      </p>

      <div className="grid grid-cols-2 border-t border-b border-rule">
        <div className="py-3">
          <p className="mb-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">Cycle</p>
          <p className="text-sm text-ink">{subscription.cycle}</p>
        </div>
        <div className="py-3">
          <p className="mb-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">
            Started
          </p>
          <p className="font-mono text-sm text-ink">{formatDate(subscription.anchorDate)}</p>
        </div>
        <div className="col-span-2 border-t border-rule py-3">
          <p className="mb-1 font-mono text-[10px] tracking-wide text-ink-muted uppercase">Notes</p>
          <p className="text-sm leading-relaxed text-ink">{subscription.notes ?? '—'}</p>
        </div>
      </div>

      <h2 className="mt-5 mb-0 font-mono text-[11px] tracking-wide text-ink-muted uppercase">
        Price history
      </h2>
      {history.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">No price history recorded yet.</p>
      ) : (
        <ul>
          {history.map((entry, index) => {
            const previous = history[index - 1];
            const sameCurrencyChange = previous?.currency === entry.currency;
            const increased = sameCurrencyChange && entry.amountMinor > previous.amountMinor;

            return (
              <li
                key={entry.id}
                className="flex items-start justify-between gap-3 border-b border-rule py-3"
              >
                {index === 0 ? (
                  <p className="text-[13px] leading-normal text-ink">
                    Started at{' '}
                    <span className="font-mono">
                      {formatMoney({ amountMinor: entry.amountMinor, currency: entry.currency })}
                    </span>
                  </p>
                ) : (
                  <p
                    className={`text-[13px] leading-normal ${increased ? 'text-flag' : 'text-ink'}`}
                  >
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
                <p className="font-mono text-[11px] whitespace-nowrap text-ink-muted">
                  {formatDate(entry.effectiveFrom)}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex gap-2.5">
        <Link
          href={`/subscriptions/${subscription.id}/edit`}
          className="flex-1 bg-ink py-3 text-center font-sans text-sm font-medium text-surface"
        >
          Edit
        </Link>
        {archived ? (
          <form action={restoreSubscriptionAction.bind(null, subscription.id)} className="flex-1">
            <button
              type="submit"
              className="w-full border border-control-border py-3 font-sans text-sm font-medium text-ink"
            >
              Restore
            </button>
          </form>
        ) : (
          <form action={archiveSubscriptionAction.bind(null, subscription.id)} className="flex-1">
            <button
              type="submit"
              className="w-full border border-control-border py-3 font-sans text-sm font-medium text-ink"
            >
              Archive
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
