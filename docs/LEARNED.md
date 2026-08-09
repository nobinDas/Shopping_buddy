# Learned

A running log of things learned building this — for two audiences.

**Now:** stopping to write down why something was wrong is how the correction
actually sticks.

**Later:** this is the raw material for the portfolio write-up. "Built a
subscription tracker" is a sentence anyone can write. "Discovered that email
detection was quietly overwriting manually entered subscriptions, and inverted the
data model so detection can only propose" is evidence of engineering judgement.
The second one only exists if it was written down when it happened.

## What belongs here

- A wrong assumption that got corrected
- A bug whose cause was more interesting than its fix
- A trade-off understood only after building the wrong version first
- A tool or API that behaved differently than the docs suggested
- A design decision reversed, and what forced the reversal

## What does not

- Things looked up and immediately understood. That is reference, not learning.
- Routine syntax and API usage.
- Anything that would read as "learned how to use X." The interesting part is
  always what X got wrong, or what using it revealed about the problem.

## Format

```
### YYYY-MM-DD — Short title
**Context:** what was being worked on
**What I thought:** the assumption going in
**What was actually true:** what turned out to be the case
**Why it matters:** the transferable part — the thing that applies beyond this bug
**Portfolio-worthy:** yes / no
```

The **why it matters** line is the one that does the work. It is the difference
between a debugging note and an insight, and it is what makes the entry usable in
a write-up months later.

Mark entries `Portfolio-worthy: yes` sparingly — five strong entries make a better
project description than thirty thin ones.

---

## Entries

_Newest first._

### 2026-08-08 — Manual entry as primary source, not fallback
**Context:** Scoping the Phase 1 data model, before writing any code.
**What I thought:** Email parsing is the product, and manual entry is the fallback
for whatever the parser misses.
**What was actually true:** That ordering has two failures. Email detection cannot
see a complete picture until it has observed a full billing cycle for every
service — so the dashboard is wrong for weeks and the user cannot tell which parts
are missing. And some subscriptions leave no email trail at all: cash payments,
family-plan add-ons, employer-provided services. Those are never caught, no matter
how good the parser is. Inverting it — manual entry as the authoritative source,
detection as confirmation — gives a complete picture on day one and turns the
parser's job into verification, which is a much easier problem than discovery.
**Why it matters:** When a system has an automated source and a human source, the
question is not which is more accurate. It is which one is *complete*, and which
failure mode is visible to the user. An automated source that is silently
incomplete is worse than a manual one that is obviously partial. The reconciliation
invariant — detection may confirm or propose, never overwrite — falls straight out
of this.
**Portfolio-worthy:** yes

### 2026-08-08 — Descoping the hardest feature made the project viable
**Context:** The original concept had the agent re-quoting auto insurance monthly
to find cheaper policies.
**What I thought:** It is a lot of integration work, but it is the highest-value
feature — the one that saves real money.
**What was actually true:** There is no viable public API for multi-insurer
quoting. The comparison engines are themselves businesses built on scraping and
partnership deals. Building it means depending on one of them as an intermediary
or accepting something fragile and manual-assisted. Meanwhile, insurance as a
*tracked* recurring cost with renewal reminders is nearly free — it is the same
data model as a subscription — and delivers most of the practical benefit, because
the reason people overpay is usually that the renewal passed unnoticed, not that
they could not find the comparison site.
**Why it matters:** The most compelling feature and the most feasible one are
often not the same, and the gap is usually a data-access problem rather than an
engineering one. Checking whether the data is actually reachable, before designing
around it, is cheap. Removing the feature and keeping the underlying value is
often available if you look for it.
**Portfolio-worthy:** yes
