'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { watchlistCategoryValues } from '@/lib/validation/watchlist';
import { formatMoney } from '@/lib/money';
import type { ProductCandidate } from '@/server/domain/watchlist-candidates';
import {
  getRecommendedStoresAction,
  findWatchlistCandidatesAction,
  createWatchlistItemAction,
} from '@/app/(dashboard)/watchlist/actions';

type Step = 'name' | 'category' | 'details' | 'stores' | 'confirm';
const STEP_ORDER: Step[] = ['name', 'category', 'details', 'stores', 'confirm'];

const labelClass = 'font-mono text-[10px] tracking-wide text-ink-muted uppercase';
const categoryLabels: Record<(typeof watchlistCategoryValues)[number], string> = {
  electronics: 'Electronics',
  appliances: 'Appliances',
  furniture: 'Furniture',
  apparel: 'Apparel',
  beauty: 'Beauty',
  sports_outdoors: 'Sports & Outdoors',
  toys_games: 'Toys & Games',
  home_kitchen: 'Home & Kitchen',
  books_media: 'Books & Media',
  automotive: 'Automotive',
  other: 'Other',
};

function primaryButtonClass(disabled: boolean): string {
  return `flex-1 bg-ink py-3 text-center font-sans text-sm font-medium text-surface ${
    disabled ? 'opacity-60' : ''
  }`;
}
const secondaryButtonClass =
  'flex-1 border border-control-border py-3 text-center font-sans text-sm font-medium text-ink';

export function AddWatchlistItemWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('name');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<(typeof watchlistCategoryValues)[number] | ''>('');
  const [brand, setBrand] = useState('');
  const [variant, setVariant] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedPriceMin, setExpectedPriceMin] = useState('');
  const [expectedPriceMax, setExpectedPriceMax] = useState('');

  const [sellers, setSellers] = useState<string[]>([]);
  const [sellerDraft, setSellerDraft] = useState('');
  const [recommendedStores, setRecommendedStores] = useState<string[] | null>(null);
  const [isRecommending, startRecommendTransition] = useTransition();

  const [candidates, setCandidates] = useState<ProductCandidate[] | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<ProductCandidate | null>(null);
  const [isSearching, startSearchTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  function addSeller(value: string) {
    const trimmed = value.trim();
    if (!trimmed || sellers.includes(trimmed)) return;
    setSellers((current) => [...current, trimmed]);
  }

  function removeSeller(value: string) {
    setSellers((current) => current.filter((s) => s !== value));
  }

  function runSearch() {
    setError(null);
    setCandidates(null);
    setSelectedCandidate(null);
    startSearchTransition(() => {
      void (async () => {
        const found = await findWatchlistCandidatesAction({
          name,
          category,
          brand: brand || null,
          variant: variant || null,
          notes: notes || null,
          expectedPriceMin: expectedPriceMin || null,
          expectedPriceMax: expectedPriceMax || null,
        });
        setCandidates(found);
      })();
    });
  }

  function submit() {
    if (!selectedCandidate) return;
    setError(null);
    startCreateTransition(() => {
      void (async () => {
        const result = await createWatchlistItemAction(
          {
            name,
            category,
            brand: brand || null,
            variant: variant || null,
            notes: notes || null,
            expectedPriceMin: expectedPriceMin || null,
            expectedPriceMax: expectedPriceMax || null,
            trackedSellers: sellers,
          },
          selectedCandidate,
        );
        if (result.error) {
          setError(result.error);
        }
        // On success, createWatchlistItemAction redirects server-side —
        // nothing further to do here.
      })();
    });
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[11px] text-ink-muted uppercase">
        Step {stepIndex + 1} of {STEP_ORDER.length}
      </p>

      {step === 'name' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-name" className={labelClass}>
              What are you tracking?
            </Label>
            <Input
              id="f-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="e.g. iPhone 18 Pro"
              autoFocus
            />
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (name.trim()) goTo('category');
              }}
              disabled={!name.trim()}
              className={primaryButtonClass(!name.trim())}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'category' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-category" className={labelClass}>
              What kind of product is this?
            </Label>
            <Select value={category} onValueChange={(value) => { setCategory(value as (typeof watchlistCategoryValues)[number]); }}>
              <SelectTrigger id="f-category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {watchlistCategoryValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {categoryLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => { goTo('name'); }} className={secondaryButtonClass}>
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (category) goTo('details');
              }}
              disabled={!category}
              className={primaryButtonClass(!category)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-ink-muted">
            Optional — the more you fill in, the better the store suggestions and product match on
            the next steps.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-brand" className={labelClass}>
              Brand
            </Label>
            <Input id="f-brand" value={brand} onChange={(event) => { setBrand(event.target.value); }} placeholder="e.g. Apple" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-variant" className={labelClass}>
              Model / variant detail
            </Label>
            <Input
              id="f-variant"
              value={variant}
              onChange={(event) => { setVariant(event.target.value); }}
              placeholder="e.g. 256GB, Titanium"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="f-price-min" className={labelClass}>
                Expected price — min
              </Label>
              <Input
                id="f-price-min"
                inputMode="decimal"
                placeholder="0.00"
                value={expectedPriceMin}
                onChange={(event) => { setExpectedPriceMin(event.target.value); }}
                className="font-mono"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="f-price-max" className={labelClass}>
                Expected price — max
              </Label>
              <Input
                id="f-price-max"
                inputMode="decimal"
                placeholder="0.00"
                value={expectedPriceMax}
                onChange={(event) => { setExpectedPriceMax(event.target.value); }}
                className="font-mono"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-notes" className={labelClass}>
              Notes
            </Label>
            <Textarea id="f-notes" rows={3} value={notes} onChange={(event) => { setNotes(event.target.value); }} />
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => { goTo('category'); }} className={secondaryButtonClass}>
              Back
            </button>
            <button type="button" onClick={() => { goTo('stores'); }} className={primaryButtonClass(false)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 'stores' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="f-seller" className={labelClass}>
              Which stores should we track the price at?
            </Label>
            <div className="flex gap-2">
              <Input
                id="f-seller"
                value={sellerDraft}
                onChange={(event) => { setSellerDraft(event.target.value); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addSeller(sellerDraft);
                    setSellerDraft('');
                  }
                }}
                placeholder="Type a store name, press Enter"
              />
              <button
                type="button"
                onClick={() => {
                  startRecommendTransition(() => {
                    void (async () => {
                      const stores = await getRecommendedStoresAction({
                        name,
                        category,
                        brand: brand || null,
                        variant: variant || null,
                      });
                      setRecommendedStores(stores);
                    })();
                  });
                }}
                disabled={isRecommending}
                className="flex-none border border-control-border px-3 py-2.5 font-sans text-xs font-medium text-ink disabled:opacity-60"
              >
                {isRecommending ? 'Thinking…' : 'Recommend stores'}
              </button>
            </div>
          </div>

          {sellers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sellers.map((seller) => (
                <button
                  key={seller}
                  type="button"
                  onClick={() => { removeSeller(seller); }}
                  className="border border-control-border bg-ink px-3 py-1.5 font-sans text-xs font-medium text-surface"
                >
                  {seller} ×
                </button>
              ))}
            </div>
          )}

          {recommendedStores && (
            <div className="flex flex-col gap-2">
              <p className={labelClass}>Suggested</p>
              {recommendedStores.length === 0 ? (
                <p className="text-[13px] text-ink-muted">No suggestions found — add your own above.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recommendedStores
                    .filter((store) => !sellers.includes(store))
                    .map((store) => (
                      <button
                        key={store}
                        type="button"
                        onClick={() => { addSeller(store); }}
                        className="border border-control-border px-3 py-1.5 font-sans text-xs font-medium text-ink"
                      >
                        + {store}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2.5">
            <button type="button" onClick={() => { goTo('details'); }} className={secondaryButtonClass}>
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (sellers.length > 0) {
                  runSearch();
                  goTo('confirm');
                }
              }}
              disabled={sellers.length === 0}
              className={primaryButtonClass(sellers.length === 0)}
            >
              Find this product
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="flex flex-col gap-4">
          <p className={labelClass}>Which of these is it?</p>

          {isSearching && <p className="text-[13px] text-ink-muted">Searching…</p>}

          {!isSearching && candidates?.length === 0 && (
            <div className="flex flex-col items-center gap-2 border border-rule bg-surface-2 p-8 text-center">
              <p className="text-[13px] text-ink-muted">
                No listings found from your selected stores. Try adding more stores, or adjusting the
                name/brand/model.
              </p>
            </div>
          )}

          {!isSearching && candidates && candidates.length > 0 && (
            <div className="flex flex-col gap-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.productId}
                  type="button"
                  onClick={() => { setSelectedCandidate(candidate); }}
                  className={`flex items-center justify-between gap-3 border p-3 text-left ${
                    selectedCandidate?.productId === candidate.productId
                      ? 'border-ink bg-surface-2'
                      : 'border-control-border'
                  }`}
                >
                  <span>
                    <span className="block font-sans text-sm text-ink">{candidate.title}</span>
                    {candidate.sellerName && (
                      <span className="block font-mono text-[11px] text-ink-muted">
                        at {candidate.sellerName}
                      </span>
                    )}
                  </span>
                  <span className="flex-none font-mono text-sm text-ink">
                    {formatMoney({ amountMinor: candidate.unitPriceMinor, currency: candidate.currency })}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && <p className="font-mono text-sm text-flag">{error}</p>}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setCandidates(null);
                goTo('stores');
              }}
              className={secondaryButtonClass}
            >
              Back
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!selectedCandidate || isCreating}
              className={primaryButtonClass(!selectedCandidate || isCreating)}
            >
              {isCreating ? 'Adding…' : 'Add to watchlist'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => { router.push('/watchlist'); }}
            className="font-mono text-[11px] text-ink-muted underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
