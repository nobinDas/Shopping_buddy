import { createHash } from 'node:crypto';

/**
 * Cross-inbox dedupe key: sender + subject + extracted amount + extracted
 * date, hashed. The same receipt forwarded to (or landing independently
 * in) two connected inboxes has two message IDs but produces the same
 * hash — one real-world event, not two. See docs/DATA_MODEL.md.
 *
 * Deterministic and pure — a SHA-256 over a canonicalized string, no
 * randomness, no I/O. Sender/subject come from the raw email (pre-LLM);
 * amount/date come from the LLM's extraction (post-LLM) — this
 * genuinely needs both, so it's computed after classification, not
 * during the pre-filter.
 */
export function computeContentHash(input: {
  sender: string;
  subject: string;
  amountMinor: number | null;
  billingDate: string | null;
}): string {
  const canonical = [
    input.sender.trim().toLowerCase(),
    input.subject.trim().toLowerCase(),
    input.amountMinor ?? '',
    input.billingDate ?? '',
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}
