/**
 * Versioned prompt for email classification/extraction — see
 * docs/TOOLS.md: "Prompt in a versioned file, not inline in application
 * code — changing a prompt is a change to behaviour and belongs in the
 * diff." Read by providers/anthropic.ts, which builds its own response
 * schema from a Zod object (not exported from here) via
 * @anthropic-ai/sdk's zodOutputFormat.
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

Extract vendorName as the actual subscribed *service* (e.g. "HBO Max",
"Netflix"), not the sending domain if they differ (e.g. "Netflix" not
"netflix-noreply"), and not the payment platform or processor the receipt
came from if a different underlying service is named in the body (e.g. an
"Apple" or "Google Play" receipt for a subscription to "HBO Max" —
vendorName is "HBO Max", the platform is not the vendor).

For amountText: copy the charge amount **exactly as it is printed** in
the email — the identical characters, digits, and separators, in
whichever format or currency symbol the email uses (e.g. "$9.99",
"1,490円", "Rs. 499", "8,99 EUR", "$1,200.00"). Do not convert it,
reformat it, multiply it, or compute anything from it — this field is a
verbatim copy, not a calculation. A separate step elsewhere converts it
to a standard minor-unit amount for whichever currency it turns out to
be; your only job is finding the right amount and reproducing it
unchanged. Also extract the ISO 4217 currency code (e.g. "USD", "JPY",
"EUR") if it's stated or clearly implied by a symbol/context. Leave
amountText or currency null if the email doesn't state a specific charge
amount clearly — never guess, and never fill in a distractor number that
isn't the actual charge (e.g. a stated savings/discount amount, or an
amount attached to a different plan than the one being billed).

For billingDateText: copy the date **exactly as it is printed in the
email** — the identical characters, in whichever format, language, or
digit order the email uses (e.g. "September 8, 2027", "10/15/2026", "15
October 2026", "7. Oktober 2026", "2026年10月5日"). Do not convert it,
reformat it, or compute anything from it — this field is a verbatim
copy, not a calculation. A separate step elsewhere converts it to a
standard date; your only job is finding the right span of text and
reproducing it unchanged, including the year exactly as printed. Use the
date of the charge being described, or — if the email instead states
when the *next* charge will happen (e.g. "your next payment date is...",
"you'll be billed again on...") — copy that next-charge date instead.

A charge date only counts as billingDateText when the email confirms it
will actually happen — not merely that access continues until then. Two
cases where a future-looking date is NOT billingDateText: (1) a
cancellation, where "access continues through..." or "your plan ends
on..." is an access/service end date with no charge behind it; (2) a
conditional continuation, like a gift subscription or trial that
"switches to [some lesser tier] unless you add a payment method" — the
date something *ends* is not a confirmed future charge, since whether
any charge happens at all is still an open question. In both cases,
billingDateText is null even though a specific date is mentioned.

If the email gives only a *relative* time reference (e.g. "ends in 3
days", "renews next month") with no absolute date anywhere in the
message, leave billingDateText null — do not write out a computed
absolute date yourself, even using the email's received-date context
described below; that context exists only to help you judge roughly
what a relative phrase means, never to manufacture a value for this
field. Leave billingDateText null whenever no absolute, confirmed charge
date is printed in the email itself — never guess, and never write the
received date into this field.

Give a confidence between 0 and 1 reflecting how certain you are of the
overall classification, not just whether the email is relevant.`;
