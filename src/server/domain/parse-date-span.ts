/**
 * Converts a literal date span, as printed in an email, into ISO 8601
 * (YYYY-MM-DD). Pure, no I/O — unit-tested directly.
 *
 * Exists to separate two different jobs that used to be one LLM call:
 * "find the date being described" (still the LLM's job) and "compute its
 * ISO representation" (now this function's job, deterministic). See
 * docs/LEARNED.md, 2026-09-13 — asking Haiku 4.5 to directly emit an ISO
 * date for something more than ~a year in the future produced a
 * confirmed, reproducible bug where it substituted a reference date from
 * elsewhere in the prompt instead of the literal year in the email, even
 * under explicit instruction not to. This function exists to test
 * whether asking for a verbatim copy instead of a computed value avoids
 * that failure mode.
 *
 * Covers the formats confirmed present across this app's real golden-file
 * fixtures — not a general-purpose date parser. Returns null for anything
 * it doesn't recognize (docs/TOOLS.md: "discard-and-log on failure rather
 * than persisting a malformed signal" — a date we can't confidently parse
 * should become null, not a guess).
 *
 * Month-name regexes use `\p{L}` (Unicode "any letter", `u` flag) rather
 * than `[A-Za-z]` — a real bug found via a golden-fixture edge-case run
 * (docs/LEARNED.md, 2026-09-14): a correctly-transcribed Arabic date
 * ("14 أكتوبر 2026") didn't even match the day-month-year regex at all,
 * since Arabic script isn't in `[A-Za-z]`, and a French one ("14 octobre
 * 2026") matched the regex but failed the (English-only) month lookup.
 * `\p{L}` fixes the matching for any script; which *languages* are
 * actually understood is still controlled deliberately by which
 * `*_MONTHS` map a given date format checks against — this still returns
 * null for a real month name in an unsupported language, not a guess.
 */

const ENGLISH_MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const GERMAN_MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  märz: 3,
  marz: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  dezember: 12,
};

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};

// Modern Standard Arabic, Gregorian month names (Levant/Gulf convention —
// the form actually used in real billing emails, as opposed to the
// Maghreb convention that transliterates the French names).
const ARABIC_MONTHS: Record<string, number> = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  أبريل: 4,
  إبريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  أغسطس: 8,
  سبتمبر: 9,
  أكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
};

// Shared by every "day month year" / "month day, year" format below —
// tries each map in order so one regex can serve several languages that
// happen to share the same date word-order, without conflating which
// specific languages are actually supported.
function lookupMonth(monthName: string, maps: Record<string, number>[]): number | undefined {
  const lower = monthName.toLowerCase();
  for (const map of maps) {
    const month = map[lower];
    if (month) return month;
  }
  return undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  // Catches e.g. day 31 in a 30-day month, Feb 30, etc. — a Date object
  // normalizes out-of-range days by rolling into the next month, so
  // comparing back against what we asked for catches that silently.
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseDateSpan(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Already ISO — defensive, in case a model returns this format anyway.
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch as unknown as [string, string, string, string];
    return isValidCalendarDate(Number(y), Number(m), Number(d)) ? trimmed : null;
  }

  // Japanese: 2026年10月5日
  const jpMatch = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(trimmed);
  if (jpMatch) {
    const [, y, m, d] = jpMatch as unknown as [string, string, string, string];
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isValidCalendarDate(year, month, day) ? `${y}-${pad2(month)}-${pad2(day)}` : null;
  }

  // German: 7. Oktober 2026
  const deMatch = /^(\d{1,2})\.\s*(\p{L}+)\s+(\d{4})$/u.exec(trimmed);
  if (deMatch) {
    const [, d, monthName, y] = deMatch as unknown as [string, string, string, string];
    const month = lookupMonth(monthName, [GERMAN_MONTHS]);
    const day = Number(d);
    const year = Number(y);
    if (month && isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  // English long form: "September 8, 2027" / "October 1, 2026"
  const enLongMatch = /^(\p{L}+)\s+(\d{1,2}),\s*(\d{4})$/u.exec(trimmed);
  if (enLongMatch) {
    const [, monthName, d, y] = enLongMatch as unknown as [string, string, string, string];
    const month = lookupMonth(monthName, [ENGLISH_MONTHS]);
    const day = Number(d);
    const year = Number(y);
    if (month && isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  // International, no comma: "15 October 2026" / "14 octobre 2026" /
  // "14 أكتوبر 2026" — same day-month-year word order across English,
  // French, and Arabic, so one regex serves all three; the month-name
  // maps are what actually decide which languages are understood.
  const intlMatch = /^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u.exec(trimmed);
  if (intlMatch) {
    const [, d, monthName, y] = intlMatch as unknown as [string, string, string, string];
    const month = lookupMonth(monthName, [ENGLISH_MONTHS, FRENCH_MONTHS, ARABIC_MONTHS]);
    const day = Number(d);
    const year = Number(y);
    if (month && isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  // US slash, MM/DD/YYYY: "10/15/2026"
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const [, m, d, y] = slashMatch as unknown as [string, string, string, string];
    const month = Number(m);
    const day = Number(d);
    const year = Number(y);
    if (isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  return null;
}
