import { getNeedsReviewSignals } from '@/server/db/queries/detection';
import { getPendingProposals, getResolvedProposals } from '@/server/db/queries/reconciliation';
import { ReviewList } from '@/components/review/ReviewList';

export default async function ReviewQueuePage() {
  const [needsReviewPending, needsReviewResolved, pendingProposals, resolvedProposals] =
    await Promise.all([
      getNeedsReviewSignals('pending'),
      getNeedsReviewSignals('resolved'),
      getPendingProposals(),
      getResolvedProposals(),
    ]);

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Review</p>

      <ReviewList
        needsReviewPending={needsReviewPending}
        needsReviewResolved={needsReviewResolved}
        pendingProposals={pendingProposals}
        resolvedProposals={resolvedProposals}
      />
    </main>
  );
}
