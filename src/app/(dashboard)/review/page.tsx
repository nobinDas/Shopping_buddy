import { getNeedsReviewSignals } from '@/server/db/queries/detection';
import { ReviewList } from '@/components/review/ReviewList';

export default async function ReviewQueuePage() {
  const [needsReviewPending, needsReviewResolved] = await Promise.all([
    getNeedsReviewSignals('pending'),
    getNeedsReviewSignals('resolved'),
  ]);

  return (
    <main className="flex min-h-screen flex-col gap-4 px-5 pt-6">
      <p className="font-display text-[28px] tracking-tight">Review</p>

      <ReviewList needsReviewPending={needsReviewPending} needsReviewResolved={needsReviewResolved} />
    </main>
  );
}
