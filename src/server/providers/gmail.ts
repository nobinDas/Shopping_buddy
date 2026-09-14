import 'server-only';

/**
 * Gmail message-reading adapter — separate from providers/google.ts,
 * which is OAuth/identity only (see that file's own comment anticipating
 * this one). Read-only: gmail.readonly is the only scope this app has
 * ever requested. One function per concern, matching
 * docs/ARCHITECTURE.md's "one adapter per external system" rule.
 *
 * Each network-calling function is a thin wrapper around a pure
 * `parseXResponse` function — same split every other provider in this
 * app uses (e.g. serpapi.ts, google-shopping.ts), so the parsing logic is
 * unit-testable against fixture JSON without mocking fetch.
 */

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
// How many messages a brand-new account's first sync looks at — capped
// deliberately, same "deliberately narrow" posture as every other
// external-API integration in this app. A full backlog scan isn't the
// goal; picking up from here forward is.
const FIRST_SYNC_LIMIT = 50;

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

async function getJson(url: string, accessToken: string): Promise<unknown> {
  const response = await fetch(url, { headers: authHeaders(accessToken) });
  if (!response.ok) {
    throw new Error(`Gmail API ${url} responded ${String(response.status)}`);
  }
  return response.json();
}

// ── Profile / recent messages (first-sync fallback) ────────────────────

export function parseProfileResponse(data: unknown): string | null {
  const response = data as { historyId?: string };
  return response.historyId ?? null;
}

export function parseMessageListResponse(data: unknown): string[] {
  const response = data as { messages?: { id?: string }[] };
  return (response.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => id !== undefined);
}

async function getCurrentHistoryId(accessToken: string): Promise<string> {
  const data = await getJson(`${GMAIL_BASE}/profile`, accessToken);
  const historyId = parseProfileResponse(data);
  if (!historyId) {
    throw new Error('getCurrentHistoryId: Gmail did not return a historyId.');
  }
  return historyId;
}

async function listRecentMessageIds(accessToken: string, limit: number): Promise<string[]> {
  const url = new URL(`${GMAIL_BASE}/messages`);
  url.searchParams.set('maxResults', String(limit));
  const data = await getJson(url.toString(), accessToken);
  return parseMessageListResponse(data);
}

// ── history.list (incremental sync) ─────────────────────────────────

export interface HistoryResult {
  messageIds: string[];
  newHistoryId: string;
}

/**
 * Pure — unit-tested directly against fixture JSON. `fallbackHistoryId`
 * is what's returned if Gmail's response omits `historyId` (shouldn't
 * normally happen, but the caller's own stored cursor is the sane
 * fallback rather than throwing away a sync that otherwise succeeded).
 */
export function parseHistoryResponse(data: unknown, fallbackHistoryId: string): HistoryResult {
  const response = data as {
    history?: { messagesAdded?: { message?: { id?: string } }[] }[];
    historyId?: string;
  };

  const messageIds = (response.history ?? [])
    .flatMap((entry) => entry.messagesAdded ?? [])
    .map((added) => added.message?.id)
    .filter((id): id is string => id !== undefined);

  return { messageIds, newHistoryId: response.historyId ?? fallbackHistoryId };
}

/**
 * Incremental sync via Gmail's history.list when a cursor already
 * exists — "never re-scan the mailbox" (docs/TOOLS.md). For a brand-new
 * account with no cursor yet, falls back to the mailbox's current
 * historyId (to seed future syncs) plus its most recent messages —
 * there's no history to page through on a first sync.
 */
export async function listHistory(
  accessToken: string,
  startHistoryId: string | null,
): Promise<HistoryResult> {
  if (startHistoryId === null) {
    const [newHistoryId, messageIds] = await Promise.all([
      getCurrentHistoryId(accessToken),
      listRecentMessageIds(accessToken, FIRST_SYNC_LIMIT),
    ]);
    return { messageIds, newHistoryId };
  }

  const url = new URL(`${GMAIL_BASE}/history`);
  url.searchParams.set('startHistoryId', startHistoryId);
  url.searchParams.set('historyTypes', 'messageAdded');

  const data = await getJson(url.toString(), accessToken);
  return parseHistoryResponse(data, startHistoryId);
}

// ── Message metadata (pre-filter input) ─────────────────────────────

function findHeader(headers: { name?: string; value?: string }[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export interface MessageMetadata {
  subject: string;
  from: string;
  snippet: string;
}

/** Pure — unit-tested directly against fixture JSON. */
export function parseMetadataResponse(data: unknown): MessageMetadata {
  const response = data as {
    snippet?: string;
    payload?: { headers?: { name?: string; value?: string }[] };
  };
  const headers = response.payload?.headers ?? [];
  return {
    subject: findHeader(headers, 'Subject'),
    from: findHeader(headers, 'From'),
    snippet: response.snippet ?? '',
  };
}

/**
 * The cheap fetch the pre-filter runs against (domain/prefilter.ts) —
 * headers + snippet only, never the body. Only messages that pass the
 * pre-filter go on to getMessageBody.
 */
export async function getMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<MessageMetadata> {
  const url = new URL(`${GMAIL_BASE}/messages/${messageId}`);
  url.searchParams.set('format', 'metadata');
  url.searchParams.append('metadataHeaders', 'Subject');
  url.searchParams.append('metadataHeaders', 'From');

  const data = await getJson(url.toString(), accessToken);
  return parseMetadataResponse(data);
}

// ── Full message body (only for pre-filter survivors) ───────────────

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: { mimeType?: string; body?: { data?: string } }[];
}

function extractPlainText(payload: GmailPayload): string {
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
  }
  // Fall back to the first part with any body data (e.g. text/html) if no
  // plain-text part exists — still better than nothing for classification.
  const firstWithBody = (payload.parts ?? []).find((part) => part.body?.data);
  return firstWithBody?.body?.data ? decodeBase64Url(firstWithBody.body.data) : '';
}

export interface MessageBody {
  subject: string;
  from: string;
  body: string;
  // ISO date (YYYY-MM-DD) Gmail received this message — from the
  // message's own `internalDate` (epoch ms), not the machine clock at
  // sync time. Needed so classifyEmail can resolve a relative phrase
  // ("ends in 3 days") against when the email actually arrived, not
  // whenever the sync job happens to run.
  receivedAt: string;
}

/** Pure — unit-tested directly against fixture JSON. */
export function parseBodyResponse(data: unknown): MessageBody {
  const response = data as {
    payload?: GmailPayload & { headers?: { name?: string; value?: string }[] };
    internalDate?: string;
  };
  const payload = response.payload ?? {};
  const headers = payload.headers ?? [];
  const internalDateMs = Number(response.internalDate);
  const receivedAt = Number.isFinite(internalDateMs)
    ? new Date(internalDateMs).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return {
    subject: findHeader(headers, 'Subject'),
    from: findHeader(headers, 'From'),
    body: extractPlainText(payload),
    receivedAt,
  };
}

/** Only ever called for messages that already passed the pre-filter. */
export async function getMessageBody(accessToken: string, messageId: string): Promise<MessageBody> {
  const url = new URL(`${GMAIL_BASE}/messages/${messageId}`);
  url.searchParams.set('format', 'full');

  const data = await getJson(url.toString(), accessToken);
  return parseBodyResponse(data);
}
