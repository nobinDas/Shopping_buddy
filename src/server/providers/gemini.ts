import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { CLASSIFY_EMAIL_SYSTEM_PROMPT, CLASSIFY_EMAIL_RESPONSE_SCHEMA } from '@/server/prompts/classify-email';

/**
 * Gemini (Google AI Studio) classification — replaces the Claude choice
 * pre-reasoned in docs/TOOLS.md; see docs/DECISIONS.md's Phase 1d ADR for
 * why (a genuine free tier, at the cost of free-tier inputs/outputs
 * possibly being used to improve Google's models — a disclosed tradeoff
 * the user accepted for the development phase). Single-tier: no paid
 * escalation model for low-confidence cases, by explicit choice.
 */

// Confirmed via research to be on the free tier (1,500 requests/day) as
// of this phase — revisit if Google's free-tier model lineup changes.
const MODEL = 'gemini-2.5-flash';

const ClassificationSchema = z.object({
  relevant: z.boolean(),
  signalType: z
    .enum(['new', 'renewal', 'price_change', 'trial_conversion', 'cancellation'])
    .nullable()
    .optional(),
  vendorName: z.string().nullable().optional(),
  amountMinor: z.number().int().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  billingDate: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export interface ClassificationResult {
  signalType: 'new' | 'renewal' | 'price_change' | 'trial_conversion' | 'cancellation';
  vendorName: string;
  amountMinor: number | null;
  currency: string | null;
  billingDate: string | null;
  confidence: number;
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Model output is untrusted input (docs/TOOLS.md): a schema-validation
 * failure, an explicit "not relevant" classification, or a relevant
 * classification missing a signal type or vendor name (nothing usable to
 * build a detected_signals row from) all return null rather than
 * throwing — discard-and-move-on, not an exceptional failure. Never logs
 * here — this function only ever sees the already-fetched email content
 * as input, and docs/SECURITY.md forbids logging it; the caller (which
 * has a safe message ID to correlate against) decides whether to note the
 * skip.
 */
export function parseClassificationResponse(data: unknown): ClassificationResult | null {
  const parsed = ClassificationSchema.safeParse(data);
  if (!parsed.success) return null;

  const result = parsed.data;
  if (!result.relevant || !result.signalType || !result.vendorName) return null;

  return {
    signalType: result.signalType,
    vendorName: result.vendorName,
    amountMinor: result.amountMinor ?? null,
    currency: result.currency ?? null,
    billingDate: result.billingDate ?? null,
    confidence: result.confidence,
  };
}

/**
 * Classifies and extracts in one call (docs/TOOLS.md: "One call
 * classifies and extracts. Two calls doubles the cost for no accuracy
 * gain") using Gemini's structured JSON output. Throws only on a genuine
 * request failure (missing key, network, auth, rate limit) — a bad or
 * "not relevant" model response returns null via
 * parseClassificationResponse, it doesn't throw.
 */
export async function classifyEmail(input: {
  subject: string;
  from: string;
  body: string;
}): Promise<ClassificationResult | null> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [{ text: `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.body}` }],
      },
    ],
    config: {
      systemInstruction: CLASSIFY_EMAIL_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: CLASSIFY_EMAIL_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('classifyEmail: Gemini returned no text.');
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  return parseClassificationResponse(data);
}
