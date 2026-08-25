import { Skeleton } from '@/components/ui/skeleton';

/**
 * Next.js route-segment loading UI — shown automatically while an async
 * Server Component in this group (or any nested route without its own
 * loading.tsx) is fetching. Shape is generic on purpose: it covers every
 * page under (dashboard), not one specific layout.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </main>
  );
}
