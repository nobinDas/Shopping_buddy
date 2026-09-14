/**
 * Levenshtein edit distance, then normalised into a 0–1 similarity score
 * (1 = identical, 0 = nothing shared) — `domain/reconcile.ts`'s "fuzzy
 * vendor match (normalised Levenshtein ≥ 0.85)" test, docs/DATA_MODEL.md.
 * No dependency added for this: it's ~30 lines and the app doesn't need
 * anything more than exact edit distance (no transposition, no
 * phonetic matching).
 *
 * The DP table is a flat `Uint32Array` rather than an array of arrays —
 * not a performance concern at this input size, but it sidesteps
 * `noUncheckedIndexedAccess` making every cell read `number | undefined`
 * (a typed array's index signature returns `number` directly), which
 * would otherwise mean non-null assertions on every access into a table
 * whose bounds are, in fact, always known to be safe here.
 */
/**
 * A `Uint32Array` read still types as `number | undefined` under
 * `noUncheckedIndexedAccess` — this helper is the one place that gets
 * asserted back to `number`, via an explicit throw (this codebase's
 * existing convention for "provably unreachable," e.g. every
 * `db/queries/*.ts` insert helper) rather than a bare `!` assertion.
 * Every call site below passes an index inside the table's known bounds.
 */
function cell(distances: Uint32Array, index: number): number {
  const value = distances[index];
  if (value === undefined) {
    throw new Error('levenshteinDistance: read past the DP table bounds — this is unreachable');
  }
  return value;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const cols = b.length + 1;
  const distances = new Uint32Array((a.length + 1) * cols);

  for (let i = 0; i <= a.length; i += 1) {
    distances[i * cols] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    distances[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const insertCost = cell(distances, i * cols + j - 1) + 1;
      const deleteCost = cell(distances, (i - 1) * cols + j) + 1;
      const substituteCost = cell(distances, (i - 1) * cols + j - 1) + substitutionCost;
      distances[i * cols + j] = Math.min(insertCost, deleteCost, substituteCost);
    }
  }

  return cell(distances, a.length * cols + b.length);
}

/** 1 - distance/maxLength. Two empty strings are treated as identical (1). */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLength;
}
