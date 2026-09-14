import Link from 'next/link';
import { SubscriptionForm } from '@/components/subscription/SubscriptionForm';
import { getProposalById } from '@/server/db/queries/reconciliation';
import { createSubscriptionAction } from '../actions';

interface NewSubscriptionPageProps {
  searchParams: Promise<{ proposalId?: string }>;
}

/**
 * Discovery proposals (docs/DECISIONS.md ADR-020) link here with
 * `?proposalId=…` instead of inserting a subscription directly — the
 * detected vendor/amount pre-fill the form, but cycle/anchor
 * date/category have no detected-signal equivalent and stay for the
 * user to fill in themselves, same as any other manual entry
 * (CLAUDE.md: "manual entry is the primary data source").
 */
export default async function NewSubscriptionPage({ searchParams }: NewSubscriptionPageProps) {
  const { proposalId } = await searchParams;
  const proposal = proposalId ? await getProposalById(proposalId) : undefined;
  const changes =
    proposal?.proposalType === 'discovery'
      ? (proposal.proposedChanges as {
          vendorKey: string;
          amountMinor: number | null;
          currency: string | null;
        })
      : undefined;

  return (
    <main className="flex min-h-screen flex-col gap-1 px-5 pt-6">
      <Link href="/subscriptions" className="font-mono text-xs text-ink-muted underline">
        ← Subscriptions
      </Link>
      <p className="mt-3 mb-5 font-display text-[28px] tracking-tight">Add subscription</p>
      <SubscriptionForm
        action={createSubscriptionAction}
        submitLabel="Add subscription"
        {...(changes && proposalId
          ? {
              proposalId,
              initialValues: {
                name: changes.vendorKey.replace(/\b\w/g, (c) => c.toUpperCase()),
                amountMinor: changes.amountMinor ?? 0,
                currency: changes.currency ?? 'USD',
                cycle: 'monthly' as const,
                cycleDays: null,
                anchorDate: new Date().toISOString().slice(0, 10),
                category: 'other' as const,
                notes: null,
              },
            }
          : {})}
      />
    </main>
  );
}
