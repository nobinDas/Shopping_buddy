'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Mock data, matching every other Phase 1.5-style screen's pattern — local
 * state, no backend. Fits Phase 3's already-scoped "optional store
 * preference" (docs/PHASES.md) rather than new product scope: this is the
 * list offered when picking a store for a shopping item (see
 * shopping/page.tsx's own STORE_OPTIONS, kept independently mocked here —
 * no shared state between the two screens yet).
 */
interface MockStore {
  name: string;
  meta: string;
}

const initialStores: MockStore[] = [
  { name: "Trader Joe's", meta: 'GROCERY' },
  { name: 'Costco', meta: 'HOUSEHOLD' },
  { name: 'Eastside Market', meta: 'GROCERY' },
  { name: 'Harbor Hardware', meta: 'HOUSEHOLD' },
];

export default function PreferredStoresPage() {
  const [stores, setStores] = useState<MockStore[]>(initialStores);
  const [draft, setDraft] = useState('');

  function addStore() {
    const name = draft.trim();
    if (!name || stores.some((store) => store.name === name)) {
      setDraft('');
      return;
    }
    setStores((current) => [...current, { name, meta: 'NO CATEGORY SET' }]);
    setDraft('');
  }

  function removeStore(name: string) {
    setStores((current) => current.filter((store) => store.name !== name));
  }

  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Preferred stores</p>
      <p className="mb-5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
        The stores offered when you set an item&apos;s store, and the ones trips are routed
        through.
      </p>

      <div className="border-t border-rule">
        {stores.map((store) => (
          <div
            key={store.name}
            className="flex items-center justify-between gap-3 border-b border-rule py-3.5"
          >
            <div>
              <p className="mb-0.5 font-sans text-[15px] font-medium text-ink">{store.name}</p>
              <p className="font-mono text-[11px] text-ink-muted">{store.meta}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                removeStore(store.name);
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
          className="flex-none bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface"
        >
          Add
        </button>
      </div>
    </main>
  );
}
