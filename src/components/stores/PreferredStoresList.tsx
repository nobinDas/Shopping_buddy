'use client';

import { useState, useTransition } from 'react';
import type { PreferredStoreRow } from '@/server/db/queries/stores';
import { addStoreAction, removeStoreAction } from '@/app/(dashboard)/stores/actions';

export function PreferredStoresList({ stores }: { stores: PreferredStoreRow[] }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [isPending, startTransition] = useTransition();

  function addStore() {
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) return;
    const formData = new FormData();
    formData.set('name', trimmedName);
    formData.set('address', trimmedAddress);
    setName('');
    setAddress('');
    startTransition(() => {
      void addStoreAction(formData);
    });
  }

  function removeStore(id: string) {
    startTransition(() => {
      void removeStoreAction(id);
    });
  }

  return (
    <>
      <div className="border-t border-rule">
        {stores.map((store) => {
          return (
            <div
              key={store.id}
              className="flex items-start justify-between gap-3 border-b border-rule py-3.5"
            >
              <div>
                <p className="font-sans text-[15px] font-medium text-ink">{store.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{store.address}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {store.openingHoursText?.[0] ?? 'Hours not found'}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  removeStore(store.id);
                }}
                className="flex-none p-1 font-mono text-[11px] text-ink-muted hover:text-flag"
              >
                REMOVE
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Store name"
          aria-label="Store name"
          className="border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        <input
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addStore();
          }}
          placeholder="Address"
          aria-label="Address"
          className="border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        <button
          type="button"
          onClick={addStore}
          disabled={isPending || !name.trim() || !address.trim()}
          className="bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </>
  );
}
