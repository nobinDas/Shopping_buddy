import Link from 'next/link';
import { formatMoney } from '@/lib/money';

/**
 * Phase 1.5 mock data — no price-history accumulation or trend detection
 * exists yet (Phase 5). The buy-now-or-wait `reasoning` is hand-written
 * here, standing in for what Phase 5's real trend detection would produce
 * — every such suggestion still needs one, per docs/CLAUDE.md: "Every
 * automated financial suggestion writes a reasoning record."
 */
interface MockPricePoint {
  date: string;
  amountMinor: number;
}

interface MockWatchItem {
  id: string;
  name: string;
  currency: string;
  targetPriceMinor: number | null;
  history: MockPricePoint[];
  suggestion: 'buy' | 'wait' | 'no_price';
  reasoning: string;
}

const watchItems: MockWatchItem[] = [
  {
    id: '1',
    name: '4K OLED TV, 55"',
    currency: 'USD',
    targetPriceMinor: 90000,
    history: [
      { date: '2026-03-01', amountMinor: 119900 },
      { date: '2026-04-01', amountMinor: 114900 },
      { date: '2026-05-01', amountMinor: 109900 },
      { date: '2026-06-01', amountMinor: 104900 },
      { date: '2026-07-01', amountMinor: 92900 },
      { date: '2026-08-01', amountMinor: 84900 },
    ],
    suggestion: 'buy',
    reasoning:
      'Currently $849 — below your $900 target, and lower than any of the last six months. Prices this low have historically climbed back within a few weeks.',
  },
  {
    id: '2',
    name: 'Robot vacuum',
    currency: 'USD',
    targetPriceMinor: 25000,
    history: [
      { date: '2026-03-01', amountMinor: 27900 },
      { date: '2026-04-01', amountMinor: 26900 },
      { date: '2026-05-01', amountMinor: 28900 },
      { date: '2026-06-01', amountMinor: 30900 },
      { date: '2026-07-01', amountMinor: 31900 },
      { date: '2026-08-01', amountMinor: 30900 },
    ],
    suggestion: 'wait',
    reasoning:
      'Currently $309 — 24% above your $250 target and trending up since May. This model has dropped below target in each of the last two Novembers.',
  },
  {
    id: '3',
    name: 'Espresso machine',
    currency: 'USD',
    targetPriceMinor: 40000,
    history: [
      { date: '2026-03-01', amountMinor: 44900 },
      { date: '2026-04-01', amountMinor: 43900 },
      { date: '2026-05-01', amountMinor: 41900 },
      { date: '2026-06-01', amountMinor: 40900 },
      { date: '2026-07-01', amountMinor: 40000 },
      { date: '2026-08-01', amountMinor: 40000 },
    ],
    suggestion: 'buy',
    reasoning: 'Currently $400 — exactly at your target, and has held steady there for two months.',
  },
  {
    id: '4',
    name: 'Winter tyres, set of 4',
    currency: 'USD',
    targetPriceMinor: null,
    history: [],
    suggestion: 'no_price',
    reasoning: 'Nothing observed yet — not zero. Recommendation waits for a first reading.',
  },
];

const suggestionLabel: Record<MockWatchItem['suggestion'], string> = {
  buy: 'Buy now',
  wait: 'Wait',
  no_price: 'No price yet',
};

// See docs/DESIGN.md's three signal colours — neither maps exactly, but
// verified (confirmed/good) and pending (holding for a better moment) are
// the closer fits of the two available.
const suggestionToneClass: Record<MockWatchItem['suggestion'], string> = {
  buy: 'text-verified',
  wait: 'text-pending',
  no_price: 'text-ink-muted',
};

/**
 * A minimal inline sparkline — 2px line, round joins, one direct label at
 * the endpoint (the current price), everything else left to the axis-free
 * shape of the trend. See the dataviz skill, marks-and-anatomy.md.
 */
function PriceSparkline({ history, currency }: { history: MockPricePoint[]; currency: string }) {
  const width = 240;
  const height = 64;
  const paddingX = 4;
  // Extra headroom above the plotted line so the endpoint's price label
  // never collides with the chart's own top edge — see the dataviz skill,
  // marks-and-anatomy.md: "a label that won't fit doesn't get clipped."
  const paddingTop = 18;
  const paddingBottom = 4;
  const amounts = history.map((p) => p.amountMinor);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const plotHeight = height - paddingTop - paddingBottom;

  const points = history.map((point, index) => {
    const x = paddingX + (index / (history.length - 1)) * (width - paddingX * 2);
    const y = height - paddingBottom - ((point.amountMinor - min) / range) * plotHeight;
    return { x, y, point };
  });

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${String(p.x)} ${String(p.y)}`)
    .join(' ');
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
          <circle
            cx={last.x}
            cy={last.y}
            r={4}
            className="fill-ink stroke-surface"
            strokeWidth={2}
          />
          <text
            x={last.x}
            y={last.y - 10}
            textAnchor="end"
            className="fill-ink font-mono text-[10px]"
          >
            {formatMoney({ amountMinor: last.point.amountMinor, currency })}
          </text>
        </>
      )}
    </svg>
  );
}

export default function WatchlistPage() {
  return (
    <main className="flex min-h-screen flex-col px-5 pt-6">
      <Link href="/more" className="font-mono text-xs text-ink-muted underline">
        ← More
      </Link>
      <p className="mt-3 mb-2 font-display text-[28px] tracking-tight">Watchlist</p>

      {watchItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing on your watchlist yet. Add an item with a target price to track.
          </p>
        </div>
      ) : (
        <div className="border-t border-rule">
          {watchItems.map((item) => {
            const current = item.history[item.history.length - 1];

            return (
              <div key={item.id} className="border-b border-rule py-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="font-sans text-[15px] font-medium text-ink">{item.name}</span>
                  <span className="font-mono text-base text-ink">
                    {current
                      ? formatMoney({ amountMinor: current.amountMinor, currency: item.currency })
                      : '—'}
                  </span>
                </div>
                <p
                  className={`mb-2.5 font-mono text-[10px] font-semibold tracking-widest ${suggestionToneClass[item.suggestion]}`}
                >
                  {suggestionLabel[item.suggestion].toUpperCase()}
                </p>
                {item.history.length > 0 ? (
                  <PriceSparkline history={item.history} currency={item.currency} />
                ) : (
                  <div className="h-14 bg-surface-2" />
                )}
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{item.reasoning}</p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
