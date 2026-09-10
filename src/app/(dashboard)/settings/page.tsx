import Link from 'next/link';
import { getHomeAddress } from '@/server/db/queries/settings';
import { HomeAddressForm } from '@/components/settings/HomeAddressForm';

export default async function SettingsPage() {
  const homeAddress = await getHomeAddress();

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Settings</p>
      <p className="mb-5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        Home address — the starting point Trips routes from.
      </p>

      <HomeAddressForm homeAddress={homeAddress} />
    </main>
  );
}
