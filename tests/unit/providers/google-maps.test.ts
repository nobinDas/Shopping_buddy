import { describe, expect, it } from 'vitest';
import {
  parseAutocompleteResponse,
  parsePlaceSearchResponse,
  parseRouteResponse,
} from '@/server/providers/google-maps';

describe('parsePlaceSearchResponse', () => {
  it('extracts placeId, weekday text, and normalized periods', () => {
    const result = parsePlaceSearchResponse({
      places: [
        {
          id: 'place-1',
          regularOpeningHours: {
            weekdayDescriptions: ['Monday: 9:00 AM – 9:00 PM'],
            periods: [
              { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } },
            ],
          },
        },
      ],
    });

    expect(result).toEqual({
      placeId: 'place-1',
      openingHoursText: ['Monday: 9:00 AM – 9:00 PM'],
      openingHoursPeriods: [{ day: 1, opensAt: '09:00', closesAt: '21:00' }],
    });
  });

  it('keeps only the first period per day', () => {
    const result = parsePlaceSearchResponse({
      places: [
        {
          id: 'place-1',
          regularOpeningHours: {
            periods: [
              { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 12, minute: 0 } },
              { open: { day: 1, hour: 13, minute: 0 }, close: { day: 1, hour: 21, minute: 0 } },
            ],
          },
        },
      ],
    });

    expect(result?.openingHoursPeriods).toEqual([{ day: 1, opensAt: '09:00', closesAt: '12:00' }]);
  });

  it('returns null when there are no results', () => {
    expect(parsePlaceSearchResponse({ places: [] })).toBeNull();
  });

  it('returns hours as null when regularOpeningHours is missing', () => {
    const result = parsePlaceSearchResponse({ places: [{ id: 'place-1' }] });
    expect(result).toEqual({
      placeId: 'place-1',
      openingHoursText: null,
      openingHoursPeriods: null,
    });
  });
});

describe('parseAutocompleteResponse', () => {
  it('extracts placeId and display text from each prediction', () => {
    const result = parseAutocompleteResponse({
      suggestions: [
        {
          placePrediction: {
            placeId: 'place-1',
            text: { text: '1600 Amphitheatre Parkway, Mountain View, CA, USA' },
          },
        },
      ],
    });

    expect(result).toEqual([
      { placeId: 'place-1', description: '1600 Amphitheatre Parkway, Mountain View, CA, USA' },
    ]);
  });

  it('drops predictions missing a placeId or text', () => {
    const result = parseAutocompleteResponse({
      suggestions: [{ placePrediction: { text: { text: 'No id' } } }, { placePrediction: {} }, {}],
    });

    expect(result).toEqual([]);
  });

  it('returns an empty array when there are no suggestions', () => {
    expect(parseAutocompleteResponse({})).toEqual([]);
  });
});

describe('parseRouteResponse', () => {
  it('extracts the optimized order and drops the final return-to-origin leg', () => {
    const result = parseRouteResponse(
      {
        routes: [
          {
            optimizedIntermediateWaypointIndex: [1, 0],
            legs: [{ duration: '600s' }, { duration: '300s' }, { duration: '900s' }],
          },
        ],
      },
      2,
    );

    expect(result).toEqual({ order: [1, 0], legMinutes: [10, 5] });
  });

  it('defaults to natural order when Google omits optimizedIntermediateWaypointIndex', () => {
    const result = parseRouteResponse(
      { routes: [{ legs: [{ duration: '120s' }, { duration: '120s' }] }] },
      1,
    );
    expect(result?.order).toEqual([0]);
  });

  it('falls back to natural order when Google returns [-1] for a single stop', () => {
    // Confirmed live against the real Routes API: with exactly one
    // intermediate, Google returns [-1] instead of [0] — not a real
    // permutation, so it must not be propagated as-is.
    const result = parseRouteResponse(
      {
        routes: [
          {
            optimizedIntermediateWaypointIndex: [-1],
            legs: [{ duration: '716s' }, { duration: '630s' }],
          },
        ],
      },
      1,
    );

    expect(result).toEqual({ order: [0], legMinutes: [12] });
  });

  it('returns null when there are no routes', () => {
    expect(parseRouteResponse({ routes: [] }, 2)).toBeNull();
  });
});
