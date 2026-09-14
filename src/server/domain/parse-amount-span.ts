/**
 * Converts a literal amount span, as printed in an email, into integer
 * minor units (cents) for a given ISO 4217 currency. Pure, no I/O —
 * unit-tested directly.
 *
 * Exists for the same reason as parse-date-span.ts: separates "find the
 * amount being described" (the LLM's job — a much lower-risk operation
 * than it turned out to be for dates, but this app was never asking it to
 * do currency-conversion arithmetic either) from "compute its minor-unit
 * value" (this function's job, deterministic). Directly targets the
 * netflix-jp-jpy golden fixture's confirmed, reproducible bug: Haiku
 * consistently multiplied a zero-decimal JPY amount by 100 anyway
 * (1,490円 -> 149000 instead of 1490) despite an explicit prompt
 * instruction not to. See docs/LEARNED.md, 2026-09-14.
 *
 * Handles every real number-formatting convention confirmed present
 * across this app's golden-file fixtures: plain decimal ("9.99"),
 * US-style thousands-plus-decimal ("1,200.00"), a bare integer with no
 * decimal shown ("499"), a zero-decimal currency's own thousands
 * separator ("1,490"), European comma-as-decimal ("8,99"), and a
 * three-decimal currency ("12.345 KWD"). Returns null for anything it
 * can't confidently parse (docs/TOOLS.md: "discard-and-log on failure
 * rather than persisting a malformed signal") — never guesses.
 */

// Currencies with no minor-unit subdivision at all — every separator in
// these is a thousands grouping, never a decimal point. Mirrors the same
// set named in the system prompt (classify-email.ts).
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);
// ISO 4217 currencies whose minor unit is a *third* decimal place, not the
// usual two — every Gulf/Maghreb dinar-family currency still in active use
// (BHD, IQD, JOD, KWD, LYD, OMR, TND). Previously unhandled: anything not
// in ZERO_DECIMAL_CURRENCIES fell through to the 2-decimal default, which
// silently misparses these by a factor of 10 (e.g. "12.345 KWD" read as
// 1234 minor units instead of 12345). Flagged as a known gap when this
// file was first written; no golden fixture exercised it until now.
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
const DEFAULT_DECIMAL_PLACES = 2;

function extractNumericToken(text: string): string | null {
  const match = /-?[0-9][0-9.,]*[0-9]|-?[0-9]/.exec(text);
  return match ? match[0] : null;
}

function decimalPlacesFor(currency: string): number {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(upper)) return 3;
  return DEFAULT_DECIMAL_PLACES;
}

/**
 * Splits a numeric token into integer/fractional digit strings, given how
 * many fractional digits the currency actually has. A lone separator
 * (comma or period) counts as the decimal point only when it's followed
 * by exactly `decimalPlaces` digits and nothing else — otherwise it's
 * treated as a thousands grouping and stripped. When both a comma and a
 * period appear, whichever comes last is the decimal point (handles
 * "1,200.00" — US thousands+decimal — correctly).
 */
function splitIntegerAndFraction(
  token: string,
  decimalPlaces: number,
): { integerDigits: string; fractionalDigits: string } | null {
  if (decimalPlaces === 0) {
    const digitsOnly = token.replace(/[.,]/g, '');
    return /^-?\d+$/.test(digitsOnly) ? { integerDigits: digitsOnly, fractionalDigits: '' } : null;
  }

  const lastCommaIdx = token.lastIndexOf(',');
  const lastPeriodIdx = token.lastIndexOf('.');
  let decimalIdx = -1;

  if (lastCommaIdx !== -1 && lastPeriodIdx !== -1) {
    decimalIdx = Math.max(lastCommaIdx, lastPeriodIdx);
  } else if (lastCommaIdx !== -1 && token.length - lastCommaIdx - 1 === decimalPlaces) {
    decimalIdx = lastCommaIdx;
  } else if (lastPeriodIdx !== -1 && token.length - lastPeriodIdx - 1 === decimalPlaces) {
    decimalIdx = lastPeriodIdx;
  }

  const integerRaw = decimalIdx === -1 ? token : token.slice(0, decimalIdx);
  const fractionalRaw = decimalIdx === -1 ? '' : token.slice(decimalIdx + 1);
  const integerDigits = integerRaw.replace(/[.,]/g, '');
  const fractionalDigits = fractionalRaw.replace(/[.,]/g, '');

  if (!/^-?\d+$/.test(integerDigits) || !/^\d*$/.test(fractionalDigits)) return null;
  return { integerDigits, fractionalDigits };
}

export function parseAmountSpan(
  text: string | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (!text || !currency) return null;

  const token = extractNumericToken(text);
  if (!token) return null;

  const decimalPlaces = decimalPlacesFor(currency);
  const split = splitIntegerAndFraction(token, decimalPlaces);
  if (!split) return null;

  const { integerDigits, fractionalDigits } = split;
  const negative = integerDigits.startsWith('-');
  const absInteger = negative ? integerDigits.slice(1) : integerDigits;
  if (!absInteger) return null;

  const paddedFraction = fractionalDigits.padEnd(decimalPlaces, '0').slice(0, decimalPlaces);
  const minorUnits = Number(absInteger) * 10 ** decimalPlaces + Number(paddedFraction || '0');
  return negative ? -minorUnits : minorUnits;
}
