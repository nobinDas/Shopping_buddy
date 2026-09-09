import Link from 'next/link';
import { SubscriptionForm } from '@/components/subscription/SubscriptionForm';
import { createSubscriptionAction } from '../actions';

export default function NewSubscriptionPage() {
  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <Link href="/subscriptions" className="font-mono text-xs text-ink-muted underline">
        ← Subscriptions
      </Link>
      <p className="mt-3 mb-5 font-display text-[28px] tracking-tight">Add subscription</p>
      <SubscriptionForm action={createSubscriptionAction} submitLabel="Add subscription" />
    </main>
  );
}
