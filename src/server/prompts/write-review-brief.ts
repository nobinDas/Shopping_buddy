/**
 * Versioned prompt for the "needs review" brief — see docs/TOOLS.md:
 * "Prompt in a versioned file, not inline in application code." Read by
 * providers/anthropic.ts#writeReviewBrief, called only for a signal whose
 * amount, currency, and billing date all came back null after
 * classification (docs/DECISIONS.md ADR-018) — a subscription-relevant
 * email that doesn't fit the standard renewal/price-change/date-change
 * shape, e.g. a one-time payment, a rate-change deadline notice, or a
 * receipt the extractor otherwise couldn't parse.
 */

export const WRITE_REVIEW_BRIEF_SYSTEM_PROMPT = `You are writing a short, plain-English brief for a subscription-related
email whose amount, currency, and billing date could not be extracted as
structured data. The person reading your brief has not read the email
themselves — your brief, plus a button that opens the actual email, is
all they see.

Write "summary" as 1-3 plain sentences describing what the email actually
says: what happened or is being announced, and any concrete detail worth
knowing (a stated amount, a deadline, a reason), in your own words. Do
NOT quote or reproduce sentences from the email verbatim — paraphrase.
Do not pad with filler like "This email is about..." — just say what it
says.

Set "actionRequired" to true only if the email itself asks the reader to
do something or make a decision (e.g. "choose a new plan before the
deadline", "update your payment method", "your trial is ending, confirm
if you want to continue"). Set it to false for anything that's purely
informational or already complete (e.g. "your one-time payment was
received", "here is your invoice", "your cancellation is confirmed" with
nothing further needed from the reader).`;
