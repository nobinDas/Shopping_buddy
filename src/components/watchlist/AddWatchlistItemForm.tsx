'use client';

import { useState, useTransition } from 'react';
import { addWatchlistItemAction } from '@/app/(dashboard)/watchlist/actions';

export function AddWatchlistItemForm() {
  const [name, setName] = useState('');
  const [isPending, startTransition] = useTransition();

  function addItem() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const formData = new FormData();
    formData.set('name', trimmed);
    setName('');
    startTransition(() => {
      void addWatchlistItemAction(formData);
    });
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') addItem();
        }}
        placeholder="Add an item to watch"
        aria-label="Add an item to watch"
        className="min-w-0 flex-1 border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
      />
      <button
        type="button"
        onClick={addItem}
        disabled={isPending || !name.trim()}
        className="flex-none bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface disabled:opacity-60"
      >
        Add
      </button>
    </div>
  );
}
