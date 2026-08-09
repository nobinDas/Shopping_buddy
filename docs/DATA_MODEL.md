# Data model

Schema and the reconciliation algorithm. If the reconciliation section and the
code ever disagree, this file is the spec and the code is the bug.

## Money

Every monetary value is stored as **integer minor units** with an ISO-4217
currency code alongside it.

```ts
amount_minor: integer   // 1299 = $12.99
currency:     char(3)   // 'USD'
```

Floats accumulate representation error, and a personal-finance tool whose totals
drift is worse than no tool. Never store, sum, or compare money as a float.
Helpers live in `src/lib/money.ts` and nothing else does money arithmetic.

## Core tables

### `subscriptions`

The canonical record. This is what the user sees and what the dashboard sums.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `name` | text | Display name, user-editable |
| `vendor_key` | text | Normalised matching key — lowercased, punctuation stripped |
| `amount_minor` | integer | |
| `currency` | char(3) | |
| `cycle` | enum | `monthly` `quarterly` `semiannual` `annual` `custom` |
| `cycle_days` | integer | Only when `cycle = custom` |
| `anchor_date` | date | The billing date all future dates derive from |
| `next_billing_date` | date | Derived; recomputed, never hand-edited |
| `category` | enum | `software` `media` `insurance` `utility` `other` |
| `source` | enum | `manual` `detected` `manual_confirmed` |
| `status` | enum | `active` `paused` `cancelled` `archived` |
| `notes` | text | |
| `created_at` / `updated_at` | timestamptz | |

`source` matters. `manual` is user-asserted and unverified. `manual_confirmed` is
user-asserted and corroborated by a detected signal. `detected` came from email
and was accepted by the user in the review queue. **Nothing is written directly
as `detected` without user acceptance** — discovery produces a proposal, not a row.

### `price_history`

Append-only. Never update a subscription's amount in place; write history and
recompute. This is what makes a silent price increase visible.

| Column | Type |
| --- | --- |
| `id` | uuid |
| `subscription_id` | uuid |
| `amount_minor` | integer |
| `currency` | char(3) |
| `effective_from` | date |
| `source` | enum `manual` \| `detected` |
| `signal_id` | uuid, nullable |

### `email_accounts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `provider` | enum | `google` \| `microsoft` |
| `email_address` | text | |
| `access_token_enc` | bytea | Encrypted at rest — see `SECURITY.md` |
| `refresh_token_enc` | bytea | Encrypted at rest |
| `token_expires_at` | timestamptz | |
| `sync_cursor` | text | Provider history ID / delta token |
| `last_synced_at` | timestamptz | |
| `status` | enum | `active` \| `needs_reauth` \| `disconnected` |

### `detected_signals`

What extraction produced. **Never stores the email body.**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `account_id` | uuid | |
| `message_id` | text | Provider ID, for idempotency |
| `content_hash` | text | Sender + subject + amount + date, hashed — cross-inbox dedupe key |
| `signal_type` | enum | `new` `renewal` `price_change` `trial_conversion` `cancellation` |
| `vendor_key` | text | |
| `amount_minor` / `currency` | | Nullable — not every signal carries a price |
| `billing_date` | date | Nullable |
| `confidence` | numeric | 0–1, from the model |
| `status` | enum | `pending` `matched` `merged_duplicate` `dismissed` |
| `superseded_by` | uuid | Set on the losing row when duplicates collapse |

Unique index on `(account_id, message_id)` — the same message never produces two
signals, which makes sync retries safe.

### `reconciliation_proposals`

Every disagreement or discovery surfaces here rather than mutating data silently.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | |
| `signal_id` | uuid | |
| `subscription_id` | uuid, nullable | Null means a discovery |
| `proposal_type` | enum | `confirm` `price_update` `date_update` `discovery` `cancellation` |
| `proposed_changes` | jsonb | |
| `reasoning` | text | **Required.** Why the system thinks this |
| `status` | enum | `pending` `accepted` `rejected` |
| `resolved_at` | timestamptz | |

`reasoning` is not optional and not decorative. It is the difference between an
auditable suggestion and a black box moving money numbers around.

## Reconciliation

Runs after deduplication, on `pending` signals. Pure function in
`src/server/domain/reconcile.ts` — no I/O, so the whole matrix below is unit-testable.

### Step 1 — Deduplicate across inboxes

Group pending signals by `content_hash`. Within a group keep the highest
confidence (tie-break: earliest received). Mark the rest `merged_duplicate` with
`superseded_by` pointing at the survivor.

The hash is deliberately *not* the message ID: the same receipt forwarded to two
inboxes has two message IDs and is one event.

### Step 2 — Find candidate matches

For each surviving signal, score candidate subscriptions:

| Test | Weight |
| --- | --- |
| Exact `vendor_key` match | 0.5 |
| Fuzzy vendor match (normalised Levenshtein ≥ 0.85) | 0.3 |
| Amount within 1% | 0.3 |
| Billing date within ±3 days of expected | 0.2 |
| Same currency | required — no cross-currency match |

Thresholds:

- **≥ 0.7** → confident match, proceed to Step 3
- **0.4 – 0.7** → ambiguous, surface to the user with both candidates
- **< 0.4** → no match, treat as a discovery

Weights are a starting point. Tune against the golden-file corpus and record any
change in `DECISIONS.md` with the measured effect.

### Step 3 — Classify the outcome

| Signal vs. subscription | Outcome |
| --- | --- |
| Amount and date agree | `confirm` — set `source = manual_confirmed`, update `last_verified_at`. Applies automatically; it asserts nothing new. |
| Amount differs | `price_update` proposal. **Never auto-applied.** Writes `price_history` on acceptance. |
| Date differs beyond tolerance | `date_update` proposal |
| Signal is `cancellation` | `cancellation` proposal |
| No candidate above 0.4 | `discovery` proposal — a subscription being paid for but never listed |

### The invariant

**Detection never overwrites a user-entered value.** It confirms, or it proposes.
Confirmation is safe to automate because it changes no user-asserted fact. Every
other outcome waits for the user.

This is the whole reason manual entry is the primary source. If detection could
overwrite, a single mis-extraction would corrupt the record the user trusts most,
and they would have no way of knowing.

### Test cases the implementation must handle

- Same vendor, two subscriptions, different tiers (personal and family plan)
- Annual and monthly plans for the same vendor held simultaneously
- Vendor renames mid-relationship
- Currency change on the same subscription
- Free trial converting to paid — a price change from zero, not a new subscription
- Receipt forwarded to a second inbox weeks later
- A subscription paid through a third party (app store) where the vendor string
  is the store, not the service
