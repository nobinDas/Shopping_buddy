import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';

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
  targetPriceMinor: number;
  history: MockPricePoint[];
  suggestion: 'buy' | 'wait';
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
];

const suggestionLabel: Record<MockWatchItem['suggestion'], string> = {
  buy: 'Buy now',
  wait: 'Wait',
};

// See docs/DESIGN.md's three signal colours — neither maps exactly, but
// verified (confirmed/good) and pending (holding for a better moment) are
// the closer fits of the two available.
const suggestionBadgeClass: Record<MockWatchItem['suggestion'], string> = {
  buy: 'border-verified text-verified',
  wait: 'border-pending text-pending',
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <Link href="/" className="font-mono text-xs text-ink-muted underline">
          ← Overhead
        </Link>
        <p className="mt-2 font-display text-2xl">Price watchlist</p>
      </header>

      {watchItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded border border-rule bg-surface-2 p-12 text-center">
          <p className="text-base text-ink">
            Nothing on your watchlist yet. Add an item with a target price to track.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {watchItems.map((item) => {
            const current = item.history[item.history.length - 1];
            const lastUpdated = current ? formatDate(current.date) : '—';

            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-display text-lg font-normal">
                        {item.name}
                      </CardTitle>
                      <p className="mt-1 font-mono text-xs text-ink-muted">
                        Target{' '}
                        {formatMoney({
                          amountMinor: item.targetPriceMinor,
                          currency: item.currency,
                        })}
                        {' · updated '}
                        {lastUpdated}
                      </p>
                    </div>
                    <Badge variant="outline" className={suggestionBadgeClass[item.suggestion]}>
                      {suggestionLabel[item.suggestion]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <PriceSparkline history={item.history} currency={item.currency} />
                  <p className="text-sm text-ink-muted">{item.reasoning}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
