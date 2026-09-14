import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { CLASSIFY_EMAIL_SYSTEM_PROMPT } from '@/server/prompts/classify-email';
import { WRITE_REVIEW_BRIEF_SYSTEM_PROMPT } from '@/server/prompts/write-review-brief';
import { parseDateSpan } from '@/server/domain/parse-date-span';
import { parseAmountSpan } from '@/server/domain/parse-amount-span';

/**
 * Claude classification/extraction — docs/DECISIONS.md's ADR-016
 * reinstates the original ADR-004 design (Haiku 4.5 primary, Sonnet 5
 * escalation) after the Gemini detour (ADR-015) hit a hard 20
 * requests/day/model free-tier cap, and after direct testing of local
 * Ollama models (granite3.3:8b, qwen3:8b, gemma4) confirmed ADR-004's
 * original prediction: small models degrade silently on exactly the hard
 * cases this task has (one had a systematic amount-extraction bug; all
 * three reported near-1.0 confidence regardless of correctness).
 *
 * Escalation to Sonnet is triggered by specific, evidence-based checks
 * (see hasSuspectBillingDate below) — not a confidence threshold.
 * Verbalized confidence (the model self-reporting 0-1) is a real signal
 * for genuine input ambiguity, but it does not track model failure: this
 * app's own date bug was Haiku being consistently confident *and* wrong,
 * which a `confidence < X` gate would never have caught. See
 * docs/LEARNED.md, 2026-09-14, for the fuller reasoning (verbalized
 * confidence, self-consistency, and logprobs all fail on a deterministic
 * error for the same underlying reason: they measure how stable/probable
 * an answer was, not whether it was correct).
 */

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-5';
// Haiku doesn't do adaptive thinking, so 512 is plenty for its fixed-shape
// JSON output. Sonnet 5's adaptive thinking draws from the same max_tokens
// budget as its visible output — on a longer/more complex email it can
// spend the whole 512 thinking internally and return zero text blocks
// (docs/LEARNED.md, 2026-09-14, reproduced 3/3 on a real email). A higher
// ceiling for Sonnet leaves it room to finish thinking and still write the
// actual (short) answer — this does not ask it to write more.
const HAIKU_MAX_OUTPUT_TOKENS = 512;
const SONNET_MAX_OUTPUT_TOKENS = 2048;
const PER_CALL_TIMEOUT_MS = 30_000;

const ClassificationSchema = z.object({
  relevant: z.boolean(),
  signalType: z
    .enum([
      'new',
      'renewal',
      'price_change',
      'trial_conversion',
      'cancellation',
      'payment_failed',
      'paused',
    ])
    .nullable()
    .optional(),
  vendorName: z.string().nullable().optional(),
  // The model returns a verbatim amount span (e.g. "1,490円",
  // "$1,200.00"), not a computed minor-unit integer —
  // parseClassificationResponse converts it via parseAmountSpan. Fixes a
  // confirmed, reproducible bug: Haiku consistently multiplied
  // zero-decimal JPY amounts by 100 anyway despite an explicit prompt
  // instruction not to. See this file's top comment and
  // docs/LEARNED.md, 2026-09-14.
  amountText: z.string().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  // The model returns a verbatim date span (e.g. "September 8, 2027"),
  // not ISO — parseClassificationResponse converts it via
  // parseDateSpan. See this file's top comment and docs/LEARNED.md,
  // 2026-09-13, for why.
  billingDateText: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export interface ClassificationResult {
  signalType:
    | 'new'
    | 'renewal'
    | 'price_change'
    | 'trial_conversion'
    | 'cancellation'
    | 'payment_failed'
    | 'paused';
  vendorName: string;
  amountMinor: number | null;
  currency: string | null;
  billingDate: string | null;
  confidence: number;
}

// Types where a confirmed charge is categorically impossible — the
// prompt already says so for all three, and any billingDate the model
// returns for one of these is a guaranteed contradiction, not a
// probabilistic "maybe wrong." Extended 2026-09-14 (ADR-019) beyond the
// original cancellation-only version after a real, observed failure
// mode: forced into a mismatched category (a pause email with no
// signalType for "pause"), the model didn't leave billingDate null — it
// confidently hallucinated a plausible date from the pause's resume
// date (docs/LEARNED.md, 2026-09-14). This is the deterministic
// counter-measure: corrected here rather than trusted to a prompt
// instruction alone, since there's nothing to get a second opinion
// about — the correct value is null by definition, every time.
const NO_CONFIRMED_CHARGE_TYPES = new Set(['cancellation', 'paused', 'payment_failed']);

function enforceNoConfirmedChargeInvariant(result: ClassificationResult): ClassificationResult {
  if (NO_CONFIRMED_CHARGE_TYPES.has(result.signalType) && result.billingDate !== null) {
    return { ...result, billingDate: null };
  }
  return result;
}

/**
 * Pure — no network call — unit-tested directly against fixture JSON.
 * Model output is untrusted input (docs/TOOLS.md), even though Claude's
 * structured outputs (output_config.format below) are schema-guaranteed
 * by the API itself: validate anyway rather than trusting that guarantee
 * blindly. A schema-validation failure, an explicit "not relevant"
 * classification, or a relevant classification missing a signal type or
 * vendor name all return null rather than throwing — discard-and-move-on.
 * Never logs here — this function only ever sees already-fetched email
 * content as input, and docs/SECURITY.md forbids logging it; the caller
 * (which has a safe message ID to correlate against) decides whether to
 * note the skip.
 */
export function parseClassificationResponse(data: unknown): ClassificationResult | null {
  const parsed = ClassificationSchema.safeParse(data);
  if (!parsed.success) return null;

  const result = parsed.data;
  if (!result.relevant || !result.signalType || !result.vendorName) return null;

  return enforceNoConfirmedChargeInvariant({
    signalType: result.signalType,
    vendorName: result.vendorName,
    amountMinor: parseAmountSpan(result.amountText, result.currency),
    currency: result.currency ?? null,
    billingDate: parseDateSpan(result.billingDateText),
    confidence: result.confidence,
  });
}

// Signal types that inherently have no normal "amount + date" shape to
// show — a review brief is always the right treatment for these,
// regardless of whether amountMinor happens to be populated (a
// payment_failed signal legitimately keeps its attempted-charge amount,
// so the original ADR-018 "all three fields null" check alone wouldn't
// catch it).
const SIGNAL_TYPES_ALWAYS_NEED_REVIEW = new Set(['payment_failed', 'paused']);

/**
 * A signal needs a plain-English review brief (docs/DECISIONS.md
 * ADR-018, extended by ADR-019) either because extraction came back
 * fully empty (the original ADR-018 case), or because its signalType
 * itself represents something a structured amount/date summary can't
 * represent on its own.
 */
export function needsReviewBrief(result: ClassificationResult): boolean {
  if (SIGNAL_TYPES_ALWAYS_NEED_REVIEW.has(result.signalType)) return true;
  return result.amountMinor === null && result.currency === null && result.billingDate === null;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Low-level structured-output call, shared by classifyEmail and
 * writeReviewBrief — same model/timeout/determinism handling regardless
 * of which schema or system prompt is in play.
 */
async function callModel(
  client: Anthropic,
  model: string,
  system: string,
  userMessage: string,
  schema: z.ZodType,
): Promise<unknown> {
  // Deterministic sampling so the same input gives the same output run to
  // run — as deterministic as the API allows; confirmed live that even
  // temperature: 0 has some residual run-to-run variance (docs/LEARNED.md,
  // 2026-09-14), so this reduces but doesn't eliminate flakiness. Haiku
  // 4.5 accepts and honors temperature: 0. Sonnet 5 rejects it outright —
  // confirmed live: `400 "temperature is deprecated for this model"` —
  // its adaptive thinking replaced manual sampling controls, and there's
  // currently no equivalent determinism knob exposed for it.
  const temperatureOptions = model === HAIKU_MODEL ? { temperature: 0 as const } : {};
  const maxTokens = model === HAIKU_MODEL ? HAIKU_MAX_OUTPUT_TOKENS : SONNET_MAX_OUTPUT_TOKENS;

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...temperatureOptions,
    system,
    messages: [{ role: 'user', content: userMessage }],
    // Native structured output (not tool-use) — the SDK constrains
    // decoding to this schema, so the response text is guaranteed valid
    // JSON matching it.
    output_config: { format: zodOutputFormat(schema) },
  }, { timeout: PER_CALL_TIMEOUT_MS });

  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text',
  );
  if (!textBlock) {
    throw new Error(`callModel: ${model} returned no text block.`);
  }
  return tryParseJson(textBlock.text);
}

function buildEmailUserMessage(input: { subject: string; from: string; body: string }): string {
  return `Subject: ${input.subject}\nFrom: ${input.from}\n\n${input.body}`;
}

function getClient(): Anthropic {
  const apiKey = process.env['ANTHROPICS_API_KEY'];
  if (!apiKey) {
    throw new Error('ANTHROPICS_API_KEY is not set.');
  }
  return new Anthropic({ apiKey, maxRetries: 3 });
}

/**
 * A confirmed, reproducible Haiku 4.5 bug (docs/LEARNED.md, 2026-09-13):
 * for a billingDate more than roughly a year out, Haiku would substitute
 * whatever reference date the prompt supplies (here, the email's
 * receivedAt) for the real date, character for character, regardless of
 * instructions not to. Verbatim-span transcription (this file's
 * amountText/billingDateText fields) fixed the *consistent* version of
 * this bug, but a residual, intermittent version remains — see
 * docs/LEARNED.md, 2026-09-14: the same call, unchanged, sometimes still
 * returns this exact signature. Cheaply detectable after the fact
 * regardless of which form it takes. False-positive risk: a real email
 * where the correct billingDate genuinely equals its own received date
 * would also trip this and escalate unnecessarily — an accepted, cheap
 * false positive, not a wrong final answer, since Sonnet re-derives the
 * real value either way.
 */
function hasSuspectBillingDate(result: ClassificationResult, receivedAt: string): boolean {
  return result.billingDate === receivedAt;
}

// Signal types where a stated charge date is the common case — a missing
// billingDate on one of these is worth a second look. Deliberately
// excludes 'cancellation' (already deterministically forced to null by
// enforceCancellationInvariant — never worth escalating, the answer is
// always null by definition).
const SIGNAL_TYPES_USUALLY_HAVE_A_BILLING_DATE = new Set(['new', 'renewal', 'price_change', 'trial_conversion']);

/**
 * A second, independently confirmed Haiku 4.5 failure mode (docs/LEARNED.md,
 * 2026-09-14): a specific vendor name ("ZEE5") reliably broke billingDate
 * extraction to null, 5/5 trials, on emails otherwise identical in
 * structure to ones that classified perfectly — proven by swapping only
 * the vendor name between a broken and a working fixture and watching the
 * failure follow the name in both directions. There's no way to predict
 * which input features will trigger this kind of spurious correlation in
 * advance, so this checks the *output shape* instead: a missing
 * billingDate on a signal type that usually has one is suspicious enough
 * to verify, regardless of why.
 *
 * Real cost, not just theoretical: this also escalates genuinely-correct
 * null cases (an email that truly states no next charge date, e.g. a bare
 * receipt with no renewal info) — a false positive, not a wrong final
 * answer, since Sonnet is expected to also correctly return null for
 * those. It does mean some previously Haiku-only-reliable, free, fully
 * deterministic cases now also take a non-deterministic Sonnet call —
 * verify this doesn't introduce new flakiness into those before trusting
 * it (see the golden-file run after this change).
 */
function hasMissingBillingDateOnATypeThatUsuallyHasOne(result: ClassificationResult): boolean {
  return result.billingDate === null && SIGNAL_TYPES_USUALLY_HAVE_A_BILLING_DATE.has(result.signalType);
}

/**
 * Classifies and extracts in one call per model (docs/TOOLS.md: "One call
 * classifies and extracts. Two calls doubles the cost for no accuracy
 * gain"). Haiku 4.5 runs first for the large majority of traffic; Sonnet
 * 5 only re-runs the email when Haiku's own output didn't validate at all,
 * or shows one of two known suspect signatures (see
 * hasSuspectBillingDate and hasMissingBillingDateOnATypeThatUsuallyHasOne)
 * — targeted, evidence-based escalation triggers, not a confidence
 * threshold (see this file's top comment for why confidence doesn't work
 * for this).
 */
export async function classifyEmail(input: {
  subject: string;
  from: string;
  body: string;
  receivedAt: string;
}): Promise<ClassificationResult | null> {
  const client = getClient();

  // Anchor relative-date reasoning ("ends in 3 days") to when this
  // specific email actually arrived (Gmail's own internalDate — see
  // providers/gmail.ts#parseBodyResponse), not the machine clock at sync
  // time. A backlog sync could process a week-old email hours or days
  // after it arrived; the system clock at that moment has nothing to do
  // with what "in 3 days" meant when the email was sent. The static
  // prompt text stays call-independent per docs/TOOLS.md; this line is
  // appended per call instead, since it varies per email.
  const dateContext = `This email was received on ${input.receivedAt}.`;
  const system = `${CLASSIFY_EMAIL_SYSTEM_PROMPT}\n\n${dateContext}`;
  const userMessage = buildEmailUserMessage(input);

  const haikuData = await callModel(client, HAIKU_MODEL, system, userMessage, ClassificationSchema);
  const haikuRaw = ClassificationSchema.safeParse(haikuData);
  const haikuResult = parseClassificationResponse(haikuData);

  const needsEscalation =
    !haikuRaw.success ||
    (haikuResult !== null &&
      (hasSuspectBillingDate(haikuResult, input.receivedAt) ||
        hasMissingBillingDateOnATypeThatUsuallyHasOne(haikuResult)));
  if (!needsEscalation) {
    return haikuResult;
  }

  const sonnetData = await callModel(client, SONNET_MODEL, system, userMessage, ClassificationSchema);
  const sonnetRaw = ClassificationSchema.safeParse(sonnetData);
  if (sonnetRaw.success) {
    return parseClassificationResponse(sonnetData);
  }
  // Sonnet's output didn't even validate (rare, given structured output
  // is schema-guaranteed) — fall back to Haiku's own take rather than
  // discarding a real signal outright, if Haiku's at least validated.
  return haikuRaw.success ? haikuResult : null;
}

const ReviewBriefSchema = z.object({
  summary: z.string(),
  actionRequired: z.boolean(),
});

export interface ReviewBrief {
  summary: string;
  actionRequired: boolean;
}

/** Pure — unit-tested directly against fixture JSON, same convention as parseClassificationResponse. */
export function parseReviewBriefResponse(data: unknown): ReviewBrief | null {
  const parsed = ReviewBriefSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Called only when a classified signal's amountMinor/currency/billingDate
 * all came back null (docs/DECISIONS.md ADR-018) — writes a short
 * paraphrased brief of what the email says instead of leaving a bare null
 * row. Always Sonnet: this case is already established as needing the
 * stronger model (it's exactly the shape Haiku+Sonnet's classification
 * escalation already failed to extract structured data from). Discard-
 * and-return-null on any failure, same pattern as classifyEmail — the
 * caller inserts the signal either way, just without a brief.
 */
export async function writeReviewBrief(input: {
  subject: string;
  from: string;
  body: string;
}): Promise<ReviewBrief | null> {
  const client = getClient();
  const userMessage = buildEmailUserMessage(input);

  const data = await callModel(
    client,
    SONNET_MODEL,
    WRITE_REVIEW_BRIEF_SYSTEM_PROMPT,
    userMessage,
    ReviewBriefSchema,
  );
  return parseReviewBriefResponse(data);
}
