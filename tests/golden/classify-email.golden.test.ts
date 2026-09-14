import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyEmail } from '@/server/providers/anthropic';

/**
 * Runs real, anonymised subscription emails through the real Claude API
 * (Haiku 4.5, escalating to Sonnet 5 on low confidence) — not mocked,
 * unlike every other test in this repo, because this specifically
 * measures real classification accuracy. See
 * tests/golden/fixtures/README.md for how to add fixtures. Deliberately
 * not part of `pnpm verify` (real API cost + needs a live key) — run
 * explicitly via `pnpm test:golden`, and after any prompt change.
 */

interface GoldenFixture {
  subject: string;
  from: string;
  body: string;
  // Stands in for Gmail's real internalDate (providers/gmail.ts) — when
  // this email would have arrived. Required so date-extraction tests
  // (relative phrases, far-future absolute dates) run against a fixed,
  // fixture-authored anchor rather than whatever day the suite happens
  // to run on.
  receivedDate: string;
  // A false-positive fixture (e.g. a one-time purchase that merely looks
  // subscription-shaped) asserts classifyEmail correctly returns null —
  // relevant defaults to true when omitted, matching every existing
  // fixture that predates this shape.
  expected:
    | { relevant: false }
    | {
        relevant?: true;
        signalType: 'new' | 'renewal' | 'price_change' | 'trial_conversion' | 'cancellation';
        vendorName: string;
        amountMinor: number | null;
        currency: string | null;
        billingDate: string | null;
      };
}

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures');

/** Recurses one level of subdirectories — fixtures can live directly in
 * fixtures/ or grouped under a subfolder (e.g. fixtures/files/), either
 * works. */
function findFixtureFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...findFixtureFiles(fullPath));
    } else if (entry.endsWith('.fixture.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function loadFixtures(): { name: string; fixture: GoldenFixture }[] {
  return findFixtureFiles(FIXTURES_DIR).map((path) => ({
    name: path.slice(FIXTURES_DIR.length + 1),
    fixture: JSON.parse(readFileSync(path, 'utf-8')) as GoldenFixture,
  }));
}

const apiKeySet = Boolean(process.env['ANTHROPICS_API_KEY']);
const fixtures = loadFixtures();

describe.skipIf(!apiKeySet || fixtures.length === 0)('classifyEmail — golden file set', () => {
  if (!apiKeySet) {
    console.warn('Skipping golden-file tests: ANTHROPICS_API_KEY is not set.');
  } else if (fixtures.length === 0) {
    console.warn(
      'Skipping golden-file tests: no fixtures in tests/golden/fixtures/ — see its README.md.',
    );
  }

  for (const { name, fixture } of fixtures) {
    it(
      `classifies ${name} correctly`,
      async () => {
        const result = await classifyEmail({
          subject: fixture.subject,
          from: fixture.from,
          body: fixture.body,
          receivedAt: fixture.receivedDate,
          traceLabel: name,
        });

        if (fixture.expected.relevant === false) {
          // The model should recognize this isn't actually a
          // subscription-relevant signal — classifyEmail returns null per
          // parseClassificationResponse's discard-and-move-on contract.
          expect(result).toBeNull();
          return;
        }

        const expected = fixture.expected;
        expect(result).not.toBeNull();
        expect(result?.signalType).toBe(expected.signalType);
        expect(result?.vendorName.toLowerCase()).toContain(expected.vendorName.toLowerCase());
        expect(result?.amountMinor).toBe(expected.amountMinor);
        expect(result?.currency).toBe(expected.currency);
        expect(result?.billingDate).toBe(expected.billingDate);
        // A real, if fuzzy, sanity check — a correct classification should
        // rarely come back with low self-reported confidence.
        expect(result?.confidence).toBeGreaterThan(0.5);
      },
      // classifyEmail may call both Haiku and Sonnet (escalation), each
      // with the SDK's own built-in retry (up to 3 attempts, 30s each) on
      // a transient failure — worst case is well past vitest's 5s default.
      120_000,
    );
  }
});
