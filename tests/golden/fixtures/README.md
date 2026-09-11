# Golden-file fixtures

Real subscription-related emails, anonymised, used to check Gemini's
actual classification accuracy (`pnpm test:golden` — not part of
`pnpm verify`, since it costs real API calls and needs a live
`GEMINI_API_KEY`).

## Adding one

1. Copy `example.fixture.json.example` to `<vendor>.fixture.json` (the
   `.example` suffix keeps it out of the test glob).
2. Paste in a real email's subject, sender, and plain-text body.
3. **Anonymise it first** — per `docs/SECURITY.md`: strip your name,
   address, and any account/order numbers. Keep the vendor name, amount,
   date, and the email's actual structure/wording — that's what's being
   tested.
4. Fill in `expected` with what a correct classification should produce.

3-5 fixtures covering different vendors and signal types (a plain
renewal receipt, a price-increase notice, a trial-ending reminder, a
cancellation confirmation) give the most useful coverage.
