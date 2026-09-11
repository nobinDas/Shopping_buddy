'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { formatMoney } from '@/lib/money';
import type { WatchlistItemWithHistory } from '@/server/db/queries/watchlist';
import type { PriceCheckResult } from '@/server/services/watchlist.service';
import {
  deleteWatchlistItemAction,
  checkWatchlistItemPriceAction,
  markWatchlistSeenAction,
} from '@/app/(dashboard)/watchlist/actions';

type PriceCheckState = { status: 'checking' } | PriceCheckResult;

/**
 * A minimal inline sparkline — 2px line, round joins, one direct label at
 * the endpoint (the current price). Ported from the Phase 1.5 mock's
 * component, same shape, now reading real history rows instead of
 * fixture data. See the dataviz skill, marks-and-anatomy.md.
 */
function PriceSparkline({
  history,
  currency,
}: {
  history: { unitPriceMinor: number }[];
  currency: string;
}) {
  const width = 240;
  const height = 64;
  const paddingX = 4;
  const paddingTop = 18;
  const paddingBottom = 4;
  const amounts = history.map((p) => p.unitPriceMinor);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = history.map((point, index) => {
    const x = paddingX + (index / Math.max(history.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingBottom - ((point.unitPriceMinor - min) / range) * plotHeight;
    return { x, y, point };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${String(p.x)} ${String(p.y)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${String(width)} ${String(height)}`} className="w-full" aria-hidden="true">
      <line
        x1={paddingX}
        y1={height - paddingBottom}
        x2={width - paddingX}
        y2={height - paddingBottom}
        className="stroke-rule"
        strokeWidth={1}
      />
      <path
        d={path}
        fill="none"
        className="stroke-ink"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && (
        <>
          <circle cx={last.x} cy={last.y} r={4} className="fill-ink stroke-surface" strokeWidth={2} />
          {/* Right-aligning the label at the endpoint clips it off-canvas
              when the endpoint sits near the left edge — true for a
              single-point history (a first-ever check), which the
              ported mock (always 6+ points) never actually exercised.
              Confirmed live: a real single-point item clipped to a bare
              "2" from "$31.92." Anchor from the near side instead. */}
          <text
            x={last.x}
            y={last.y - 10}
            textAnchor={last.x < width * 0.3 ? 'start' : 'end'}
            className="fill-ink font-mono text-[10px]"
          >
            {formatMoney({ amountMinor: last.point.unitPriceMinor, currency })}
          </text>
        </>
      )}
    </svg>
  );
}

export function WatchlistItems({ items }: { items: WatchlistItemWithHistory[] }) {
  const [priceChecks, setPriceChecks] = useState<Record<string, PriceCheckState>>({});
  const [isPending, startTransition] = useTransition();

  // Opening this screen is the "seen it" moment for the two-level nav
  // badge (More tab -> Watchlist row) — see docs/DECISIONS.md's Phase 5
  // ADR.
  useEffect(() => {
    void markWatchlistSeenAction();
  }, []);

  function checkPrice(id: string) {
    setPriceChecks((current) => ({ ...current, [id]: { status: 'checking' } }));
    startTransition(() => {
      void (async () => {
        const result = await checkWatchlistItemPriceAction(id);
        setPriceChecks((current) => ({ ...current, [id]: result }));
      })();
    });
  }

  function deleteItem(id: string) {
    startTransition(() => {
      void deleteWatchlistItemAction(id);
    });
  }

  return (
    <div className="border-t border-rule">
      {items.map((item) => {
        const priceCheck = priceChecks[item.id];
        const currency = item.latestCurrency ?? 'USD';

        return (
          <div key={item.id} className="border-b border-rule py-4">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="font-sans text-[15px] font-medium text-ink">{item.name}</span>
              <span className="flex-none font-mono text-base text-ink">
                {item.latestPriceMinor === null
                  ? '—'
                  : formatMoney({ amountMinor: item.latestPriceMinor, currency })}
              </span>
            </div>

            <div className="mb-2.5 flex items-center gap-2">
              {item.hasPriceDrop && (
                <p className="font-mono text-[10px] font-semibold tracking-widest text-verified">
                  PRICE DROPPED
                </p>
              )}
              {item.latestSellerName && (
                <p className="font-mono text-[10px] text-ink-muted">at {item.latestSellerName}</p>
              )}
            </div>

            {item.history.length > 0 ? (
              <PriceSparkline history={item.history} currency={currency} />
            ) : (
              <div className="flex h-14 items-center justify-center bg-surface-2 text-[11px] text-ink-muted">
                Not checked yet
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between gap-3">
              <p className="min-h-[1em] text-[13px] leading-relaxed text-ink-muted">
                {priceCheck?.status === 'checking' && 'Checking Google Shopping…'}
                {priceCheck?.status === 'found' && 'Updated.'}
                {priceCheck?.status === 'not_found' && 'No listing found right now.'}
                {priceCheck?.status === 'error' && <span className="text-flag">{priceCheck.message}</span>}
              </p>
              <div className="flex flex-none gap-3">
                <button
                  type="button"
                  aria-label={`Check ${item.name}'s price`}
                  onClick={() => {
                    checkPrice(item.id);
                  }}
                  disabled={priceCheck?.status === 'checking'}
                  className="p-0.5 text-ink-muted hover:text-ink disabled:opacity-40"
                >
                  <Search className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  onClick={() => {
                    deleteItem(item.id);
                  }}
                  disabled={isPending}
                  className="p-0.5 text-ink-muted hover:text-flag"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
