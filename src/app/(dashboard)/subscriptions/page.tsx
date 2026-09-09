import Link from 'next/link';
import { getAllSubscriptions } from '@/server/db/queries/subscriptions';
import { formatMoney } from '@/lib/money';

export default async function SubscriptionsPage() {
  const subscriptions = await getAllSubscriptions();
  const activeCount = subscriptions.filter((sub) => sub.status !== 'archived').length;
  const archivedCount = subscriptions.length - activeCount;

  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <header className="flex items-baseline justify-between pb-3.5">
        <p className="font-display text-[28px] leading-none tracking-tight">Subscriptions</p>
        <Link
          href="/subscriptions/new"
          className="border border-control-border px-3 py-2 font-sans text-xs font-medium"
        >
          New
        </Link>
      </header>

      {subscriptions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing tracked yet. Add the first subscription you know you pay for.
          </p>
        </div>
      ) : (
        <>
          <p className="border-b border-rule pb-2.5 font-mono text-[11px] text-ink-muted uppercase">
            {subscriptions.length} subscription{subscriptions.length === 1 ? '' : 's'} ·{' '}
            {activeCount} active · {archivedCount} archived
          </p>
          <ul>
            {subscriptions.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={`/subscriptions/${sub.id}`}
                  className={`flex items-start justify-between gap-3 border-b border-rule py-3.5 ${
                    sub.status === 'archived' ? 'opacity-55' : ''
                  }`}
                >
                  <span>
                    <span className="block font-sans text-[15px] font-medium text-ink">
                      {sub.name}
                    </span>
                    <span className="block font-mono text-[11px] text-ink-muted">
                      {sub.cycle.toUpperCase()}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-mono text-[15px] text-ink">
                      {formatMoney({ amountMinor: sub.amountMinor, currency: sub.currency })}
                    </span>
                    {sub.status === 'archived' && (
                      <span className="mt-1 block font-mono text-[10px] tracking-wide text-ink-muted uppercase">
                        Archived
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
