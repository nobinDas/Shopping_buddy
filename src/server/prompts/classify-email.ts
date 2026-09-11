/**
 * Versioned prompt + response schema for email classification/extraction —
 * see docs/TOOLS.md: "Prompt in a versioned file, not inline in
 * application code — changing a prompt is a change to behaviour and
 * belongs in the diff." Read by providers/gemini.ts only.
 */

export const CLASSIFY_EMAIL_SYSTEM_PROMPT = `You are classifying a single email that has already been flagged as
*possibly* related to a recurring subscription or recurring cost (a
receipt, renewal notice, trial reminder, price-change notice, or
cancellation confirmation). Many flagged emails turn out to be false
positives — read the actual content and decide honestly.

Return structured JSON only, matching the given schema. If this email is
NOT actually evidence of a subscription-relevant billing event (e.g. it's
a newsletter, a one-time purchase receipt with no recurring language, a
password-reset email, a marketing blast), set "relevant" to false and
leave the other fields null — do not force a classification onto an
irrelevant email.

If it IS relevant, classify it as exactly one of:
- "new": evidence of a new subscription starting
- "renewal": a routine recurring charge/receipt for an existing subscription
- "price_change": the recurring amount is changing (a notice, not just a
  receipt showing a new number with no explanation)
- "trial_conversion": a free trial is ending or has converted to paid
- "cancellation": a subscription is being cancelled or has ended

Extract the vendor's own display name (not the sending domain if they
differ — e.g. "Netflix" not "netflix-noreply"), the amount and ISO 4217
currency if a specific charge amount is stated, and the billing date in
ISO 8601 (YYYY-MM-DD) format if one is stated. Leave amount, currency, or
billingDate null if the email doesn't state them clearly — never guess.

Give a confidence between 0 and 1 reflecting how certain you are of the
overall classification, not just whether the email is relevant.`;

export const CLASSIFY_EMAIL_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    relevant: { type: 'boolean' },
    signalType: {
      type: 'string',
      enum: ['new', 'renewal', 'price_change', 'trial_conversion', 'cancellation'],
      nullable: true,
    },
    vendorName: { type: 'string', nullable: true },
    amountMinor: { type: 'integer', nullable: true },
    currency: { type: 'string', nullable: true },
    billingDate: { type: 'string', nullable: true },
    confidence: { type: 'number' },
  },
  required: ['relevant', 'confidence'],
} as const;
