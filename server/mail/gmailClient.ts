// ─── Gmail API v1 Client ───
// Talks to Gmail REST API using OAuth2 access tokens from googleOAuth.ts

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GMAIL_TIMEOUT_MS = 15_000; // Gate 3: Reliability — 15s timeout for Gmail API

interface GmailHeaders {
  Authorization: string;
  Accept: string;
}

function authHeaders(accessToken: string): GmailHeaders {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };
}

async function gmailFetch(accessToken: string, path: string, init?: RequestInit): Promise<any> {
  const url = `${GMAIL_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GMAIL_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...authHeaders(accessToken),
        ...(init?.headers || {}),
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Gmail API error: ${res.status} ${text}`);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Thread operations ───

export interface GmailThreadListItem {
  id: string;
  snippet: string;
  historyId: string;
}

export interface GmailThreadListResponse {
  threads: GmailThreadListItem[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export async function listThreads(
  accessToken: string,
  opts?: { maxResults?: number; pageToken?: string; q?: string; labelIds?: string[] },
): Promise<GmailThreadListResponse> {
  const params = new URLSearchParams();
  params.set('maxResults', String(opts?.maxResults || 20));
  if (opts?.pageToken) params.set('pageToken', opts.pageToken);
  if (opts?.q) params.set('q', opts.q);
  if (opts?.labelIds) {
    for (const label of opts.labelIds) {
      params.append('labelIds', label);
    }
  }

  const data = await gmailFetch(accessToken, `/threads?${params.toString()}`);
  return {
    threads: data.threads || [],
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate,
  };
}

export async function getThread(
  accessToken: string,
  threadId: string,
): Promise<any> {
  return gmailFetch(accessToken, `/threads/${encodeURIComponent(threadId)}?format=full`);
}

// ─── Message operations ───

export async function getMessage(
  accessToken: string,
  messageId: string,
): Promise<any> {
  return gmailFetch(accessToken, `/messages/${encodeURIComponent(messageId)}?format=full`);
}

export async function sendMessage(
  accessToken: string,
  rawBase64url: string,
): Promise<any> {
  return gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: rawBase64url }),
  });
}

export async function createDraft(
  accessToken: string,
  rawBase64url: string,
): Promise<any> {
  return gmailFetch(accessToken, '/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: rawBase64url } }),
  });
}

// ─── Labels ───

export async function listLabels(accessToken: string): Promise<any[]> {
  const data = await gmailFetch(accessToken, '/labels');
  return data.labels || [];
}

export async function createLabel(
  accessToken: string,
  name: string,
): Promise<any> {
  return gmailFetch(accessToken, '/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });
}

// ─── MIME Helpers ───

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const h = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return h?.value || '';
}

function decodeBase64url(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf-8');
}

function extractTextBody(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';

  if (payload.body?.data) {
    const decoded = decodeBase64url(payload.body.data);
    if (payload.mimeType === 'text/plain') text = decoded;
    if (payload.mimeType === 'text/html') html = decoded;
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractTextBody(part);
      if (result.text) text = text || result.text;
      if (result.html) html = html || result.html;
    }
  }

  return { text, html };
}

function extractAttachments(payload: any): Array<{ id: string; name: string; mimeType: string; size: number }> {
  const attachments: Array<{ id: string; name: string; mimeType: string; size: number }> = [];

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          name: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size: part.body.size || 0,
        });
      }
      // Recurse into nested parts
      attachments.push(...extractAttachments(part));
    }
  }

  return attachments;
}

// ─── Gmail → MailThread/MailMessage transformer ───

import type { MailThread, MailMessage, MailAttachment, MailDetail } from '../../types/mail';

export function gmailThreadToMailThread(
  gmailThread: any,
  suiteId: string,
  officeId: string,
): MailThread {
  const messages = gmailThread.messages || [];
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1] || firstMsg;
  const headers = firstMsg?.payload?.headers || [];

  const from = getHeader(headers, 'From');
  const subject = getHeader(headers, 'Subject') || '(no subject)';
  const to = getHeader(headers, 'To');
  const date = getHeader(lastMsg?.payload?.headers || headers, 'Date');

  // Parse "Name <email>" format
  const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : from.split('@')[0];
  const senderEmail = fromMatch ? fromMatch[2] : from;

  const recipients = to.split(',').map(r => r.trim()).filter(Boolean);
  const hasAttachments = messages.some((m: any) =>
    extractAttachments(m.payload || {}).length > 0,
  );
  const unread = messages.some((m: any) =>
    (m.labelIds || []).includes('UNREAD'),
  );

  const now = new Date().toISOString();
  const ts = date ? new Date(date).toISOString() : now;

  return {
    id: gmailThread.id,
    type: 'mail',
    subject,
    preview: gmailThread.snippet || '',
    senderName,
    senderEmail,
    recipients,
    timestamp: ts,
    suiteId,
    officeId,
    tags: [],
    priority: 'Medium',
    status: 'Open',
    linkedReceiptIds: [],
    unread,
    messageCount: messages.length,
    hasAttachments,
    createdAt: ts,
    updatedAt: ts,
  };
}

export function gmailMessageToMailMessage(gmailMsg: any): MailMessage {
  const headers = gmailMsg.payload?.headers || [];
  const from = getHeader(headers, 'From');
  const date = getHeader(headers, 'Date');

  const fromMatch = from.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : from.split('@')[0];
  const senderEmail = fromMatch ? fromMatch[2] : from;

  const { text, html } = extractTextBody(gmailMsg.payload || {});
  const attachments = extractAttachments(gmailMsg.payload || {});

  return {
    id: gmailMsg.id,
    sender: senderName,
    senderEmail,
    content: html || text || '',
    timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
    attachments: attachments.map(a => ({
      id: a.id,
      name: a.name,
      type: a.mimeType,
      size: formatSize(a.size),
    })),
  };
}

export function gmailThreadToMailDetail(
  gmailThread: any,
  suiteId: string,
  officeId: string,
): MailDetail {
  const thread = gmailThreadToMailThread(gmailThread, suiteId, officeId);
  const messages = (gmailThread.messages || []).map(gmailMessageToMailMessage);

  return {
    ...thread,
    messages,
    complianceFooter: 'Managed by Aspire — all actions are receipted and governed.',
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── RFC 2822 message builder for sending ───

export function buildRawMessage(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyToMessageId?: string;
  threadId?: string;
  html?: boolean;
}): string {
  const lines: string[] = [];
  if (opts.from) lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to}`);
  lines.push(`Subject: ${opts.subject}`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: ${opts.html ? 'text/html' : 'text/plain'}; charset=UTF-8`);
  if (opts.replyToMessageId) {
    lines.push(`In-Reply-To: ${opts.replyToMessageId}`);
    lines.push(`References: ${opts.replyToMessageId}`);
  }
  lines.push('');
  lines.push(opts.body);

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64url');
}
