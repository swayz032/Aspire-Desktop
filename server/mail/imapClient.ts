// ─── IMAP/SMTP Client for PolarisM Mailboxes ───
// Connects to PolarisM-hosted IMAP server to fetch real emails,
// and SMTP server to send emails from Aspire Business Email accounts.
//
// Architecture:
//   - On-demand IMAP connections (connect → fetch → disconnect per request)
//   - Transforms IMAP messages to MailThread/MailMessage types (same as gmailClient.ts)
//   - AES-256-GCM encrypted password at rest, decrypted only for IMAP/SMTP auth
//   - SMTP via nodemailer for sending
//
// Governance:
//   - Law #2: All fetches produce GREEN receipts, sends produce YELLOW receipts
//   - Law #3: Fail closed on missing credentials
//   - Law #6: suite_id scoped — credentials loaded per-account
//   - Law #9: No plaintext passwords in logs/receipts

import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import crypto from 'crypto';
import type { MailThread, MailMessage, MailAttachment, MailDetail } from '../../types/mail';

// ─── Credential encryption (same pattern as financeTokenStore.ts) ───

const ENCRYPTION_KEY = () => process.env.TOKEN_ENCRYPTION_KEY;

export function encryptPassword(plaintext: string): string {
  const key = ENCRYPTION_KEY();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set — cannot encrypt mail credentials (Law #3: Fail Closed)');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'utf-8'), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptPassword(encryptedText: string): string {
  const key = ENCRYPTION_KEY();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY not set — cannot decrypt mail credentials (Law #3: Fail Closed)');
  }
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'utf-8'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Account credentials type ───

export interface MailAccountCredentials {
  email: string;
  password: string; // decrypted
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  displayName?: string;
}

// ─── IMAP connection helper ───

const IMAP_TIMEOUT_MS = 15_000; // Gate 3: Reliability — 15s timeout

async function withImapConnection<T>(
  creds: MailAccountCredentials,
  fn: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: true, // SSL/TLS
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    logger: false, // Law #9: No credentials in logs
    emitLogs: false,
  });

  const timer = setTimeout(() => {
    (client.close() as unknown as Promise<void>)?.catch(() => {});
  }, IMAP_TIMEOUT_MS);

  try {
    await client.connect();
    const result = await fn(client);
    return result;
  } finally {
    clearTimeout(timer);
    await client.logout().catch(() => {});
  }
}

// ─── MIME parsing helpers ───

function parseAddressList(addrs: any): string[] {
  if (!addrs) return [];
  if (typeof addrs === 'string') return [addrs];
  if (Array.isArray(addrs)) {
    return addrs.map(a => {
      if (typeof a === 'string') return a;
      if (a.address) {
        return a.name ? `${a.name} <${a.address}>` : a.address;
      }
      return String(a);
    });
  }
  if (addrs.address) {
    return [addrs.name ? `${addrs.name} <${addrs.address}>` : addrs.address];
  }
  return [];
}

function parseSender(from: any): { name: string; email: string } {
  if (!from) return { name: 'Unknown', email: '' };

  // Handle imapflow address object
  if (from.address) {
    return {
      name: from.name || from.address.split('@')[0],
      email: from.address,
    };
  }

  // Handle array of addresses
  if (Array.isArray(from) && from.length > 0) {
    const first = from[0];
    if (first.address) {
      return {
        name: first.name || first.address.split('@')[0],
        email: first.address,
      };
    }
    return parseSenderString(String(first));
  }

  if (typeof from === 'string') {
    return parseSenderString(from);
  }

  return { name: 'Unknown', email: '' };
}

function parseSenderString(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { name: raw.split('@')[0], email: raw };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Normalize subject for thread grouping (strip Re:/Fwd: prefixes)
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw)\s*:\s*/gi, '')
    .replace(/^(re|fwd|fw)\s*:\s*/gi, '') // Double strip for "Re: Fwd: ..."
    .trim()
    .toLowerCase();
}

// ─── List threads (grouped messages) ───

export interface ImapThreadListResponse {
  threads: MailThread[];
  total: number;
}

export async function listThreads(
  creds: MailAccountCredentials,
  suiteId: string,
  officeId: string,
  opts?: { maxResults?: number; offset?: number; mailbox?: string },
): Promise<ImapThreadListResponse> {
  const maxResults = opts?.maxResults || 50;
  const mailbox = opts?.mailbox || 'INBOX';

  return withImapConnection(creds, async (client) => {
    const lock = await client.getMailboxLock(mailbox);

    try {
      const status = await client.status(mailbox, { messages: true });
      const total = status.messages || 0;

      if (total === 0) {
        return { threads: [], total: 0 };
      }

      // Fetch the most recent messages (envelope only — no body download)
      // IMAP sequence numbers: 1=oldest, N=newest
      const fetchCount = Math.min(maxResults * 2, total, 200); // Fetch extra for threading
      const startSeq = Math.max(1, total - fetchCount + 1);

      const messages: Array<{
        uid: number;
        seq: number;
        envelope: any;
        flags: Set<string>;
        size: number;
        bodyStructure: any;
      }> = [];

      for await (const msg of client.fetch(`${startSeq}:*`, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        size: true,
      })) {
        messages.push({
          uid: msg.uid,
          seq: msg.seq,
          envelope: msg.envelope,
          flags: msg.flags ?? new Set<string>(),
          size: msg.size || 0,
          bodyStructure: msg.bodyStructure,
        });
      }

      // Sort newest first
      messages.sort((a, b) => {
        const dateA = a.envelope?.date ? new Date(a.envelope.date).getTime() : 0;
        const dateB = b.envelope?.date ? new Date(b.envelope.date).getTime() : 0;
        return dateB - dateA;
      });

      // Group into threads by normalized subject + In-Reply-To/References
      const threadMap = new Map<string, typeof messages>();
      const messageIdToThread = new Map<string, string>();

      for (const msg of messages) {
        const subject = msg.envelope?.subject || '(no subject)';
        const normalizedSubj = normalizeSubject(subject);
        const messageId = msg.envelope?.messageId || '';
        const inReplyTo = msg.envelope?.inReplyTo || '';

        // Try to find existing thread by In-Reply-To
        let threadKey = inReplyTo ? messageIdToThread.get(inReplyTo) : undefined;

        // Fall back to subject-based grouping
        if (!threadKey) {
          threadKey = normalizedSubj || `uid-${msg.uid}`;
        }

        if (!threadMap.has(threadKey)) {
          threadMap.set(threadKey, []);
        }
        threadMap.get(threadKey)!.push(msg);

        // Register this message ID for thread linking
        if (messageId) {
          messageIdToThread.set(messageId, threadKey);
        }
      }

      // Convert thread groups to MailThread objects
      const threads: MailThread[] = [];
      for (const [, threadMsgs] of threadMap) {
        // Sort thread messages by date (oldest first within thread)
        threadMsgs.sort((a, b) => {
          const dateA = a.envelope?.date ? new Date(a.envelope.date).getTime() : 0;
          const dateB = b.envelope?.date ? new Date(b.envelope.date).getTime() : 0;
          return dateA - dateB;
        });

        const firstMsg = threadMsgs[0];
        const lastMsg = threadMsgs[threadMsgs.length - 1];
        const envelope = firstMsg.envelope;

        const sender = parseSender(envelope?.from);
        const recipients = parseAddressList(envelope?.to);
        const subject = envelope?.subject || '(no subject)';
        const date = lastMsg.envelope?.date;
        const unread = threadMsgs.some(m => !m.flags.has('\\Seen'));
        const hasAttachments = threadMsgs.some(m => hasAttachmentParts(m.bodyStructure));

        // Use first message UID as thread ID (stable across sessions)
        const threadId = `imap-${firstMsg.uid}`;

        const ts = date ? new Date(date).toISOString() : new Date().toISOString();
        threads.push({
          id: threadId,
          type: 'mail',
          subject,
          preview: envelope?.subject || '', // IMAP doesn't have snippets like Gmail
          senderName: sender.name,
          senderEmail: sender.email,
          recipients,
          timestamp: ts,
          suiteId,
          officeId,
          tags: [],
          priority: 'Medium',
          status: 'Open',
          linkedReceiptIds: [],
          unread,
          messageCount: threadMsgs.length,
          hasAttachments,
          createdAt: ts,
          updatedAt: ts,
        });
      }

      // Sort threads by timestamp (newest first)
      threads.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      const offset = opts?.offset || 0;
      const paginatedThreads = threads.slice(offset, offset + maxResults);

      return { threads: paginatedThreads, total: threads.length };
    } finally {
      lock.release();
    }
  });
}

// Check if a BODYSTRUCTURE part has attachments
function hasAttachmentParts(structure: any): boolean {
  if (!structure) return false;
  if (structure.disposition === 'attachment') return true;
  if (structure.childNodes) {
    return structure.childNodes.some((child: any) => hasAttachmentParts(child));
  }
  return false;
}

// ─── Get thread detail (full messages with bodies) ───

export async function getThreadDetail(
  creds: MailAccountCredentials,
  threadId: string,
  suiteId: string,
  officeId: string,
  mailbox?: string,
): Promise<MailDetail> {
  const box = mailbox || 'INBOX';

  // Extract the root UID from thread ID
  const rootUid = parseInt(threadId.replace('imap-', ''), 10);
  if (isNaN(rootUid)) {
    throw new Error('Invalid thread ID format');
  }

  return withImapConnection(creds, async (client) => {
    const lock = await client.getMailboxLock(box);

    try {
      // First, fetch the root message to get its subject
      let rootSubject = '';
      for await (const msg of client.fetch(String(rootUid), { envelope: true, uid: true })) {
        rootSubject = msg.envelope?.subject || '';
      }

      const normalizedRootSubject = normalizeSubject(rootSubject);

      // Fetch recent messages to find the full thread by subject matching
      const status = await client.status(box, { messages: true });
      const total = status.messages || 0;
      const fetchCount = Math.min(200, total);
      const startSeq = Math.max(1, total - fetchCount + 1);

      const threadUids: number[] = [];

      // Find all messages in this thread
      for await (const msg of client.fetch(`${startSeq}:*`, { envelope: true, uid: true })) {
        const subj = msg.envelope?.subject || '';
        if (normalizeSubject(subj) === normalizedRootSubject || msg.uid === rootUid) {
          threadUids.push(msg.uid);
        }
      }

      if (threadUids.length === 0) {
        threadUids.push(rootUid);
      }

      // Fetch full message content for all thread messages
      const messages: MailMessage[] = [];
      let threadSubject = rootSubject;
      let firstSender = { name: 'Unknown', email: '' };
      let lastDate = '';
      const allRecipients: string[] = [];
      let threadUnread = false;
      let threadHasAttachments = false;

      for (const uid of threadUids) {
        try {
          // Fetch message source (RFC822)
          const downloadResult = await client.download(String(uid), undefined, { uid: true });
          const chunks: Buffer[] = [];
          for await (const chunk of downloadResult.content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const rawMessage = Buffer.concat(chunks).toString('utf-8');

          // Also fetch envelope + flags
          let envelope: any = {};
          let flags = new Set<string>();
          for await (const meta of client.fetch(String(uid), { envelope: true, flags: true, bodyStructure: true, uid: true })) {
            envelope = meta.envelope;
            flags = meta.flags ?? new Set<string>();
            threadHasAttachments = threadHasAttachments || hasAttachmentParts(meta.bodyStructure);
          }

          const sender = parseSender(envelope?.from);
          const date = envelope?.date;
          const msgRecipients = parseAddressList(envelope?.to);
          allRecipients.push(...msgRecipients);

          if (uid === threadUids[0]) {
            firstSender = sender;
            threadSubject = envelope?.subject || rootSubject;
          }
          if (date) lastDate = new Date(date).toISOString();
          if (!flags.has('\\Seen')) threadUnread = true;

          // Parse body from raw message
          const { text, html } = parseRawMessageBody(rawMessage);

          // Parse attachments from raw message
          const attachments = parseRawAttachments(rawMessage);

          messages.push({
            id: `imap-msg-${uid}`,
            sender: sender.name,
            senderEmail: sender.email,
            content: html || text || '',
            timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
            attachments,
          });
        } catch {
          // Skip messages that fail to download — don't crash the whole thread
        }
      }

      // Sort messages by timestamp (oldest first)
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const uniqueRecipients = [...new Set(allRecipients)];

      const threadTs = lastDate || new Date().toISOString();
      const thread: MailThread = {
        id: threadId,
        type: 'mail',
        subject: threadSubject,
        preview: threadSubject,
        senderName: firstSender.name,
        senderEmail: firstSender.email,
        recipients: uniqueRecipients,
        timestamp: threadTs,
        suiteId,
        officeId,
        tags: [],
        priority: 'Medium',
        status: 'Open',
        linkedReceiptIds: [],
        unread: threadUnread,
        messageCount: messages.length,
        hasAttachments: threadHasAttachments,
        createdAt: threadTs,
        updatedAt: threadTs,
      };

      return {
        ...thread,
        messages,
        complianceFooter: 'Managed by Aspire — all actions are receipted and governed.',
      };
    } finally {
      lock.release();
    }
  });
}

// ─── Parse raw RFC822 message body ───

function parseRawMessageBody(raw: string): { text: string; html: string } {
  let text = '';
  let html = '';

  // Split headers from body
  const headerBodySplit = raw.indexOf('\r\n\r\n');
  if (headerBodySplit === -1) {
    const altSplit = raw.indexOf('\n\n');
    if (altSplit === -1) return { text: raw, html: '' };
    const headers = raw.substring(0, altSplit);
    const body = raw.substring(altSplit + 2);
    return parseBodyByContentType(headers, body);
  }

  const headers = raw.substring(0, headerBodySplit);
  const body = raw.substring(headerBodySplit + 4);
  return parseBodyByContentType(headers, body);
}

function parseBodyByContentType(headers: string, body: string): { text: string; html: string } {
  const contentTypeMatch = headers.match(/Content-Type:\s*(.+?)(?:\r?\n(?!\s)|$)/si);
  const contentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'text/plain';
  const transferEncodingMatch = headers.match(/Content-Transfer-Encoding:\s*(.+?)(?:\r?\n|$)/i);
  const encoding = transferEncodingMatch ? transferEncodingMatch[1].trim().toLowerCase() : '7bit';

  if (contentType.includes('multipart/')) {
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
    if (boundaryMatch) {
      return parseMultipart(body, boundaryMatch[1]);
    }
  }

  const decoded = decodeBody(body, encoding);
  if (contentType.includes('text/html')) {
    return { text: '', html: decoded };
  }
  return { text: decoded, html: '' };
}

function parseMultipart(body: string, boundary: string): { text: string; html: string } {
  let text = '';
  let html = '';
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (part.trim() === '--' || part.trim() === '') continue;

    const partHeaderEnd = part.indexOf('\r\n\r\n');
    const altEnd = part.indexOf('\n\n');
    const splitIdx = partHeaderEnd !== -1 ? partHeaderEnd : altEnd;
    if (splitIdx === -1) continue;

    const partHeaders = part.substring(0, splitIdx);
    const partBody = part.substring(splitIdx + (partHeaderEnd !== -1 ? 4 : 2));

    const ctMatch = partHeaders.match(/Content-Type:\s*(.+?)(?:\r?\n(?!\s)|$)/si);
    const ct = ctMatch ? ctMatch[1].trim() : '';
    const teMatch = partHeaders.match(/Content-Transfer-Encoding:\s*(.+?)(?:\r?\n|$)/i);
    const te = teMatch ? teMatch[1].trim().toLowerCase() : '7bit';

    if (ct.includes('multipart/')) {
      const nestedBoundary = ct.match(/boundary="?([^";\s]+)"?/i);
      if (nestedBoundary) {
        const nested = parseMultipart(partBody, nestedBoundary[1]);
        if (nested.text) text = text || nested.text;
        if (nested.html) html = html || nested.html;
      }
    } else if (ct.includes('text/html')) {
      html = html || decodeBody(partBody, te);
    } else if (ct.includes('text/plain')) {
      text = text || decodeBody(partBody, te);
    }
  }

  return { text, html };
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch {
      return body;
    }
  }
  if (encoding === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '') // Soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return body;
}

// ─── Parse attachments from raw message ───

function parseRawAttachments(raw: string): MailAttachment[] {
  const attachments: MailAttachment[] = [];

  // Find Content-Disposition: attachment parts
  const parts = raw.split(/--[^\r\n]+/);
  for (const part of parts) {
    const dispositionMatch = part.match(/Content-Disposition:\s*attachment[^]*?filename="?([^";\r\n]+)"?/i);
    if (dispositionMatch) {
      const filename = dispositionMatch[1].trim();
      const ctMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
      const mimeType = ctMatch ? ctMatch[1].trim() : 'application/octet-stream';

      // Estimate size from base64 content
      const bodyStart = part.indexOf('\r\n\r\n') || part.indexOf('\n\n');
      const bodyContent = bodyStart > 0 ? part.substring(bodyStart + 4) : '';
      const estimatedSize = Math.floor(bodyContent.replace(/\s/g, '').length * 0.75);

      attachments.push({
        id: crypto.randomUUID(),
        name: filename,
        type: mimeType,
        size: formatSize(estimatedSize),
      });
    }
  }

  return attachments;
}

// ─── Send email via SMTP ───

export async function sendMail(
  creds: MailAccountCredentials,
  opts: {
    to: string;
    subject: string;
    body: string;
    html?: boolean;
    replyToMessageId?: string;
  },
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: creds.smtpPort === 465, // true for 465, false for 587
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    connectionTimeout: 10_000, // Gate 3: 10s connection timeout
    socketTimeout: 15_000, // Gate 3: 15s socket timeout
  });

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: creds.displayName
        ? `"${creds.displayName}" <${creds.email}>`
        : creds.email,
      to: opts.to,
      subject: opts.subject,
      ...(opts.html ? { html: opts.body } : { text: opts.body }),
    };

    if (opts.replyToMessageId) {
      mailOptions.inReplyTo = opts.replyToMessageId;
      mailOptions.references = opts.replyToMessageId;
    }

    const info = await transporter.sendMail(mailOptions);
    return { messageId: info.messageId };
  } finally {
    transporter.close();
  }
}

// ─── Create draft (save to Drafts folder via IMAP APPEND) ───

export async function createDraft(
  creds: MailAccountCredentials,
  opts: {
    to: string;
    subject: string;
    body: string;
    html?: boolean;
  },
): Promise<{ uid: string }> {
  return withImapConnection(creds, async (client) => {
    const from = creds.displayName
      ? `"${creds.displayName}" <${creds.email}>`
      : creds.email;

    const lines: string[] = [];
    lines.push(`From: ${from}`);
    lines.push(`To: ${opts.to}`);
    lines.push(`Subject: ${opts.subject}`);
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: ${opts.html ? 'text/html' : 'text/plain'}; charset=UTF-8`);
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push('');
    lines.push(opts.body);

    const raw = lines.join('\r\n');

    const result = await client.append('Drafts', Buffer.from(raw), ['\\Draft']);
    return { uid: String(result && typeof result === 'object' && 'uid' in result ? result.uid : 'draft') };
  });
}
