import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import { logger } from './logger';

const router = Router();

// Lazy-load Twilio client to avoid crash if credentials are missing
let twilioClient: any = null;

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
    return twilioClient;
  } catch (e) {
    logger.warn('Twilio SDK not available');
    return null;
  }
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

    const { to, suiteId } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to (phone number)' });
    }

    const effectiveSuiteId = suiteId || getDefaultSuiteId();
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
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Call initiation error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// POST /api/calls/webhook — Twilio status callback
router.post('/api/calls/webhook', async (req: Request, res: Response) => {
  try {
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
    const suiteId = (req.query.suiteId as string) || getDefaultSuiteId();
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

    const rows = (result.rows || result) as any[];
    res.json({ calls: rows, total: rows.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Call history error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

export default router;
