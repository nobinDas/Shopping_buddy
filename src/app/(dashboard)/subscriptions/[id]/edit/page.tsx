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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <p className="font-display text-2xl">Edit {subscription.name}</p>
      <SubscriptionForm
        action={action}
        submitLabel="Save changes"
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
