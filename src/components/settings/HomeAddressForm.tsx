'use client';

import { useState, useTransition } from 'react';
import { setHomeAddressAction } from '@/app/(dashboard)/settings/actions';

export function HomeAddressForm({ homeAddress }: { homeAddress: string | null }) {
  const [address, setAddress] = useState(homeAddress ?? '');
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set('homeAddress', address);
        startTransition(() => {
          void setHomeAddressAction(formData);
        });
      }}
    >
      <input
        value={address}
        onChange={(event) => {
          setAddress(event.target.value);
        }}
        placeholder="Home address"
        aria-label="Home address"
        className="border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
      />
      <button
        type="submit"
        disabled={isPending || !address.trim()}
        className="bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface disabled:opacity-60"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
