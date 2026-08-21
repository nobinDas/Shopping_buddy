import { SubscriptionForm } from '@/components/subscription/SubscriptionForm';
import { createSubscriptionAction } from '../actions';

export default function NewSubscriptionPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <p className="font-display text-2xl">Add subscription</p>
      <SubscriptionForm action={createSubscriptionAction} submitLabel="Add subscription" />
    </main>
  );
}
