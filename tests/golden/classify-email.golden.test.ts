import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyEmail } from '@/server/providers/gemini';

/**
 * Runs real, anonymised subscription emails through the real Gemini API
 * — not mocked, unlike every other test in this repo, because this
 * specifically measures real classification accuracy. See
 * tests/golden/fixtures/README.md for how to add fixtures. Deliberately
 * not part of `pnpm verify` (real API cost + needs a live key) — run
 * explicitly via `pnpm test:golden`, and after any prompt change.
 */

interface GoldenFixture {
  subject: string;
  from: string;
  body: string;
  expected: {
    signalType: 'new' | 'renewal' | 'price_change' | 'trial_conversion' | 'cancellation';
    vendorName: string;
    amountMinor: number | null;
    currency: string | null;
    billingDate: string | null;
  };
}

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

function loadFixtures(): { name: string; fixture: GoldenFixture }[] {
  const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.fixture.json'));
  return files.map((name) => ({
    name,
    fixture: JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf-8')) as GoldenFixture,
  }));
}

const apiKeySet = Boolean(process.env['GEMINI_API_KEY']);
const fixtures = loadFixtures();

describe.skipIf(!apiKeySet || fixtures.length === 0)('classifyEmail — golden file set', () => {
  if (!apiKeySet) {
    console.warn('Skipping golden-file tests: GEMINI_API_KEY is not set.');
  } else if (fixtures.length === 0) {
    console.warn(
      'Skipping golden-file tests: no fixtures in tests/golden/fixtures/ — see its README.md.',
    );
  }

  for (const { name, fixture } of fixtures) {
    it(`classifies ${name} correctly`, async () => {
      const result = await classifyEmail({
        subject: fixture.subject,
        from: fixture.from,
        body: fixture.body,
      });

      expect(result).not.toBeNull();
      expect(result?.signalType).toBe(fixture.expected.signalType);
      expect(result?.vendorName.toLowerCase()).toContain(fixture.expected.vendorName.toLowerCase());
      expect(result?.amountMinor).toBe(fixture.expected.amountMinor);
      expect(result?.currency).toBe(fixture.expected.currency);
      expect(result?.billingDate).toBe(fixture.expected.billingDate);
      // A real, if fuzzy, sanity check — a correct classification should
      // rarely come back with low self-reported confidence.
      expect(result?.confidence).toBeGreaterThan(0.5);
    });
  }
});
