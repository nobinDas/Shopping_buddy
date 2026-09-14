# Golden-file fixtures

Real subscription-related emails, anonymised, used to check Claude's
actual classification accuracy (`pnpm test:golden` — not part of
`pnpm verify`, since it costs real API calls and needs a live
`ANTHROPICS_API_KEY`).

## Adding one

1. Copy `example.fixture.json.example` to `<vendor>.fixture.json` (the
   `.example` suffix keeps it out of the test glob).
2. Paste in a real email's subject, sender, and plain-text body.
3. **Anonymise it first** — per `docs/SECURITY.md`: strip your name,
   address, and any account/order numbers. Keep the vendor name, amount,
   date, and the email's actual structure/wording — that's what's being
   tested.
4. Fill in `receivedDate` (ISO `YYYY-MM-DD`) — stands in for Gmail's real
   `internalDate` (when this email would have arrived), since a fixture
   has no real Gmail message behind it. This is what `classifyEmail`
   anchors relative-date reasoning to (e.g. "ends in 3 days") — pick a
   date consistent with the email's own story (e.g. a multi-year prepaid
   renewal's `receivedDate` should be that many years before its stated
   next renewal date).
5. Fill in `expected` with what a correct classification should produce —
   or `{"relevant": false}` if this fixture is a deliberate false
   positive (something that merely looks subscription-shaped but isn't,
   e.g. a one-time purchase).

3-5 fixtures covering different vendors and signal types (a plain
renewal receipt, a price-increase notice, a trial-ending reminder, a
cancellation confirmation) give the most useful coverage.
