import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultOfficeId } from './suiteContext';
import { logger } from './logger';
import type { AuthenticatedRequest } from './types';

const router = Router();

// Lazy-load Twilio client to avoid crash if credentials are missing
let twilioClient: Record<string, any> | null = null;
let twilioValidateRequestFn: ((authToken: string, signature: string, url: string, params: Record<string, any>) => boolean) | null = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    twilioValidateRequestFn = twilio.validateRequest;
    return twilioClient;
  } catch (e) {
    logger.warn('Twilio SDK not available');
    return null;
  }
}

/** Validate Twilio request signature — Law #3: Fail Closed */
function validateTwilioWebhook(req: Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.error('TWILIO_AUTH_TOKEN not configured — rejecting webhook');
    return false;
  }

  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) {
    logger.warn('Missing X-Twilio-Signature header on Twilio webhook');
    return false;
  }

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    logger.error('PUBLIC_BASE_URL not configured — cannot validate Twilio signature');
    return false;
  }

  // Ensure client is loaded so validateRequest is available
  if (!twilioValidateRequestFn) getTwilioClient();

  if (twilioValidateRequestFn) {
    const url = `${publicBaseUrl}${req.originalUrl}`;
    return twilioValidateRequestFn(authToken, signature, url, req.body || {});
  }

  logger.error('Twilio SDK not available for signature validation — rejecting webhook');
  return false;
}

// POST /api/calls/initiate — Outbound call via Twilio, scoped by suite_id
router.post('/api/calls/initiate', async (req: Request, res: Response) => {
  try {
    const client = getTwilioClient();
    if (!client) {
      return res.status(503).json({ error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.' });
    }

    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!twilioPhone) {
      return res.status(503).json({ error: 'TWILIO_PHONE_NUMBER not configured' });
    }

    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to (phone number)' });
    }

    const effectiveSuiteId = req.authenticatedSuiteId;
    if (!effectiveSuiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const effectiveOfficeId = getDefaultOfficeId();

    // Initiate the call via Twilio
    const call = await client.calls.create({
      to,
      from: twilioPhone,
      statusCallback: '/api/calls/webhook',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    // Insert into provider_call_log
    await db.execute(sql`
      INSERT INTO app.provider_call_log (
        suite_id, office_id, provider, provider_call_sid,
        direction, from_number, to_number, status, initiated_at
      ) VALUES (
        ${effectiveSuiteId}::uuid,
        ${effectiveOfficeId}::uuid,
        'twilio',
        ${call.sid},
        'outbound',
        ${twilioPhone},
        ${to},
        'initiated',
        NOW()
      )
    `);

    res.json({
      success: true,
      callSid: call.sid,
      status: call.status,
    });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Call initiation error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

// POST /api/calls/webhook — Twilio status callback
router.post('/api/calls/webhook', async (req: Request, res: Response) => {
  try {
    // Law #3: Fail Closed — validate Twilio signature before processing
    if (!validateTwilioWebhook(req)) {
      logger.warn('Twilio webhook signature validation failed', { path: req.path });
      return res.status(403).send('<Response></Response>');
    }

    const {
      CallSid,
      CallStatus,
      CallDuration,
      From,
      To,
      Direction,
    } = req.body;

    if (!CallSid) {
      return res.status(400).json({ error: 'Missing CallSid' });
    }

    // Update the call log entry
    await db.execute(sql`
      UPDATE app.provider_call_log
      SET
        status = ${CallStatus || 'unknown'},
        duration_seconds = ${CallDuration ? parseInt(CallDuration, 10) : null},
        ended_at = CASE WHEN ${CallStatus} IN ('completed', 'failed', 'busy', 'no-answer', 'canceled')
                       THEN NOW() ELSE ended_at END,
        updated_at = NOW()
      WHERE provider_call_sid = ${CallSid}
    `);

    // Twilio expects 200 OK
    res.status(200).send('<Response></Response>');
  } catch (error: unknown) {
    logger.error('Twilio webhook error', { error: error instanceof Error ? error.message : 'unknown' });
    // Still return 200 so Twilio doesn't retry indefinitely
    res.status(200).send('<Response></Response>');
  }
});

// GET /api/calls/history — Query provider_call_log from Supabase
router.get('/api/calls/history', async (req: Request, res: Response) => {
  try {
    const suiteId = req.authenticatedSuiteId;
    if (!suiteId) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    const limit = parseInt((req.query.limit as string) || '50', 10);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const result = await db.execute(sql`
      SELECT
        id, suite_id, office_id, provider, provider_call_sid,
        direction, from_number, to_number, status,
        duration_seconds, initiated_at, ended_at,
        caller_name, recording_url, voicemail_url,
        metadata, created_at, updated_at
      FROM app.provider_call_log
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY initiated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = (result.rows || result) as Record<string, any>[];
    res.json({ calls: rows, total: rows.length });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Call history error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

export default router;
