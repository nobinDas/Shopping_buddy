'use client';

import { useEffect, useState, useTransition } from 'react';
import type { PreferredStoreRow } from '@/server/db/queries/stores';
import {
  addStoreAction,
  getAddressSuggestionsAction,
  removeStoreAction,
} from '@/app/(dashboard)/stores/actions';
import type { AddressSuggestion } from '@/server/providers/google-maps';

const ADDRESS_SUGGEST_DEBOUNCE_MS = 300;

export function PreferredStoresList({ stores }: { stores: PreferredStoreRow[] }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const query = address.trim();
    const timer = setTimeout(() => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      void getAddressSuggestionsAction(query).then((results) => {
        setSuggestions(results);
      });
    }, ADDRESS_SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [address]);

  function selectSuggestion(suggestion: AddressSuggestion) {
    setAddress(suggestion.description);
    setSelectedPlaceId(suggestion.placeId);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function addStore() {
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    // Requires a suggestion pick, not just typed text — selectedPlaceId only
    // gets set by selectSuggestion, and clears the moment the address is
    // hand-edited afterward, so it can't go stale against a changed address.
    if (!trimmedName || !trimmedAddress || !selectedPlaceId) return;
    const formData = new FormData();
    formData.set('name', trimmedName);
    formData.set('address', trimmedAddress);
    formData.set('placeId', selectedPlaceId);
    setName('');
    setAddress('');
    setSelectedPlaceId(null);
    setSuggestions([]);
    setShowSuggestions(false);
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
        <div className="relative">
          <input
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setSelectedPlaceId(null);
              setShowSuggestions(true);
            }}
            onFocus={() => {
              setShowSuggestions(true);
            }}
            onBlur={() => {
              // Delay so a click on a suggestion registers before the list unmounts.
              setTimeout(() => {
                setShowSuggestions(false);
              }, 150);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addStore();
            }}
            placeholder="Address"
            aria-label="Address"
            autoComplete="off"
            className="w-full border border-control-border bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto border border-control-border bg-surface shadow-md">
              {suggestions.map((suggestion) => (
                <li key={suggestion.placeId}>
                  <button
                    type="button"
                    onClick={() => {
                      selectSuggestion(suggestion);
                    }}
                    className="block w-full px-3 py-2 text-left text-[13px] text-ink hover:bg-control-border/40"
                  >
                    {suggestion.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {address.trim().length > 0 && !selectedPlaceId && (
          <p className="text-[11px] text-ink-muted">Select an address from the suggestions.</p>
        )}
        <button
          type="button"
          onClick={addStore}
          disabled={isPending || !name.trim() || !address.trim() || !selectedPlaceId}
          className="bg-ink px-4 py-2.5 font-sans text-sm font-medium text-surface disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </>
  );
}
