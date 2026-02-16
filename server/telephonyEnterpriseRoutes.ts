/**
 * Telephony Enterprise Routes — Front Desk + SMS + Voicemail
 * ============================================================
 * Replaces: twilioRoutes.ts (3 naive endpoints), frontdeskRoutes.ts (1 status endpoint),
 *           routes.ts frontdesk GET/PATCH/preview-audio endpoints.
 *
 * Governance Compliance:
 *   Law #1: Single Brain — routes enqueue outbox jobs, orchestrator decides
 *   Law #2: Receipts — every side effect produces a frontdesk_action_receipts row
 *   Law #3: Fail closed — missing Twilio creds / bad signature / no business line → deny
 *   Law #6: Tenant isolation — RLS via set_config('app.current_suite_id')
 *   Law #7: Tools are hands — webhook endpoints are receive-only, outbox processes
 *
 * Endpoints (15 gateway + 3 webhook):
 *   GET    /api/frontdesk/setup
 *   PATCH  /api/frontdesk/setup
 *   POST   /api/frontdesk/preview-audio
 *   POST   /api/frontdesk/numbers/search
 *   POST   /api/frontdesk/numbers/purchase
 *   POST   /api/frontdesk/numbers/release
 *   GET    /api/frontdesk/calls
 *   POST   /api/frontdesk/return-call
 *   POST   /api/frontdesk/outbound-call
 *   GET    /api/messages/threads
 *   GET    /api/messages/threads/:threadId/messages
 *   POST   /api/messages/send
 *   GET    /api/voicemail
 *   GET    /api/voicemail/:id
 *   GET    /api/voicemail/:id/audio
 *   POST   /api/webhooks/twilio/voice       (signature-validated, no JWT)
 *   POST   /api/webhooks/twilio/sms/inbound (signature-validated, no JWT)
 *   POST   /api/webhooks/twilio/sms/status  (signature-validated, no JWT)
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import crypto from 'crypto';

const router = Router();

// =====================================================================
// TWILIO CLIENT (lazy-load)
// =====================================================================

let twilioClient: any = null;
let twilioValidateRequestFn: any = null;

function getTwilioClient() {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(accountSid, authToken);
    twilioValidateRequestFn = twilio.validateRequest;
    return twilioClient;
  } catch {
    return null;
  }
}

function getTwilioAuthToken(): string | null {
  return process.env.TWILIO_AUTH_TOKEN || null;
}

// =====================================================================
// HELPERS
// =====================================================================

function getSuiteId(req: Request): string {
  return (req as any).authenticatedSuiteId || getDefaultSuiteId();
}

function getOfficeId(req: Request): string {
  return (req as any).authenticatedOfficeId || getDefaultOfficeId();
}

/** Set RLS context for a specific suite (used by webhook paths that resolve suite from DID) */
async function setJwtClaims(suiteId: string, officeId?: string) {
  await db.execute(sql`SELECT set_config('app.current_suite_id', ${suiteId}, true)`);
  if (officeId) {
    await db.execute(sql`SELECT set_config('app.current_office_id', ${officeId}, true)`);
  }
}

/** Generate correlation ID for receipt tracing */
function correlationId(): string {
  return `fd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/** Write an action receipt */
async function writeReceipt(suiteId: string, actionType: string, payload: Record<string, unknown>, corrId?: string) {
  const result = await db.execute(sql`
    INSERT INTO public.frontdesk_action_receipts (suite_id, action_type, correlation_id, payload)
    VALUES (${suiteId}::uuid, ${actionType}, ${corrId || correlationId()}, ${JSON.stringify(payload)}::jsonb)
    RETURNING receipt_id
  `);
  const rows = (result.rows || result) as any[];
  return rows[0]?.receipt_id;
}

/** Validate Twilio request signature — Law #3: Fail closed */
function twilioValidateOrThrow(req: Request): void {
  const authToken = getTwilioAuthToken();
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN not configured');

  const publicBaseUrl = process.env.PUBLIC_BASE_URL;
  if (!publicBaseUrl) throw new Error('PUBLIC_BASE_URL not configured');

  const signature = req.headers['x-twilio-signature'] as string;
  if (!signature) throw new Error('Missing X-Twilio-Signature header');

  // Construct canonical URL
  const url = `${publicBaseUrl}${req.originalUrl}`;

  if (!twilioValidateRequestFn) {
    // Ensure client is loaded
    getTwilioClient();
  }

  if (twilioValidateRequestFn) {
    const isValid = twilioValidateRequestFn(authToken, signature, url, req.body || {});
    if (!isValid) throw new Error('Invalid Twilio signature');
  } else {
    throw new Error('Twilio SDK not available for signature validation');
  }
}

/** Enqueue an outbox job with idempotency — returns job_id or null if duplicate */
async function enqueueOutbox(
  suiteId: string,
  jobType: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const result = await db.execute(sql`
    INSERT INTO public.frontdesk_outbox_jobs (suite_id, job_type, idempotency_key, payload)
    VALUES (${suiteId}::uuid, ${jobType}, ${idempotencyKey}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (suite_id, job_type, idempotency_key) DO NOTHING
    RETURNING job_id
  `);
  const rows = (result.rows || result) as any[];
  return rows[0]?.job_id || null;
}

/** Dedupe webhook event — returns true if new (should process), false if duplicate */
async function dedupeEvent(
  suiteId: string,
  provider: string,
  providerEventId: string,
  providerCallId: string | null,
  eventType: string | null,
  rawBody?: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    INSERT INTO public.frontdesk_webhook_events (suite_id, provider, provider_event_id, provider_call_id, event_type, raw_body)
    VALUES (${suiteId}::uuid, ${provider}, ${providerEventId}, ${providerCallId}, ${eventType}, ${rawBody || null})
    ON CONFLICT (provider, provider_event_id) DO NOTHING
    RETURNING webhook_event_id
  `);
  const rows = (result.rows || result) as any[];
  return rows.length > 0;
}

/** Resolve suite from business number (DID) — SECURITY DEFINER bypasses RLS */
async function resolveSuiteByBusinessNumber(e164: string): Promise<{
  suite_id: string;
  business_line_id: string;
  owner_office_id: string;
  line_mode: string;
} | null> {
  const result = await db.execute(sql`
    SELECT * FROM public.frontdesk_resolve_suite_by_business_number(${e164})
  `);
  const rows = (result.rows || result) as any[];
  return rows[0] || null;
}

// =====================================================================
// 1. GET /api/frontdesk/setup — query business_lines table
// =====================================================================
router.get('/api/frontdesk/setup', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    if (!suiteId) return res.status(400).json({ code: 'MISSING_SUITE', message: 'suiteId required' });

    const result = await db.execute(sql`
      SELECT bl.*,
             pr.business_number_e164 AS provisioned_number,
             pr.status AS provisioned_status,
             pr.twilio_incoming_phone_number_sid
      FROM public.business_lines bl
      LEFT JOIN public.frontdesk_provider_resources pr
        ON pr.suite_id = bl.suite_id AND pr.business_line_id = bl.business_line_id
      WHERE bl.suite_id = ${suiteId}::uuid
      ORDER BY bl.created_at DESC
      LIMIT 1
    `);
    const rows = (result.rows || result) as any[];
    if (rows.length === 0) return res.json(null);

    const row = rows[0];
    res.json({
      businessLineId: row.business_line_id,
      lineMode: row.line_mode,
      businessNumber: row.business_number || row.provisioned_number,
      existingNumber: row.existing_number,
      businessName: row.business_name,
      businessHours: row.business_hours,
      afterHoursMode: row.after_hours_mode,
      pronunciation: row.pronunciation,
      enabledReasons: row.enabled_reasons,
      questionsByReason: row.questions_by_reason,
      targetByReason: row.target_by_reason,
      busyMode: row.busy_mode,
      teamMembers: row.team_members,
      setupComplete: row.setup_complete,
      greetingVoiceId: row.greeting_voice_id,
      provisionedStatus: row.provisioned_status,
      country: row.country,
    });
  } catch (error: any) {
    console.error('GET /api/frontdesk/setup error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 2. PATCH /api/frontdesk/setup — upsert business_lines
// =====================================================================
router.patch('/api/frontdesk/setup', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const officeId = getOfficeId(req);
    if (!suiteId) return res.status(400).json({ code: 'MISSING_SUITE', message: 'suiteId required' });

    const {
      lineMode, businessName, existingNumber, businessHours,
      afterHoursMode, pronunciation, enabledReasons, questionsByReason,
      targetByReason, busyMode, teamMembers, setupComplete, greetingVoiceId,
    } = req.body;

    // Check if a business line already exists for this suite
    const existingResult = await db.execute(sql`
      SELECT business_line_id FROM public.business_lines
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY created_at DESC LIMIT 1
    `);
    const existingRows = (existingResult.rows || existingResult) as any[];

    let result;
    if (existingRows.length > 0) {
      // Update existing business line
      result = await db.execute(sql`
        UPDATE public.business_lines SET
          line_mode = ${lineMode || 'ASPIRE_FULL_DUPLEX'}::frontdesk_line_mode,
          business_name = COALESCE(${businessName || null}, business_name),
          existing_number = COALESCE(${existingNumber || null}, existing_number),
          business_hours = ${JSON.stringify(businessHours || {})}::jsonb,
          after_hours_mode = ${afterHoursMode || 'TAKE_MESSAGE'},
          pronunciation = COALESCE(${pronunciation || null}, pronunciation),
          enabled_reasons = ${JSON.stringify(enabledReasons || [])}::jsonb,
          questions_by_reason = ${JSON.stringify(questionsByReason || {})}::jsonb,
          target_by_reason = ${JSON.stringify(targetByReason || {})}::jsonb,
          busy_mode = ${busyMode || 'TAKE_MESSAGE'},
          team_members = ${JSON.stringify(teamMembers || [])}::jsonb,
          setup_complete = ${setupComplete || false},
          greeting_voice_id = ${greetingVoiceId || 'DODLEQrClDo8wCz460ld'},
          updated_at = now()
        WHERE business_line_id = ${existingRows[0].business_line_id}::uuid
          AND suite_id = ${suiteId}::uuid
        RETURNING *
      `);
    } else {
      // Insert new business line
      result = await db.execute(sql`
        INSERT INTO public.business_lines (
          suite_id, owner_office_id, line_mode, business_name, existing_number,
          business_hours, after_hours_mode, pronunciation, enabled_reasons,
          questions_by_reason, target_by_reason, busy_mode, team_members,
          setup_complete, greeting_voice_id, updated_at
        ) VALUES (
          ${suiteId}::uuid, ${officeId}::uuid,
          ${lineMode || 'ASPIRE_FULL_DUPLEX'}::frontdesk_line_mode,
          ${businessName || null}, ${existingNumber || null},
          ${JSON.stringify(businessHours || {})}::jsonb,
          ${afterHoursMode || 'TAKE_MESSAGE'},
          ${pronunciation || null},
          ${JSON.stringify(enabledReasons || [])}::jsonb,
          ${JSON.stringify(questionsByReason || {})}::jsonb,
          ${JSON.stringify(targetByReason || {})}::jsonb,
          ${busyMode || 'TAKE_MESSAGE'},
          ${JSON.stringify(teamMembers || [])}::jsonb,
          ${setupComplete || false},
          ${greetingVoiceId || 'DODLEQrClDo8wCz460ld'},
          now()
        )
        RETURNING *
      `);
    }
    const rows = (result.rows || result) as any[];
    const row = rows[0];

    const corrId = correlationId();
    await writeReceipt(suiteId, 'frontdesk.setup.upsert', {
      business_line_id: row.business_line_id,
      line_mode: row.line_mode,
      setup_complete: row.setup_complete,
    }, corrId);

    res.json({
      businessLineId: row.business_line_id,
      lineMode: row.line_mode,
      businessName: row.business_name,
      setupComplete: row.setup_complete,
      receiptCorrelation: corrId,
    });
  } catch (error: any) {
    console.error('PATCH /api/frontdesk/setup error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 3. POST /api/frontdesk/preview-audio — ElevenLabs TTS
// =====================================================================
router.post('/api/frontdesk/preview-audio', async (req: Request, res: Response) => {
  try {
    const { clipType, reason, businessName, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ code: 'TTS_NOT_CONFIGURED', message: 'ElevenLabs API key not configured' });
    }

    let text = '';
    if (clipType === 'greeting') {
      text = `Hi, this is Sarah, the AI assistant for ${businessName || 'your business'}. How can I help you today?`;
    } else {
      text = `Hi, this is Sarah, the AI assistant for ${businessName || 'your business'}. I'd be happy to help you with that. Let me ask you a few quick questions to make sure I get all the details right.`;
    }

    // Sarah's voice ID (hardcoded — not Ava's voice)
    const targetVoiceId = voiceId || 'DODLEQrClDo8wCz460ld';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ code: 'TTS_ERROR', message: `ElevenLabs ${response.status}: ${errorText}` });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    res.json({ audioUrl: `data:audio/mpeg;base64,${base64Audio}`, cached: false });
  } catch (error: any) {
    console.error('preview-audio error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 4. POST /api/frontdesk/numbers/search — Twilio availablePhoneNumbers
// =====================================================================
router.post('/api/frontdesk/numbers/search', async (req: Request, res: Response) => {
  try {
    const client = getTwilioClient();
    if (!client) return res.status(503).json({ code: 'TWILIO_NOT_CONFIGURED', message: 'Twilio not configured' });

    const { country = 'US', areaCode, contains, numberType = 'local', limit = 10 } = req.body;
    if (!areaCode) return res.status(400).json({ code: 'MISSING_AREA_CODE', message: 'areaCode required' });

    const params: any = { areaCode, limit };
    if (contains) params.contains = contains;

    let numbers: any[];
    if (numberType === 'tollfree') {
      numbers = await client.availablePhoneNumbers(country).tollFree.list(params);
    } else {
      numbers = await client.availablePhoneNumbers(country).local.list(params);
    }

    res.json({
      numbers: numbers.map((n: any) => ({
        e164: n.phoneNumber,
        locality: n.locality || '',
        region: n.region || '',
        capabilities: n.capabilities || {},
      })),
    });
  } catch (error: any) {
    console.error('numbers/search error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 5. POST /api/frontdesk/numbers/purchase — enqueue PROVISION_DID
// =====================================================================
router.post('/api/frontdesk/numbers/purchase', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const officeId = getOfficeId(req);
    const { e164 } = req.body;
    if (!e164) return res.status(400).json({ code: 'MISSING_E164', message: 'e164 required' });

    // Check if business line exists; if not, create one
    let blResult = await db.execute(sql`
      SELECT business_line_id, line_mode FROM public.business_lines
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY created_at DESC LIMIT 1
    `);
    let blRows = (blResult.rows || blResult) as any[];

    if (blRows.length === 0) {
      blResult = await db.execute(sql`
        INSERT INTO public.business_lines (suite_id, owner_office_id, line_mode, business_number)
        VALUES (${suiteId}::uuid, ${officeId}::uuid, 'ASPIRE_FULL_DUPLEX', ${e164})
        RETURNING business_line_id, line_mode
      `);
      blRows = (blResult.rows || blResult) as any[];
    }

    const bl = blRows[0];
    if (bl.line_mode !== 'ASPIRE_FULL_DUPLEX') {
      return res.status(403).json({
        code: 'OUTBOUND_BLOCKED',
        message: 'Number purchase requires ASPIRE_FULL_DUPLEX line mode',
      });
    }

    const corrId = correlationId();
    const jobId = await enqueueOutbox(suiteId, 'PROVISION_DID', `provision:${e164}`, {
      e164,
      business_line_id: bl.business_line_id,
      suite_id: suiteId,
      office_id: officeId,
      correlation_id: corrId,
    });

    await writeReceipt(suiteId, 'frontdesk.number.purchase_requested', {
      e164, business_line_id: bl.business_line_id, job_id: jobId,
    }, corrId);

    res.json({ outboxJobId: jobId, businessNumber: e164, status: 'provisioning' });
  } catch (error: any) {
    console.error('numbers/purchase error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 6. POST /api/frontdesk/numbers/release — enqueue RELEASE_DID
// =====================================================================
router.post('/api/frontdesk/numbers/release', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { businessNumber } = req.body;
    if (!businessNumber) return res.status(400).json({ code: 'MISSING_NUMBER', message: 'businessNumber required' });

    const corrId = correlationId();
    const jobId = await enqueueOutbox(suiteId, 'RELEASE_DID', `release:${businessNumber}`, {
      businessNumber, suite_id: suiteId, correlation_id: corrId,
    });

    await writeReceipt(suiteId, 'frontdesk.number.release_requested', {
      businessNumber, job_id: jobId,
    }, corrId);

    res.json({ outboxJobId: jobId, status: 'releasing' });
  } catch (error: any) {
    console.error('numbers/release error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 7. GET /api/frontdesk/calls — query call_sessions
// =====================================================================
router.get('/api/frontdesk/calls', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);

    const result = await db.execute(sql`
      SELECT
        call_session_id, suite_id, business_line_id, owner_office_id,
        direction, status, from_number, to_number, caller_name,
        duration_seconds, provider, provider_call_id,
        started_at, ended_at, recording_url, voicemail_url,
        metadata, created_at, updated_at
      FROM public.call_sessions
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY started_at DESC
      LIMIT ${limit}
    `);
    const rows = (result.rows || result) as any[];
    res.json({ calls: rows, total: rows.length });
  } catch (error: any) {
    console.error('GET /api/frontdesk/calls error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 8. POST /api/frontdesk/return-call — outbox-first return call
// =====================================================================
router.post('/api/frontdesk/return-call', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { callSessionId, note } = req.body;
    if (!callSessionId) return res.status(400).json({ code: 'MISSING_SESSION', message: 'callSessionId required' });

    // Check line mode — Law #3: Fail closed on inbound-only
    const blResult = await db.execute(sql`
      SELECT bl.line_mode, bl.business_number, cs.from_number, cs.to_number
      FROM public.call_sessions cs
      JOIN public.business_lines bl ON bl.business_line_id = cs.business_line_id
      WHERE cs.call_session_id = ${callSessionId}::uuid
        AND cs.suite_id = ${suiteId}::uuid
    `);
    const blRows = (blResult.rows || blResult) as any[];
    if (blRows.length === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Call session not found' });

    const { line_mode, business_number, from_number } = blRows[0];
    if (line_mode === 'EXISTING_INBOUND_ONLY') {
      return res.status(403).json({
        code: 'OUTBOUND_BLOCKED',
        message: 'Outbound calls are not available with inbound-only line mode. Upgrade to Aspire Full Duplex to enable return calls.',
      });
    }

    const corrId = correlationId();
    const jobId = await enqueueOutbox(suiteId, 'OUTBOUND_CALL', `return:${callSessionId}`, {
      call_session_id: callSessionId,
      to_e164: from_number,
      from_e164: business_number,
      note,
      suite_id: suiteId,
      correlation_id: corrId,
    });

    const receiptId = await writeReceipt(suiteId, 'frontdesk.call.return_requested', {
      call_session_id: callSessionId, to_e164: from_number, job_id: jobId,
    }, corrId);

    res.json({ outboxJobId: jobId, receiptId });
  } catch (error: any) {
    console.error('return-call error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 9. POST /api/frontdesk/outbound-call — outbox-first outbound call
// =====================================================================
router.post('/api/frontdesk/outbound-call', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const officeId = getOfficeId(req);
    const { toE164, note } = req.body;
    if (!toE164) return res.status(400).json({ code: 'MISSING_TO', message: 'toE164 required' });

    // Check line mode
    const blResult = await db.execute(sql`
      SELECT business_line_id, line_mode, business_number
      FROM public.business_lines
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY created_at DESC LIMIT 1
    `);
    const blRows = (blResult.rows || blResult) as any[];
    if (blRows.length === 0) return res.status(404).json({ code: 'NO_LINE', message: 'No business line configured' });

    const { business_line_id, line_mode, business_number } = blRows[0];
    if (line_mode === 'EXISTING_INBOUND_ONLY') {
      return res.status(403).json({
        code: 'OUTBOUND_BLOCKED',
        message: 'Outbound calls are not available with inbound-only line mode. Upgrade to Aspire Full Duplex to enable outbound calls.',
      });
    }

    const corrId = correlationId();
    const jobId = await enqueueOutbox(suiteId, 'OUTBOUND_CALL', `outbound:${toE164}:${Date.now()}`, {
      to_e164: toE164,
      from_e164: business_number,
      business_line_id,
      office_id: officeId,
      note,
      suite_id: suiteId,
      correlation_id: corrId,
    });

    const receiptId = await writeReceipt(suiteId, 'frontdesk.call.outbound_requested', {
      to_e164: toE164, business_line_id, job_id: jobId,
    }, corrId);

    res.json({ outboxJobId: jobId, receiptId });
  } catch (error: any) {
    console.error('outbound-call error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 10. GET /api/messages/threads — SMS thread list
// =====================================================================
router.get('/api/messages/threads', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);

    const result = await db.execute(sql`
      SELECT thread_id, suite_id, owner_office_id, business_line_id,
             business_number_e164, counterparty_e164,
             last_message_at, unread_count, status, created_at
      FROM public.frontdesk_sms_threads
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY last_message_at DESC NULLS LAST
      LIMIT ${limit}
    `);
    const rows = (result.rows || result) as any[];
    res.json({ threads: rows, total: rows.length });
  } catch (error: any) {
    console.error('GET /api/messages/threads error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 11. GET /api/messages/threads/:threadId/messages
// =====================================================================
router.get('/api/messages/threads/:threadId/messages', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { threadId } = req.params;
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 500);

    const result = await db.execute(sql`
      SELECT sms_message_id, suite_id, thread_id, direction, body,
             num_segments, media_count, media_urls, delivery_status,
             provider, provider_message_sid, received_at, created_at
      FROM public.frontdesk_sms_messages
      WHERE suite_id = ${suiteId}::uuid AND thread_id = ${threadId}::uuid
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);
    const rows = (result.rows || result) as any[];
    res.json({ messages: rows, total: rows.length });
  } catch (error: any) {
    console.error('GET /api/messages/threads/:id/messages error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 12. POST /api/messages/send — compliance gate → outbox-first SMS
// =====================================================================
router.post('/api/messages/send', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { toE164, body, mediaUrls } = req.body;
    if (!toE164 || !body) return res.status(400).json({ code: 'MISSING_FIELDS', message: 'toE164 and body required' });

    // Law #3: Fail closed — check SMS compliance gate
    const compResult = await db.execute(sql`
      SELECT sms_enabled FROM public.frontdesk_messaging_compliance
      WHERE suite_id = ${suiteId}::uuid
    `);
    const compRows = (compResult.rows || compResult) as any[];
    const smsEnabled = compRows[0]?.sms_enabled ?? false;
    if (!smsEnabled) {
      return res.status(403).json({
        code: 'SMS_NOT_ENABLED',
        message: 'SMS messaging is not enabled for this account. Contact support to enable SMS.',
      });
    }

    // Check opt-out
    const blResult = await db.execute(sql`
      SELECT business_number FROM public.business_lines
      WHERE suite_id = ${suiteId}::uuid ORDER BY created_at DESC LIMIT 1
    `);
    const blRows = (blResult.rows || blResult) as any[];
    const businessNumber = blRows[0]?.business_number;

    if (businessNumber) {
      const optOutResult = await db.execute(sql`
        SELECT 1 FROM public.frontdesk_sms_opt_outs
        WHERE suite_id = ${suiteId}::uuid
          AND business_number_e164 = ${businessNumber}
          AND counterparty_e164 = ${toE164}
      `);
      const optOutRows = (optOutResult.rows || optOutResult) as any[];
      if (optOutRows.length > 0) {
        return res.status(403).json({
          code: 'OPTED_OUT',
          message: 'This recipient has opted out of SMS messages.',
        });
      }
    }

    const corrId = correlationId();
    const jobId = await enqueueOutbox(suiteId, 'SMS_SEND', `sms:${toE164}:${Date.now()}`, {
      to_e164: toE164,
      from_e164: businessNumber,
      body,
      media_urls: mediaUrls || [],
      suite_id: suiteId,
      correlation_id: corrId,
    });

    const receiptId = await writeReceipt(suiteId, 'frontdesk.sms.send_requested', {
      to_e164: toE164, body_length: body.length, job_id: jobId,
    }, corrId);

    res.json({ outboxJobId: jobId, receiptId });
  } catch (error: any) {
    console.error('messages/send error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 13. GET /api/voicemail — list voicemails
// =====================================================================
router.get('/api/voicemail', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);

    const result = await db.execute(sql`
      SELECT voicemail_id, suite_id, business_line_id, owner_office_id,
             call_session_id, from_e164, to_e164, duration_seconds,
             transcript_status,
             LEFT(transcript_text, 120) AS transcript_preview,
             recording_uri IS NOT NULL AS has_recording,
             created_at
      FROM public.frontdesk_voicemails
      WHERE suite_id = ${suiteId}::uuid
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    const rows = (result.rows || result) as any[];
    res.json({ voicemails: rows, total: rows.length });
  } catch (error: any) {
    console.error('GET /api/voicemail error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 14. GET /api/voicemail/:id — voicemail detail + transcript
// =====================================================================
router.get('/api/voicemail/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT * FROM public.frontdesk_voicemails
      WHERE voicemail_id = ${id}::uuid AND suite_id = ${suiteId}::uuid
    `);
    const rows = (result.rows || result) as any[];
    if (rows.length === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Voicemail not found' });
    res.json(rows[0]);
  } catch (error: any) {
    console.error('GET /api/voicemail/:id error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// 15. GET /api/voicemail/:id/audio — redirect to recording URI
// =====================================================================
router.get('/api/voicemail/:id/audio', async (req: Request, res: Response) => {
  try {
    const suiteId = getSuiteId(req);
    const { id } = req.params;

    const result = await db.execute(sql`
      SELECT recording_uri FROM public.frontdesk_voicemails
      WHERE voicemail_id = ${id}::uuid AND suite_id = ${suiteId}::uuid
    `);
    const rows = (result.rows || result) as any[];
    if (rows.length === 0 || !rows[0].recording_uri) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Recording not found' });
    }
    res.json({ url: rows[0].recording_uri });
  } catch (error: any) {
    console.error('GET /api/voicemail/:id/audio error:', error.message);
    res.status(500).json({ code: 'INTERNAL', message: error.message });
  }
});

// =====================================================================
// WEBHOOK ENDPOINTS (Twilio-facing, signature-validated, no JWT)
// =====================================================================

// 16. POST /api/webhooks/twilio/voice — voice call events
router.post('/api/webhooks/twilio/voice', async (req: Request, res: Response) => {
  try {
    twilioValidateOrThrow(req);

    const { CallSid, CallStatus, From, To, Direction, CallDuration, CallerName } = req.body;
    if (!CallSid) return res.status(400).send('<Response></Response>');

    // Build idempotency key
    const CallbackSource = req.body.CallbackSource || 'call_progress';
    const SequenceNumber = req.body.SequenceNumber || '0';
    const eventId = `${CallSid}:${CallbackSource}:${SequenceNumber}`;

    // Resolve suite from the "To" number (the business DID)
    const toNumber = To?.replace(/[^+\d]/g, '');
    const resolved = toNumber ? await resolveSuiteByBusinessNumber(toNumber) : null;

    if (!resolved) {
      // Unknown number — still return 200 to prevent Twilio retry storms
      console.warn('Webhook for unknown business number:', toNumber);
      // Receipt for unknown number (no suite context — write without RLS)
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.unknown_number',
            ${`webhook_${Date.now()}`}, ${JSON.stringify({ to_number: toNumber, call_sid: CallSid })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(200).send('<Response></Response>');
    }

    // Set RLS context for this suite
    await setJwtClaims(resolved.suite_id, resolved.owner_office_id);

    // Dedupe
    const isNew = await dedupeEvent(
      resolved.suite_id, 'twilio', eventId, CallSid, CallStatus,
      JSON.stringify({ From, To, Direction, CallStatus }),
    );

    if (isNew) {
      // Enqueue for outbox processing
      await enqueueOutbox(resolved.suite_id, 'VOICE_EVENT_INGEST', eventId, {
        call_sid: CallSid,
        call_status: CallStatus,
        from_number: From,
        to_number: To,
        direction: Direction || 'inbound',
        duration: CallDuration,
        caller_name: CallerName,
        business_line_id: resolved.business_line_id,
        owner_office_id: resolved.owner_office_id,
      });
    } else {
      // Receipt for duplicate skip
      await writeReceipt(resolved.suite_id, 'frontdesk.webhook.duplicate_skipped', { event_id: eventId, call_sid: CallSid });
    }

    res.status(200).send('<Response></Response>');
  } catch (error: any) {
    console.error('Webhook /twilio/voice error:', error.message);
    // Signature failures return 403 with receipt
    if (error.message.includes('signature') || error.message.includes('Signature')) {
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.signature_failed',
            ${`sig_${Date.now()}`}, ${JSON.stringify({ path: '/twilio/voice', error: error.message })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(403).json({ code: 'INVALID_SIGNATURE', message: error.message });
    }
    res.status(200).send('<Response></Response>');
  }
});

// 17. POST /api/webhooks/twilio/sms/inbound — SMS inbound
router.post('/api/webhooks/twilio/sms/inbound', async (req: Request, res: Response) => {
  try {
    twilioValidateOrThrow(req);

    const { MessageSid, From, To, Body, NumSegments, NumMedia } = req.body;
    if (!MessageSid) return res.status(400).send('<Response></Response>');

    const eventId = `${MessageSid}:inbound`;
    const toNumber = To?.replace(/[^+\d]/g, '');
    const resolved = toNumber ? await resolveSuiteByBusinessNumber(toNumber) : null;

    if (!resolved) {
      console.warn('SMS webhook for unknown business number:', toNumber);
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.unknown_number',
            ${`webhook_${Date.now()}`}, ${JSON.stringify({ to_number: toNumber, message_sid: MessageSid })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(200).send('<Response></Response>');
    }

    await setJwtClaims(resolved.suite_id, resolved.owner_office_id);

    const isNew = await dedupeEvent(
      resolved.suite_id, 'twilio', eventId, MessageSid, 'inbound',
      JSON.stringify({ From, To, Body: Body?.substring(0, 100) }),
    );

    if (isNew) {
      await enqueueOutbox(resolved.suite_id, 'SMS_INBOUND_INGEST', eventId, {
        message_sid: MessageSid,
        from_e164: From,
        to_e164: To,
        body: Body,
        num_segments: NumSegments ? parseInt(NumSegments, 10) : 1,
        num_media: NumMedia ? parseInt(NumMedia, 10) : 0,
        business_line_id: resolved.business_line_id,
        owner_office_id: resolved.owner_office_id,
      });
    } else {
      await writeReceipt(resolved.suite_id, 'frontdesk.webhook.duplicate_skipped', { event_id: eventId, message_sid: MessageSid });
    }

    res.status(200).send('<Response></Response>');
  } catch (error: any) {
    console.error('Webhook /twilio/sms/inbound error:', error.message);
    if (error.message.includes('signature') || error.message.includes('Signature')) {
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.signature_failed',
            ${`sig_${Date.now()}`}, ${JSON.stringify({ path: '/twilio/sms/inbound', error: error.message })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(403).json({ code: 'INVALID_SIGNATURE', message: error.message });
    }
    res.status(200).send('<Response></Response>');
  }
});

// 18. POST /api/webhooks/twilio/sms/status — SMS delivery status
router.post('/api/webhooks/twilio/sms/status', async (req: Request, res: Response) => {
  try {
    twilioValidateOrThrow(req);

    const { MessageSid, MessageStatus, From, To } = req.body;
    if (!MessageSid) return res.status(400).send('<Response></Response>');

    const eventId = `${MessageSid}:${MessageStatus || 'unknown'}`;
    // For status callbacks, the "From" is our business number
    const fromNumber = From?.replace(/[^+\d]/g, '');
    const resolved = fromNumber ? await resolveSuiteByBusinessNumber(fromNumber) : null;

    if (!resolved) {
      console.warn('SMS status for unknown business number:', fromNumber);
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.unknown_number',
            ${`webhook_${Date.now()}`}, ${JSON.stringify({ from_number: fromNumber, message_sid: MessageSid })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(200).send('<Response></Response>');
    }

    await setJwtClaims(resolved.suite_id, resolved.owner_office_id);

    const isNew = await dedupeEvent(
      resolved.suite_id, 'twilio', eventId, MessageSid, MessageStatus,
    );

    if (isNew) {
      await enqueueOutbox(resolved.suite_id, 'SMS_STATUS_INGEST', eventId, {
        message_sid: MessageSid,
        status: MessageStatus,
        from_e164: From,
        to_e164: To,
        business_line_id: resolved.business_line_id,
      });
    } else {
      await writeReceipt(resolved.suite_id, 'frontdesk.webhook.duplicate_skipped', { event_id: eventId, message_sid: MessageSid });
    }

    res.status(200).send('<Response></Response>');
  } catch (error: any) {
    console.error('Webhook /twilio/sms/status error:', error.message);
    if (error.message.includes('signature') || error.message.includes('Signature')) {
      try {
        await db.execute(sql`
          INSERT INTO public.frontdesk_action_receipts (suite_id, actor_type, action_type, correlation_id, payload)
          VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'system', 'frontdesk.webhook.signature_failed',
            ${`sig_${Date.now()}`}, ${JSON.stringify({ path: '/twilio/sms/status', error: error.message })}::jsonb)
        `);
      } catch (_) { /* best-effort receipt */ }
      return res.status(403).json({ code: 'INVALID_SIGNATURE', message: error.message });
    }
    res.status(200).send('<Response></Response>');
  }
});

// =====================================================================
// OUTBOX WORKER (inline — poll every 2s)
// =====================================================================

const WORKER_ID = `desktop-${process.pid}`;
const OUTBOX_POLL_INTERVAL = 2000;
const OUTBOX_BATCH_SIZE = 10;

async function processOutboxJob(job: any): Promise<void> {
  const { job_id, job_type, payload, suite_id } = job;
  const p = typeof payload === 'string' ? JSON.parse(payload) : payload;

  // Set RLS context for the job's suite
  await setJwtClaims(suite_id);

  switch (job_type) {
    case 'VOICE_EVENT_INGEST': {
      // Upsert call_sessions
      await db.execute(sql`
        INSERT INTO public.call_sessions (
          suite_id, business_line_id, owner_office_id,
          direction, status, from_number, to_number, caller_name,
          duration_seconds, provider, provider_call_id, started_at,
          ended_at
        ) VALUES (
          ${suite_id}::uuid,
          ${p.business_line_id}::uuid,
          ${p.owner_office_id}::uuid,
          ${(p.direction || 'inbound')}::frontdesk_call_direction,
          ${mapTwilioStatus(p.call_status)}::frontdesk_call_status,
          ${p.from_number}, ${p.to_number}, ${p.caller_name || null},
          ${p.duration ? parseInt(p.duration, 10) : null},
          'twilio', ${p.call_sid},
          now(),
          ${isTerminalStatus(p.call_status) ? sql`now()` : sql`NULL`}
        )
        ON CONFLICT (provider, provider_call_id) DO UPDATE SET
          status = EXCLUDED.status,
          duration_seconds = COALESCE(EXCLUDED.duration_seconds, public.call_sessions.duration_seconds),
          caller_name = COALESCE(EXCLUDED.caller_name, public.call_sessions.caller_name),
          ended_at = COALESCE(EXCLUDED.ended_at, public.call_sessions.ended_at),
          updated_at = now()
      `);

      await writeReceipt(suite_id, 'frontdesk.voice.event_ingested', {
        call_sid: p.call_sid, status: p.call_status,
      }, p.correlation_id);

      // If terminal, enqueue CALL_FINALIZE
      if (isTerminalStatus(p.call_status)) {
        await enqueueOutbox(suite_id, 'CALL_FINALIZE', `finalize:${p.call_sid}`, {
          call_sid: p.call_sid,
          business_line_id: p.business_line_id,
          suite_id,
        });
      }
      break;
    }

    case 'CALL_FINALIZE': {
      // Write call receipt
      const csResult = await db.execute(sql`
        SELECT call_session_id, duration_seconds, status
        FROM public.call_sessions
        WHERE provider = 'twilio' AND provider_call_id = ${p.call_sid}
          AND suite_id = ${suite_id}::uuid
      `);
      const csRows = (csResult.rows || csResult) as any[];
      if (csRows.length > 0) {
        const cs = csRows[0];
        await db.execute(sql`
          INSERT INTO public.frontdesk_call_receipts (
            suite_id, call_session_id, actor_type, outcome, summary
          ) VALUES (
            ${suite_id}::uuid, ${cs.call_session_id}::uuid, 'agent',
            ${cs.status}, ${JSON.stringify({ duration: cs.duration_seconds })}::jsonb
          )
        `);
        await writeReceipt(suite_id, 'frontdesk.call.finalized', {
          call_session_id: cs.call_session_id, status: cs.status,
        });
      }
      break;
    }

    case 'SMS_INBOUND_INGEST': {
      // Upsert thread
      const threadResult = await db.execute(sql`
        INSERT INTO public.frontdesk_sms_threads (
          suite_id, owner_office_id, business_line_id,
          business_number_e164, counterparty_e164,
          last_message_at, unread_count
        ) VALUES (
          ${suite_id}::uuid, ${p.owner_office_id}::uuid, ${p.business_line_id}::uuid,
          ${p.to_e164}, ${p.from_e164},
          now(), 1
        )
        ON CONFLICT (suite_id, business_number_e164, counterparty_e164) DO UPDATE SET
          last_message_at = now(),
          unread_count = public.frontdesk_sms_threads.unread_count + 1,
          updated_at = now()
        RETURNING thread_id
      `);
      const threadRows = (threadResult.rows || threadResult) as any[];
      const threadId = threadRows[0]?.thread_id;

      if (threadId) {
        await db.execute(sql`
          INSERT INTO public.frontdesk_sms_messages (
            suite_id, thread_id, direction, body,
            num_segments, media_count, delivery_status,
            provider, provider_message_sid, received_at
          ) VALUES (
            ${suite_id}::uuid, ${threadId}::uuid, 'inbound'::frontdesk_message_direction,
            ${p.body}, ${p.num_segments || 1}, ${p.num_media || 0},
            'received', 'twilio', ${p.message_sid}, now()
          )
          ON CONFLICT (provider, provider_message_sid, suite_id) DO NOTHING
        `);

        // Check for opt-out keywords
        const bodyLower = (p.body || '').toLowerCase().trim();
        if (['stop', 'unsubscribe', 'cancel', 'end', 'quit'].includes(bodyLower)) {
          await db.execute(sql`
            INSERT INTO public.frontdesk_sms_opt_outs (suite_id, business_number_e164, counterparty_e164)
            VALUES (${suite_id}::uuid, ${p.to_e164}, ${p.from_e164})
            ON CONFLICT DO NOTHING
          `);
        }
      }

      await writeReceipt(suite_id, 'frontdesk.sms.inbound_ingested', {
        message_sid: p.message_sid, from: p.from_e164, thread_id: threadId,
      });
      break;
    }

    case 'SMS_STATUS_INGEST': {
      // Update delivery status on existing message
      await db.execute(sql`
        UPDATE public.frontdesk_sms_messages
        SET delivery_status = ${p.status}
        WHERE provider = 'twilio' AND provider_message_sid = ${p.message_sid}
          AND suite_id = ${suite_id}::uuid
      `);

      await writeReceipt(suite_id, 'frontdesk.sms.status_updated', {
        message_sid: p.message_sid, status: p.status,
      });
      break;
    }

    case 'SMS_SEND': {
      const client = getTwilioClient();
      if (!client) throw new Error('Twilio not configured');

      // TOCTOU re-check: compliance gate may have changed since enqueue
      const complianceCheck = await db.execute(sql`
        SELECT sms_enabled FROM public.frontdesk_messaging_compliance
        WHERE suite_id = ${suite_id}::uuid LIMIT 1
      `);
      const compRows = (complianceCheck.rows || complianceCheck) as any[];
      if (!compRows[0]?.sms_enabled) {
        await writeReceipt(suite_id, 'frontdesk.sms.blocked_at_execution', {
          reason: 'sms_disabled_after_enqueue', to: p.to_e164,
        }, p.correlation_id);
        throw new Error('SMS disabled — compliance gate failed at execution time');
      }

      // TOCTOU re-check: opt-out may have arrived since enqueue
      const optOutCheck = await db.execute(sql`
        SELECT 1 FROM public.frontdesk_sms_opt_outs
        WHERE suite_id = ${suite_id}::uuid AND e164 = ${p.to_e164} LIMIT 1
      `);
      const optOutRows = (optOutCheck.rows || optOutCheck) as any[];
      if (optOutRows.length > 0) {
        await writeReceipt(suite_id, 'frontdesk.sms.blocked_at_execution', {
          reason: 'recipient_opted_out_after_enqueue', to: p.to_e164,
        }, p.correlation_id);
        throw new Error('Recipient opted out — SMS blocked at execution time');
      }

      const msg = await client.messages.create({
        to: p.to_e164,
        from: p.from_e164,
        body: p.body,
        ...(p.media_urls?.length ? { mediaUrl: p.media_urls } : {}),
      });

      // Upsert thread
      const threadResult = await db.execute(sql`
        INSERT INTO public.frontdesk_sms_threads (
          suite_id, owner_office_id, business_line_id,
          business_number_e164, counterparty_e164, last_message_at
        ) VALUES (
          ${suite_id}::uuid,
          ${p.owner_office_id || getDefaultOfficeId()}::uuid,
          ${p.business_line_id || sql`(SELECT business_line_id FROM public.business_lines WHERE suite_id = ${suite_id}::uuid LIMIT 1)`},
          ${p.from_e164}, ${p.to_e164}, now()
        )
        ON CONFLICT (suite_id, business_number_e164, counterparty_e164) DO UPDATE SET
          last_message_at = now(),
          updated_at = now()
        RETURNING thread_id
      `);
      const threadRows = (threadResult.rows || threadResult) as any[];
      const threadId = threadRows[0]?.thread_id;

      if (threadId) {
        await db.execute(sql`
          INSERT INTO public.frontdesk_sms_messages (
            suite_id, thread_id, direction, body,
            num_segments, delivery_status,
            provider, provider_message_sid
          ) VALUES (
            ${suite_id}::uuid, ${threadId}::uuid, 'outbound'::frontdesk_message_direction,
            ${p.body}, ${msg.numSegments || 1}, 'sent',
            'twilio', ${msg.sid}
          )
          ON CONFLICT (provider, provider_message_sid, suite_id) DO NOTHING
        `);
      }

      await writeReceipt(suite_id, 'frontdesk.sms.sent', {
        message_sid: msg.sid, to: p.to_e164, segments: msg.numSegments,
      }, p.correlation_id);
      break;
    }

    case 'OUTBOUND_CALL': {
      const client = getTwilioClient();
      if (!client) throw new Error('Twilio not configured');

      // TOCTOU re-check: line mode may have changed since enqueue
      const lineModeCheck = await db.execute(sql`
        SELECT line_mode FROM public.business_lines
        WHERE business_line_id = ${p.business_line_id}::uuid AND suite_id = ${suite_id}::uuid
        LIMIT 1
      `);
      const lineRows = (lineModeCheck.rows || lineModeCheck) as any[];
      if (lineRows[0]?.line_mode === 'EXISTING_INBOUND_ONLY') {
        await writeReceipt(suite_id, 'frontdesk.call.blocked_at_execution', {
          reason: 'line_mode_changed_to_inbound_only', to: p.to_e164,
        }, p.correlation_id);
        throw new Error('Line mode changed to EXISTING_INBOUND_ONLY — outbound call blocked');
      }

      const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
      const call = await client.calls.create({
        to: p.to_e164,
        from: p.from_e164,
        statusCallback: `${publicBaseUrl}/api/webhooks/twilio/voice`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      });

      // Insert call session
      await db.execute(sql`
        INSERT INTO public.call_sessions (
          suite_id, business_line_id, owner_office_id,
          direction, status, from_number, to_number,
          provider, provider_call_id, started_at
        ) VALUES (
          ${suite_id}::uuid,
          ${p.business_line_id}::uuid,
          ${p.office_id || getDefaultOfficeId()}::uuid,
          'outbound'::frontdesk_call_direction,
          'ringing'::frontdesk_call_status,
          ${p.from_e164}, ${p.to_e164},
          'twilio', ${call.sid}, now()
        )
        ON CONFLICT (provider, provider_call_id) DO NOTHING
      `);

      await writeReceipt(suite_id, 'frontdesk.call.outbound_initiated', {
        call_sid: call.sid, to: p.to_e164, from: p.from_e164,
      }, p.correlation_id);
      break;
    }

    case 'PROVISION_DID': {
      const client = getTwilioClient();
      if (!client) throw new Error('Twilio not configured');

      const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
      const number = await client.incomingPhoneNumbers.create({
        phoneNumber: p.e164,
        voiceUrl: `${publicBaseUrl}/api/webhooks/twilio/voice`,
        voiceMethod: 'POST',
        smsUrl: `${publicBaseUrl}/api/webhooks/twilio/sms/inbound`,
        smsMethod: 'POST',
        statusCallback: `${publicBaseUrl}/api/webhooks/twilio/voice`,
        statusCallbackMethod: 'POST',
      });

      // Persist provider resource
      await db.execute(sql`
        INSERT INTO public.frontdesk_provider_resources (
          suite_id, business_line_id, provider, business_number_e164,
          twilio_incoming_phone_number_sid, status
        ) VALUES (
          ${suite_id}::uuid, ${p.business_line_id}::uuid, 'twilio',
          ${p.e164}, ${number.sid}, 'active'
        )
        ON CONFLICT (suite_id, business_line_id) DO UPDATE SET
          twilio_incoming_phone_number_sid = EXCLUDED.twilio_incoming_phone_number_sid,
          status = 'active',
          updated_at = now()
      `);

      // Update business_lines with the number
      await db.execute(sql`
        UPDATE public.business_lines SET business_number = ${p.e164}, updated_at = now()
        WHERE business_line_id = ${p.business_line_id}::uuid AND suite_id = ${suite_id}::uuid
      `);

      await writeReceipt(suite_id, 'frontdesk.number.provisioned', {
        e164: p.e164, twilio_sid: number.sid,
      }, p.correlation_id);
      break;
    }

    case 'RELEASE_DID': {
      const client = getTwilioClient();
      if (!client) throw new Error('Twilio not configured');

      // Find the provider resource
      const prResult = await db.execute(sql`
        SELECT twilio_incoming_phone_number_sid FROM public.frontdesk_provider_resources
        WHERE suite_id = ${suite_id}::uuid AND business_number_e164 = ${p.businessNumber}
      `);
      const prRows = (prResult.rows || prResult) as any[];
      const twilioSid = prRows[0]?.twilio_incoming_phone_number_sid;

      if (twilioSid) {
        await client.incomingPhoneNumbers(twilioSid).remove();
      }

      await db.execute(sql`
        UPDATE public.frontdesk_provider_resources
        SET status = 'released', released_at = now(), updated_at = now()
        WHERE suite_id = ${suite_id}::uuid AND business_number_e164 = ${p.businessNumber}
      `);

      await writeReceipt(suite_id, 'frontdesk.number.released', {
        businessNumber: p.businessNumber,
      }, p.correlation_id);
      break;
    }

    default:
      console.warn(`Unknown outbox job type: ${job_type}`);
  }
}

function mapTwilioStatus(status: string): string {
  const map: Record<string, string> = {
    initiated: 'ringing',
    ringing: 'ringing',
    'in-progress': 'in_progress',
    answered: 'in_progress',
    completed: 'completed',
    busy: 'failed',
    failed: 'failed',
    'no-answer': 'failed',
    canceled: 'failed',
  };
  return map[status?.toLowerCase()] || 'ringing';
}

function isTerminalStatus(status: string): boolean {
  return ['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status?.toLowerCase());
}

let outboxInterval: ReturnType<typeof setInterval> | null = null;

async function pollOutbox() {
  try {
    const result = await db.execute(sql`
      SELECT * FROM public.frontdesk_outbox_claim(${WORKER_ID}, ${OUTBOX_BATCH_SIZE})
    `);
    const jobs = (result.rows || result) as any[];

    for (const job of jobs) {
      try {
        await processOutboxJob(job);
        await db.execute(sql`SELECT public.frontdesk_outbox_complete(${job.job_id}::uuid)`);
      } catch (err: any) {
        console.error(`Outbox job ${job.job_id} (${job.job_type}) failed:`, err.message);
        const backoff = Math.min(30 * Math.pow(2, job.attempts - 1), 3600);
        await db.execute(sql`SELECT public.frontdesk_outbox_fail(${job.job_id}::uuid, ${err.message}, ${backoff})`);
        // Failure receipt — Law #2: failures must be auditable
        try {
          await writeReceipt(job.suite_id, 'frontdesk.job.failed', {
            job_id: job.job_id, job_type: job.job_type,
            error: err.message, attempt: job.attempts,
          });
        } catch (_) { /* best-effort receipt */ }
      }
    }
  } catch (err: any) {
    // Silently skip if tables don't exist yet (migration not run)
    if (!err.message?.includes('does not exist')) {
      console.error('Outbox poll error:', err.message);
    }
  }
}

/** Start the outbox worker — call from server startup */
export function startOutboxWorker() {
  if (outboxInterval) return;
  console.log('Front Desk outbox worker started (poll interval: 2s)');
  outboxInterval = setInterval(pollOutbox, OUTBOX_POLL_INTERVAL);
}

/** Stop the outbox worker */
export function stopOutboxWorker() {
  if (outboxInterval) {
    clearInterval(outboxInterval);
    outboxInterval = null;
    console.log('Front Desk outbox worker stopped');
  }
}

export default router;
