import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDefaultSuiteId } from './suiteContext';

const router = Router();

const DOMAIN_RAIL_URL = 'https://domain-rail-production.up.railway.app';

function getHmacSignature(body: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

function getDomainRailHeaders(body: string): Record<string, string> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) {
    throw new Error('DOMAIN_RAIL_HMAC_SECRET not configured');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payload = `${timestamp}.${body}`;
  const signature = getHmacSignature(payload, secret);

  return {
    'Content-Type': 'application/json',
    'Authorization': `HMAC-SHA256 ${signature}`,
    'X-Timestamp': timestamp,
    'X-Suite-Id': getDefaultSuiteId(),
  };
}

async function proxyToDomainRail(
  method: string,
  path: string,
  body?: any,
): Promise<{ status: number; data: any }> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) {
    return { status: 503, data: { error: 'DOMAIN_RAIL_HMAC_SECRET not configured' } };
  }

  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = getDomainRailHeaders(bodyStr);
  const url = `${DOMAIN_RAIL_URL}${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    fetchOptions.body = bodyStr;
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json().catch(() => ({ error: 'Invalid response from Domain Rail' }));

  return { status: response.status, data };
}

// GET /api/mail/threads — List email threads
router.get('/api/mail/threads', async (req: Request, res: Response) => {
  try {
    const suiteId = (req.query.suiteId as string) || getDefaultSuiteId();
    const limit = req.query.limit || '50';
    const offset = req.query.offset || '0';

    const { status, data } = await proxyToDomainRail(
      'GET',
      `/api/mail/threads?suiteId=${suiteId}&limit=${limit}&offset=${offset}`,
    );

    res.status(status).json(data);
  } catch (error: any) {
    console.error('Mail threads error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mail/thread/:id — Thread detail
router.get('/api/mail/thread/:id', async (req: Request, res: Response) => {
  try {
    const threadId = req.params.id;
    const { status, data } = await proxyToDomainRail(
      'GET',
      `/api/mail/thread/${threadId}`,
    );

    res.status(status).json(data);
  } catch (error: any) {
    console.error('Mail thread detail error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mail/send — Send email
router.post('/api/mail/send', async (req: Request, res: Response) => {
  try {
    const { to, subject, body: emailBody, replyToThreadId } = req.body;

    if (!to || !subject || !emailBody) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const payload = {
      to,
      subject,
      body: emailBody,
      replyToThreadId,
      suiteId: getDefaultSuiteId(),
    };

    const { status, data } = await proxyToDomainRail('POST', '/api/mail/send', payload);
    res.status(status).json(data);
  } catch (error: any) {
    console.error('Mail send error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/mail/draft — Save draft
router.post('/api/mail/draft', async (req: Request, res: Response) => {
  try {
    const { to, subject, body: emailBody, replyToThreadId } = req.body;

    const payload = {
      to,
      subject,
      body: emailBody,
      replyToThreadId,
      suiteId: getDefaultSuiteId(),
      draft: true,
    };

    const { status, data } = await proxyToDomainRail('POST', '/api/mail/draft', payload);
    res.status(status).json(data);
  } catch (error: any) {
    console.error('Mail draft error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
