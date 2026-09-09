import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSubscriptionById } from '@/server/db/queries/subscriptions';
import { SubscriptionForm } from '@/components/subscription/SubscriptionForm';
import { updateSubscriptionAction } from '../../actions';

interface EditSubscriptionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSubscriptionPage({ params }: EditSubscriptionPageProps) {
  const { id } = await params;
  const subscription = await getSubscriptionById(id);

  if (!subscription) {
    notFound();
  }

  const action = updateSubscriptionAction.bind(null, subscription.id);

  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <Link
        href={`/subscriptions/${subscription.id}`}
        className="font-mono text-xs text-ink-muted underline"
      >
        ← {subscription.name}
      </Link>
      <p className="mt-3 mb-5 font-display text-[28px] tracking-tight">Edit {subscription.name}</p>
      <SubscriptionForm
        action={action}
        submitLabel="Save changes"
        cancelHref={`/subscriptions/${subscription.id}`}
        initialValues={{
          name: subscription.name,
          amountMinor: subscription.amountMinor,
          currency: subscription.currency,
          cycle: subscription.cycle,
          cycleDays: subscription.cycleDays,
          anchorDate: subscription.anchorDate,
          category: subscription.category,
          notes: subscription.notes,
        }}
      />
    </main>
  );
}
