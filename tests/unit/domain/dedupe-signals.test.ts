import { describe, expect, it } from 'vitest';
import { dedupeSignals, type DedupeCandidate } from '@/server/domain/dedupe-signals';

describe('dedupeSignals', () => {
  it('keeps the higher-confidence signal within a duplicate group', () => {
    const signals: DedupeCandidate[] = [
      { id: 'a', contentHash: 'hash-1', confidence: 0.6, createdAt: new Date('2026-09-01') },
      { id: 'b', contentHash: 'hash-1', confidence: 0.9, createdAt: new Date('2026-09-02') },
    ];

    const result = dedupeSignals(signals);

    expect(result.keep).toEqual(['b']);
    expect(result.supersede).toEqual([{ id: 'a', supersededBy: 'b' }]);
  });

  it('breaks a confidence tie by earliest createdAt', () => {
    const signals: DedupeCandidate[] = [
      { id: 'a', contentHash: 'hash-1', confidence: 0.8, createdAt: new Date('2026-09-02') },
      { id: 'b', contentHash: 'hash-1', confidence: 0.8, createdAt: new Date('2026-09-01') },
    ];

    const result = dedupeSignals(signals);

    expect(result.keep).toEqual(['b']);
    expect(result.supersede).toEqual([{ id: 'a', supersededBy: 'b' }]);
  });

  it('leaves signals with no duplicates untouched', () => {
    const signals: DedupeCandidate[] = [
      { id: 'a', contentHash: 'hash-1', confidence: 0.8, createdAt: new Date('2026-09-01') },
      { id: 'b', contentHash: 'hash-2', confidence: 0.7, createdAt: new Date('2026-09-01') },
    ];

    const result = dedupeSignals(signals);

    expect(result.keep.sort()).toEqual(['a', 'b']);
    expect(result.supersede).toEqual([]);
  });

  it('handles a three-way duplicate group', () => {
    const signals: DedupeCandidate[] = [
      { id: 'a', contentHash: 'hash-1', confidence: 0.5, createdAt: new Date('2026-09-01') },
      { id: 'b', contentHash: 'hash-1', confidence: 0.95, createdAt: new Date('2026-09-02') },
      { id: 'c', contentHash: 'hash-1', confidence: 0.7, createdAt: new Date('2026-09-03') },
    ];

    const result = dedupeSignals(signals);

    expect(result.keep).toEqual(['b']);
    expect(result.supersede.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });
});
