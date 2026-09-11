/**
 * docs/DATA_MODEL.md's reconciliation Step 1 ("Deduplicate across
 * inboxes"), scoped into Phase 1d per docs/PHASES.md's explicit
 * "Cross-inbox deduplication" checklist item — Phase 1e's (not yet
 * built) reconciliation only ever reads already-deduped `pending`
 * signals.
 *
 * Groups by contentHash; within a group, the highest-confidence signal
 * survives (tie-break: earliest createdAt). The rest are marked for
 * merged_duplicate via the returned `supersede` list. Pure — operates on
 * plain objects, not DB rows — the caller applies the actual updates.
 */

export interface DedupeCandidate {
  id: string;
  contentHash: string;
  confidence: number;
  createdAt: Date;
}

export interface DedupeResult {
  keep: string[];
  supersede: { id: string; supersededBy: string }[];
}

export function dedupeSignals(signals: DedupeCandidate[]): DedupeResult {
  const groups = new Map<string, DedupeCandidate[]>();
  for (const signal of signals) {
    const group = groups.get(signal.contentHash);
    if (group) {
      group.push(signal);
    } else {
      groups.set(signal.contentHash, [signal]);
    }
  }

  const keep: string[] = [];
  const supersede: { id: string; supersededBy: string }[] = [];

  for (const group of groups.values()) {
    const survivor = group.reduce((best, candidate) => {
      if (candidate.confidence > best.confidence) return candidate;
      if (candidate.confidence < best.confidence) return best;
      return candidate.createdAt < best.createdAt ? candidate : best;
    });

    keep.push(survivor.id);
    for (const candidate of group) {
      if (candidate.id !== survivor.id) {
        supersede.push({ id: candidate.id, supersededBy: survivor.id });
      }
    }
  }

  return { keep, supersede };
}
