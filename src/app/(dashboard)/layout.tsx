import { BottomNav } from '@/components/dashboard/BottomNav';

// Mobile-first shell: every screen under (dashboard) renders inside this
// same scrollable content area with a persistent bottom tab bar, per the
// "Overhead Mobile" design (docs/DECISIONS.md). pb-24 keeps content clear
// of the 66px fixed nav plus safe-area breathing room; max-w-lg matches
// the nav's own width so wider viewports don't stretch the tab bar full
// width while the page content stays comfortably narrow.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
