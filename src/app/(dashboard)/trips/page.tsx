import Link from 'next/link';
import { addMinutes, format, parseISO, subMinutes } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Phase 1.5 mock data — no route-planning schema or mapping API exists yet
 * (Phase 4). Drive times and store hours are hand-picked, not routed, but
 * the leave-by and feasibility arithmetic below is real: it's the actual
 * shape Phase 4's real computation needs, just fed fixture numbers instead
 * of a mapping API response.
 */
interface MockStop {
  id: string;
  storeName: string;
  listNames: string[];
  driveMinutesFromPrevious: number;
  minutesAtStore: number;
  opensAt: string;
  closesAt: string;
}

interface MockTrip {
  id: string;
  label: string;
  dueAt: string;
  stops: MockStop[];
}

const trips: MockTrip[] = [
  {
    id: 'evening-errands',
    label: 'Evening errands',
    dueAt: '2026-08-25T18:00:00',
    stops: [
      {
        id: '1',
        storeName: "Trader Joe's",
        listNames: ['Grocery'],
        driveMinutesFromPrevious: 12,
        minutesAtStore: 20,
        opensAt: '08:00',
        closesAt: '22:00',
      },
      {
        id: '2',
        storeName: 'Costco',
        listNames: ['Household'],
        driveMinutesFromPrevious: 15,
        minutesAtStore: 35,
        opensAt: '10:00',
        closesAt: '20:30',
      },
    ],
  },
  {
    id: 'before-the-party',
    label: 'Before the party',
    dueAt: '2026-08-25T09:00:00',
    stops: [
      {
        id: '3',
        storeName: 'Party City',
        listNames: ['One-off'],
        driveMinutesFromPrevious: 10,
        minutesAtStore: 10,
        opensAt: '10:00',
        closesAt: '21:00',
      },
    ],
  },
];

type InfeasibleReason = 'before opening' | 'after closing' | null;

interface StopTiming {
  stop: MockStop;
  arrival: Date;
  departure: Date;
  infeasibleReason: InfeasibleReason;
}

function scheduleTrip(trip: MockTrip): { leaveBy: Date; stops: StopTiming[]; feasible: boolean } {
  const due = parseISO(trip.dueAt);
  const totalMinutes = trip.stops.reduce(
    (sum, stop) => sum + stop.driveMinutesFromPrevious + stop.minutesAtStore,
    0,
  );
  const leaveBy = subMinutes(due, totalMinutes);

  let cursor = leaveBy;
  const stops: StopTiming[] = trip.stops.map((stop) => {
    const arrival = addMinutes(cursor, stop.driveMinutesFromPrevious);
    const departure = addMinutes(arrival, stop.minutesAtStore);
    cursor = departure;

    const arrivalMinutes = arrival.getHours() * 60 + arrival.getMinutes();
    const [openH = 0, openM = 0] = stop.opensAt.split(':').map(Number);
    const [closeH = 0, closeM = 0] = stop.closesAt.split(':').map(Number);
    let infeasibleReason: InfeasibleReason = null;
    if (arrivalMinutes < openH * 60 + openM) {
      infeasibleReason = 'before opening';
    } else if (arrivalMinutes > closeH * 60 + closeM) {
      infeasibleReason = 'after closing';
    }

    return { stop, arrival, departure, infeasibleReason };
  });

  return { leaveBy, stops, feasible: stops.every((s) => s.infeasibleReason === null) };
}

export default function TripsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header>
        <Link href="/" className="font-mono text-xs text-ink-muted underline">
          ← Overhead
        </Link>
        <p className="mt-2 font-display text-2xl">Trips</p>
      </header>

      <div className="flex flex-col gap-4">
        {trips.map((trip) => {
          const { leaveBy, stops, feasible } = scheduleTrip(trip);
          const listNames = [...new Set(trip.stops.flatMap((s) => s.listNames))];

          return (
            <Card key={trip.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-display text-lg font-normal">{trip.label}</CardTitle>
                    <p className="mt-1 text-xs text-ink-muted">
                      Covers {listNames.join(' + ')} — due {format(parseISO(trip.dueAt), 'h:mm a')}
                    </p>
                  </div>
                  {!feasible && (
                    <Badge variant="outline" className="border-flag text-flag">
                      Not feasible
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded bg-surface-2 p-4">
                  <p className="text-xs tracking-wide text-ink-muted uppercase">Leave by</p>
                  <p className="font-mono text-2xl text-ink">{format(leaveBy, 'h:mm a')}</p>
                </div>

                <ul className="flex flex-col divide-y divide-rule border-y border-rule">
                  {stops.map(({ stop, arrival, infeasibleReason }) => (
                    <li key={stop.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-ink">{stop.storeName}</p>
                        <p className="font-mono text-xs text-ink-muted">
                          {stop.listNames.join(', ')} · open {stop.opensAt}–{stop.closesAt}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-mono text-sm ${infeasibleReason ? 'text-flag' : 'text-ink'}`}
                        >
                          Arrive {format(arrival, 'h:mm a')}
                        </p>
                        {infeasibleReason && (
                          <p className="font-mono text-xs text-flag">{infeasibleReason}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
