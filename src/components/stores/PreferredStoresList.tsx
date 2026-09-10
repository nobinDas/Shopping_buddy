'use client';

import { useState, useTransition } from 'react';
import type { PreferredStoreRow } from '@/server/db/queries/stores';
import { addStoreAction, removeStoreAction } from '@/app/(dashboard)/stores/actions';

export function PreferredStoresList({ stores }: { stores: PreferredStoreRow[] }) {
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function addStore() {
    const name = draft.trim();
    if (!name) return;
    const formData = new FormData();
    formData.set('name', name);
    setDraft('');
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
        {stores.map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between gap-3 border-b border-rule py-3.5"
          >
            <p className="font-sans text-[15px] font-medium text-ink">{store.name}</p>
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
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') addStore();
          }}
          placeholder="Add a store"
          aria-label="Add a store"
          className="min-w-0 flex-1 border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        <button
          type="button"
          onClick={addStore}
          disabled={isPending}
          className="flex-none bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </>
  );
}
