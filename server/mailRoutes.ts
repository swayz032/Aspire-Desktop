import { Router, Request, Response } from 'express';
import { logger } from './logger';
import { createTrustSpineReceipt } from './receiptService';
import { getValidToken, getConnectedEmail } from './mail/googleOAuth';
import {
  listThreads,
  getThread,
  getMessage,
  sendMessage,
  createDraft,
  listLabels,
  gmailThreadToMailThread,
  gmailThreadToMailDetail,
  buildRawMessage,
} from './mail/gmailClient';

const router = Router();

// ─── Auth middleware: resolve suiteId and get valid Gmail token ───
// Law #3: Fail Closed — require authenticated suite_id, no fallback to defaults

async function getGmailToken(req: Request): Promise<{ token: string; suiteId: string; officeId: string }> {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) throw new Error('AUTH_REQUIRED');
  const officeId = (req as any).authenticatedOfficeId || '';

  const token = await getValidToken(suiteId);
  return { token, suiteId, officeId };
}

// ─── GET /api/mail/threads — List email threads ───

router.get('/api/mail/threads', async (req: Request, res: Response) => {
  try {
    const { token, suiteId, officeId } = await getGmailToken(req);
    const maxResults = parseInt(req.query.limit as string) || 20;
    const pageToken = req.query.pageToken as string | undefined;
    const q = req.query.q as string | undefined;

    const gmailData = await listThreads(token, { maxResults, pageToken, q });

    // Fetch full thread data for each thread to get headers
    const fullThreads = await Promise.all(
      gmailData.threads.slice(0, maxResults).map(async (t) => {
        try {
          const full = await getThread(token, t.id);
          return gmailThreadToMailThread(full, suiteId, officeId);
        } catch {
          return null;
        }
      }),
    );

    const threads = fullThreads.filter(Boolean);

    // GREEN receipt — data retrieval
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.threads.listed',
      status: 'SUCCEEDED',
      action: { operation: 'list_threads', count: threads.length },
      result: { threadCount: threads.length, hasMore: !!gmailData.nextPageToken },
    });

    res.json({
      threads,
      nextPageToken: gmailData.nextPageToken,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Mail threads error', { error: msg });
    if (msg.includes('setup required') || msg.includes('No Google OAuth')) {
      return res.status(401).json({ error: 'Gmail not connected', setupRequired: true });
    }
    res.status(500).json({ error: 'Failed to list threads' });
  }
});

// ─── GET /api/mail/threads/:id — Thread detail with messages ───

router.get('/api/mail/threads/:id', async (req: Request, res: Response) => {
  try {
    const { token, suiteId, officeId } = await getGmailToken(req);
    const threadId = req.params.id as string;

    const gmailThread = await getThread(token, threadId);
    const detail = gmailThreadToMailDetail(gmailThread, suiteId, officeId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.thread.read',
      status: 'SUCCEEDED',
      action: { operation: 'get_thread', threadId },
      result: { messageCount: detail.messages.length },
    });

    res.json(detail);
  } catch (error: unknown) {
    logger.error('Mail thread detail error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

// ─── GET /api/mail/messages/:id — Single message ───

router.get('/api/mail/messages/:id', async (req: Request, res: Response) => {
  try {
    const { token, suiteId } = await getGmailToken(req);
    const messageId = req.params.id as string;

    const gmailMsg = await getMessage(token, messageId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.message.read',
      status: 'SUCCEEDED',
      action: { operation: 'get_message', messageId },
      result: { hasBody: true },
    });

    res.json(gmailMsg);
  } catch (error: unknown) {
    logger.error('Mail message error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to load message' });
  }
});

// ─── POST /api/mail/send — Send email (YELLOW — external comms) ───

router.post('/api/mail/send', async (req: Request, res: Response) => {
  try {
    const { token, suiteId } = await getGmailToken(req);
    const { to, subject, body: emailBody, replyToThreadId, replyToMessageId } = req.body;

    if (!to || !subject || !emailBody) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const email = await getConnectedEmail(suiteId);
    const raw = buildRawMessage({
      to,
      subject,
      body: emailBody,
      from: email || undefined,
      replyToMessageId,
    });

    const result = await sendMessage(token, raw);

    // YELLOW receipt — external communication
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.message.sent',
      status: 'SUCCEEDED',
      action: { operation: 'send_message', to: '<EMAIL_REDACTED>', subject: subject.substring(0, 50) },
      result: { messageId: result.id, threadId: result.threadId },
    });

    res.json({ messageId: result.id, threadId: result.threadId });
  } catch (error: unknown) {
    logger.error('Mail send error', { error: error instanceof Error ? error.message : 'unknown' });
    const suiteId = (req as any).authenticatedSuiteId || '';
    if (suiteId) {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.message.send_failed',
        status: 'FAILED',
        action: { operation: 'send_message' },
        result: { error: 'send_failed' },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ─── POST /api/mail/draft — Save draft ───

router.post('/api/mail/draft', async (req: Request, res: Response) => {
  try {
    const { token, suiteId } = await getGmailToken(req);
    const { to, subject, body: emailBody } = req.body;

    const email = await getConnectedEmail(suiteId);
    const raw = buildRawMessage({
      to: to || '',
      subject: subject || '',
      body: emailBody || '',
      from: email || undefined,
    });

    const result = await createDraft(token, raw);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.draft.created',
      status: 'SUCCEEDED',
      action: { operation: 'create_draft' },
      result: { draftId: result.id },
    });

    res.json({ draftId: result.id });
  } catch (error: unknown) {
    logger.error('Mail draft error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

// ─── GET /api/mail/labels — List labels ───

router.get('/api/mail/labels', async (req: Request, res: Response) => {
  try {
    const { token } = await getGmailToken(req);
    const labels = await listLabels(token);
    res.json({ labels });
  } catch (error: unknown) {
    logger.error('Mail labels error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to load labels' });
  }
});

export default router;
