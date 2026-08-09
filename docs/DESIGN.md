# Design

## The job the interface has to do

Someone opens this app to find out something they have been half-avoiding. The
number is going to be bigger than they expected. The interface should make that
number legible and calm — not alarming, not gamified, not cheerful about it.

That single constraint drives everything below. Overhead is an **instrument**, not
a dashboard product. It reads a quantity that already exists and presents it
precisely. Closer to a utility meter or a statement than to a fintech app.

## Direction

**Statement precision.** The visual vernacular is the billing statement and the
meter reading: tabular figures, ruled alignment, restrained colour, generous
whitespace around dense numeric blocks. Nothing decorative competes with the
numbers, because the numbers *are* the content.

The deliberate risk: almost no colour. Colour appears only where it carries
meaning — a price increased, a renewal is close, a subscription is unconfirmed.
On a screen where three things are coloured, those three things are the message.
Most finance UIs spend colour everywhere and it stops signifying anything.

### Signature element — the burn ribbon

A single horizontal strip across the top of the dashboard: twelve months, every
recurring commitment drawn as a band positioned on its billing date and scaled by
amount. A year of committed spending readable in one glance, showing the thing a
list cannot — clustering. Three annual renewals landing in the same fortnight is
a fact about your year, and no table communicates it.

This is the one place to spend effort and boldness. Everything else stays quiet.

### Tokens

Starting point. Revise deliberately, not by drift, and record any change here.

```css
--ground:    #12161A;   /* deep blue-black — dark surfaces, ribbon field */
--surface:   #EEF0EC;   /* cool grey-green paper, not cream */
--surface-2: #E2E5E0;   /* recessed panels, table zebra */
--ink:       #14181A;   /* primary text */
--ink-muted: #5D6560;   /* labels, captions, secondary */
--rule:      #C9CEC7;   /* hairlines, table borders */

/* Signal colours. Used sparingly and only with meaning. */
--flag:      #7A2E3C;   /* oxblood — price increase, action needed */
--verified:  #2F6F6A;   /* verdigris — confirmed against email */
--pending:   #B07A1E;   /* ochre — detected, awaiting review */
```

Oxblood and verdigris rather than red and green: they carry the same semantics
without the traffic-light register, and they sit correctly against a cool paper
ground. The palette avoids warm cream with terracotta — that combination has
become the default look of AI-generated interfaces and reads as unconsidered.

### Type

| Role | Face | Why |
| --- | --- | --- |
| Display | Bricolage Grotesque | Variable width and optical size; character at large sizes without ornament |
| Body / UI | IBM Plex Sans | Quiet, engineered register; sits in the utility-document world |
| Numerals | IBM Plex Mono | **Tabular figures.** Every money value uses this, always |

Money in a proportional face means columns of digits that do not align, and
misaligned digits are harder to compare. Tabular figures are a functional
requirement here, not a style preference.

Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64. Display weights 500–700, body 400–500.

### Copy

- Say what happened: "Netflix went from $15.49 to $17.99 on 3 March."
- Empty states invite action: "Nothing tracked yet. Add the first subscription
  you know you pay for."
- Errors state the problem and the fix, without apologising: "Gmail connection
  expired. Reconnect to resume syncing."
- A button's verb survives into its confirmation. "Confirm" produces "Confirmed."
- Never call it a "subscription record" in the UI. It is a subscription.

## Higgsfield — what it does here

Higgsfield generates the **visual assets**. It does not host or build the app.

Worth being explicit about why, because Higgsfield genuinely can build and deploy
full-stack sites: its website builder scaffolds a React app into a Cloudflare
Worker on a Higgsfield-hosted public subdomain, oriented toward publishing and
community discovery. That is a good fit for a landing page or a demo. It is the
wrong home for an application holding read-only OAuth tokens for personal
inboxes and a record of personal billing data — that wants a private deployment
under your own auth, on infrastructure you control, with your own database.

So the split:

**Higgsfield generates:**
- Brand mark and wordmark explorations
- Illustration for empty states — the moments where the screen would otherwise be
  a blank table
- Texture and field imagery for the burn ribbon's background, if the flat
  treatment reads too plain
- Portfolio and case-study visuals: hero image, feature stills, walkthrough video
- Optionally, a standalone public landing page for the project, separate from the
  app itself

**Higgsfield does not:**
- Host or deploy the application
- Generate functional UI components — those are shadcn/ui primitives styled with
  the tokens above, because they need to be accessible, keyboard-navigable, typed,
  and testable
- Produce anything with real financial figures in it. Portfolio assets use
  synthetic data. Never generate marketing material from a real dashboard.

### Asset conventions

- Export at 2× minimum; SVG wherever the asset is vector-appropriate
- Generate against the palette above — pass the hex values in the prompt rather
  than colour-correcting afterwards
- Store under `public/brand/` and `public/illustration/`
- Record the generating prompt in `docs/assets.md` so an asset can be regenerated
  consistently later

## Quality floor

Not negotiable, and not worth announcing in the UI:

- Responsive to 375px. The burn ribbon becomes vertical below 768px rather than
  scrolling horizontally — a horizontally scrolling chart hides exactly the
  clustering the ribbon exists to show.
- Visible keyboard focus on every interactive element.
- `prefers-reduced-motion` respected. The ribbon's entrance animation is the only
  motion in the app; it is the first thing to disable.
- Contrast meets WCAG AA. Check `--ink-muted` on `--surface-2` specifically — it
  is the pairing most likely to fail.
- Every figure that can be zero has a designed zero state. "$0.00" and "—" mean
  different things: nothing spent, versus nothing known.
