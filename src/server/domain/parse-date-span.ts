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
 * Covers the five formats confirmed present across this app's real
 * golden-file fixtures — not a general-purpose date parser. Returns null
 * for anything it doesn't recognize (docs/TOOLS.md: "discard-and-log on
 * failure rather than persisting a malformed signal" — a date we can't
 * confidently parse should become null, not a guess).
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
  const deMatch = /^(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)\s+(\d{4})$/.exec(trimmed);
  if (deMatch) {
    const [, d, monthName, y] = deMatch as unknown as [string, string, string, string];
    const month = GERMAN_MONTHS[monthName.toLowerCase()];
    const day = Number(d);
    const year = Number(y);
    if (month && isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  // English long form: "September 8, 2027" / "October 1, 2026"
  const enLongMatch = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(trimmed);
  if (enLongMatch) {
    const [, monthName, d, y] = enLongMatch as unknown as [string, string, string, string];
    const month = ENGLISH_MONTHS[monthName.toLowerCase()];
    const day = Number(d);
    const year = Number(y);
    if (month && isValidCalendarDate(year, month, day)) {
      return `${y}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  // International, no comma: "15 October 2026"
  const intlMatch = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (intlMatch) {
    const [, d, monthName, y] = intlMatch as unknown as [string, string, string, string];
    const month = ENGLISH_MONTHS[monthName.toLowerCase()];
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
