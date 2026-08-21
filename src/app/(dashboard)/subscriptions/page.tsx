import Link from 'next/link';
import { getAllSubscriptions } from '@/server/db/queries/subscriptions';
import { formatMoney } from '@/lib/money';
import { archiveSubscriptionAction } from './actions';

export default async function SubscriptionsPage() {
  const subscriptions = await getAllSubscriptions();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <p className="font-display text-2xl">Subscriptions</p>
        <Link href="/subscriptions/new" className="bg-ink px-3 py-2 font-mono text-sm text-surface">
          Add subscription
        </Link>
      </header>

      {subscriptions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing tracked yet. Add the first subscription you know you pay for.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-rule border-y border-rule">
          {subscriptions.map((sub) => (
            <li key={sub.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-ink">{sub.name}</p>
                <p className="font-mono text-xs text-ink-muted">
                  {sub.cycle} · {sub.status}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="font-mono text-sm text-ink">
                  {formatMoney({ amountMinor: sub.amountMinor, currency: sub.currency })}
                </p>
                <Link href={`/subscriptions/${sub.id}/edit`} className="font-mono text-sm underline">
                  Edit
                </Link>
                {sub.status !== 'archived' && (
                  <form action={archiveSubscriptionAction.bind(null, sub.id)}>
                    <button type="submit" className="font-mono text-sm text-flag underline">
                      Archive
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
