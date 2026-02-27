/**
 * Conference & LiveKit Routes
 *
 * POST /api/livekit/token        — Generate participant token (existing)
 * GET  /api/livekit/status        — Check if LiveKit is configured
 * GET  /api/conference/members    — Search suite members for internal invite
 * GET  /api/conference/lookup     — Cross-suite user lookup by office ID
 * POST /api/conference/invite-external — Send email invite to non-Aspire user
 * POST /api/conference/room-link  — Generate shareable room link with guest token
 * GET  /api/conference/join/:code — Resolve join code to LiveKit token (PUBLIC)
 *
 * All endpoints require JWT auth (not in PUBLIC_PATHS) except /join/:code.
 * Law #3: Fail Closed — no unauthenticated access to conference infrastructure.
 * Law #6: Tenant Isolation — member search is RLS-scoped by suite_id.
 * Law #9: Join codes replace raw JWTs in URLs — tokens never exposed in links.
 */
import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '../logger';
import { createTrustSpineReceipt } from '../receiptService';

const router = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_SERVER_URL || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.aspireos.app';
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';

// Supabase admin for member queries (service role bypasses RLS for controlled lookups)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ─── Existing: POST /api/livekit/token ───────────────────────────────────────

router.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, suiteId } = req.body;

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: 'roomName and participantName are required' });
    }

    // Input length caps — prevent oversized values in LiveKit grants/metadata
    if (typeof roomName !== 'string' || roomName.length > 200 ||
        typeof participantName !== 'string' || participantName.length > 100) {
      return res.status(400).json({ error: 'roomName and participantName must be reasonable length' });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res
        .status(500)
        .json({ error: 'Conference service not configured' });
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: '10m',
      metadata: suiteId ? JSON.stringify({ suiteId }) : undefined,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('LiveKit token error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── Wave 1B: GET /api/livekit/status ────────────────────────────────────────

router.get('/api/livekit/status', async (_req: Request, res: Response) => {
  try {
    const configured = !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
    res.json({
      configured,
      serverUrl: configured ? LIVEKIT_SERVER_URL : '',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('LiveKit status error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

// ─── Wave 2A: GET /api/conference/members ────────────────────────────────────
// Internal invite — search members within the caller's suite
// GREEN tier: read-only, RLS-scoped by suite_id

router.get('/api/conference/members', async (req: Request, res: Response) => {
  try {
    const rawQuery = (req.query.q as string || '').trim();
    const suiteId = (req as any).authenticatedSuiteId;
    const userId = (req as any).authenticatedUserId;

    if (!suiteId) {
      return res.status(400).json({ error: 'Suite context required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Sanitize search input: strip PostgREST special chars to prevent filter injection
    // Commas stripped because PostgREST .or() uses comma as condition separator
    const q = rawQuery.replace(/[%_\\'"();,.]/g, '').slice(0, 50);

    // Query suite_profiles for members of the same suite, exclude self
    let query = supabaseAdmin
      .from('suite_profiles')
      .select('user_id, full_name, email, office_id, avatar_url')
      .eq('suite_id', suiteId)
      .limit(10);

    if (userId) {
      query = query.neq('user_id', userId);
    }

    if (q) {
      // Search by name or email (case-insensitive) using PostgREST .or() filter
      // Input is sanitized above to prevent filter injection
      query = query.or(`full_name.ilike.*${q}*,email.ilike.*${q}*`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Conference members query error', { error: error.message, suiteId });
      return res.status(500).json({ error: 'Failed to search members' });
    }

    const members = (data || []).map((row: any) => ({
      userId: row.user_id,
      name: row.full_name || row.email?.split('@')[0] || 'Unknown',
      email: row.email || '',
      officeId: row.office_id || '',
      officeLabel: row.office_id ? `Office ${row.office_id.slice(0, 8)}` : '',
      avatarUrl: row.avatar_url || null,
    }));

    res.json(members);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference members error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Wave 2B: GET /api/conference/lookup ─────────────────────────────────────
// Cross-suite invite — look up Aspire users in other suites by display ID
// GREEN tier: returns display names only (no email, no internal data)
// Rate-limited: max 10 lookups per user per 5 minutes to prevent enumeration

const lookupRateLimit = new Map<string, { count: number; resetAt: number }>();
const LOOKUP_RATE_LIMIT = 10;
const LOOKUP_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Periodic cleanup of expired rate-limit entries to prevent memory leak
// Runs every 10 minutes, evicts entries whose window has elapsed
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of lookupRateLimit) {
    if (now >= val.resetAt) {
      lookupRateLimit.delete(key);
    }
  }
}, 10 * 60 * 1000);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Node.js timer has .unref()
(rateLimitCleanupTimer as unknown as { unref?: () => void }).unref?.();

// ─── Join Code System (Law #9: no raw tokens in URLs) ────────────────────────
// Short codes (CR-XXXX) resolve server-side to LiveKit tokens.
// Idempotency: same room + userId within TTL returns the same code.
interface JoinCodeEntry {
  code: string;
  token: string;
  roomName: string;
  guestName: string;
  createdBy: string;     // userId or 'system' for room-link
  expiresAt: number;     // epoch ms
}

const joinCodeStore = new Map<string, JoinCodeEntry>();       // code → entry
const joinCodeDedup = new Map<string, string>();              // dedupKey → code

const JOIN_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateJoinCode(): string {
  // CR-XXXX: 4 uppercase alphanumeric chars → 1.6M combinations (sufficient for ephemeral codes)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid ambiguity
  let code = 'CR-';
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  // Collision check (extremely unlikely but fail-closed)
  if (joinCodeStore.has(code)) return generateJoinCode();
  return code;
}

function createJoinCode(token: string, roomName: string, guestName: string, createdBy: string): string {
  // Idempotency: same room + creator within TTL = same code
  const dedupKey = `${roomName}:${createdBy}`;
  const existingCode = joinCodeDedup.get(dedupKey);
  if (existingCode) {
    const existing = joinCodeStore.get(existingCode);
    if (existing && existing.expiresAt > Date.now()) {
      return existingCode;
    }
    // Expired — clean up
    joinCodeStore.delete(existingCode);
    joinCodeDedup.delete(dedupKey);
  }

  const code = generateJoinCode();
  const entry: JoinCodeEntry = {
    code,
    token,
    roomName,
    guestName,
    createdBy,
    expiresAt: Date.now() + JOIN_CODE_TTL_MS,
  };
  joinCodeStore.set(code, entry);
  joinCodeDedup.set(dedupKey, code);
  return code;
}

// Periodic cleanup of expired join codes (runs every 5 minutes)
const joinCodeCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of joinCodeStore) {
    if (now >= entry.expiresAt) {
      joinCodeStore.delete(code);
      const dedupKey = `${entry.roomName}:${entry.createdBy}`;
      if (joinCodeDedup.get(dedupKey) === code) {
        joinCodeDedup.delete(dedupKey);
      }
    }
  }
}, 5 * 60 * 1000);
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Node.js timer has .unref()
(joinCodeCleanupTimer as unknown as { unref?: () => void }).unref?.();

// ─── GET /api/conference/join/:code — Resolve join code (PUBLIC endpoint) ────
// This endpoint must be in PUBLIC_PATHS — guests use it without Aspire auth.
// The join code itself is the auth gate (short-lived, single-room scoped).
router.get('/api/conference/join/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Join code required' });
    }

    const entry = joinCodeStore.get(code.toUpperCase());
    if (!entry) {
      return res.status(404).json({ error: 'Invalid or expired join code' });
    }

    if (Date.now() >= entry.expiresAt) {
      joinCodeStore.delete(code.toUpperCase());
      return res.status(410).json({ error: 'Join code has expired' });
    }

    res.json({
      token: entry.token,
      roomName: entry.roomName,
      guestName: entry.guestName,
      serverUrl: LIVEKIT_SERVER_URL,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Join code resolution error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/conference/lookup', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).authenticatedUserId as string | undefined;
    const suiteId = (req as any).authenticatedSuiteId as string | undefined;

    // Law #3: Fail Closed — userId required for rate limiting and audit trail
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Rate limit check
    const now = Date.now();
    const userLimit = lookupRateLimit.get(userId);
    if (userLimit && now < userLimit.resetAt) {
      if (userLimit.count >= LOOKUP_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many lookup requests. Try again later.' });
      }
      userLimit.count++;
    } else {
      lookupRateLimit.set(userId, { count: 1, resetAt: now + LOOKUP_RATE_WINDOW_MS });
    }

    const suiteDisplayId = (req.query.suiteId as string || '').trim();
    const officeDisplayId = (req.query.officeId as string || '').trim();

    if (!suiteDisplayId || !officeDisplayId) {
      return res.status(400).json({ error: 'suiteId and officeId display IDs are required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Resolve suite display_id to actual suite
    const { data: suiteData, error: suiteError } = await supabaseAdmin
      .from('suites')
      .select('id, business_name')
      .eq('display_id', suiteDisplayId)
      .limit(1)
      .maybeSingle();

    if (suiteError || !suiteData) {
      return res.status(404).json({ error: 'Suite not found' });
    }

    // Resolve office display_id within that suite
    const { data: officeData, error: officeError } = await supabaseAdmin
      .from('offices')
      .select('id')
      .eq('suite_id', suiteData.id)
      .eq('display_id', officeDisplayId)
      .limit(1)
      .maybeSingle();

    if (officeError || !officeData) {
      return res.status(404).json({ error: 'Office not found in this suite' });
    }

    // Get members of that office — limited info only (display names)
    const { data: members, error: memberError } = await supabaseAdmin
      .from('suite_profiles')
      .select('user_id, full_name')
      .eq('suite_id', suiteData.id)
      .eq('office_id', officeData.id)
      .limit(10);

    if (memberError) {
      logger.error('Conference lookup query error', { error: memberError.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }

    const results = (members || []).map((row: any) => ({
      userId: row.user_id,
      name: row.full_name || 'Unknown',
      businessName: suiteData.business_name || '',
    }));

    // Law #2: Audit trail for cross-suite lookups (privacy-sensitive operation)
    const correlationId = req.headers['x-correlation-id'] as string | undefined;
    try {
      await createTrustSpineReceipt({
        suiteId: suiteId || 'unknown',
        receiptType: 'conference.cross_suite_lookup',
        status: 'SUCCEEDED',
        actorType: 'USER',
        actorId: userId,
        ...(correlationId ? { correlationId } : {}),
        action: { targetSuiteDisplayId: suiteDisplayId, targetOfficeDisplayId: officeDisplayId },
        result: { resultsCount: results.length },
      });
    } catch (receiptErr) {
      // GREEN tier: best-effort with structured log — don't block the operation
      logger.warn('GREEN receipt write failed for cross_suite_lookup', {
        error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
        suiteId, userId, receiptType: 'conference.cross_suite_lookup',
      });
    }

    res.json(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference lookup error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Wave 2C: POST /api/conference/invite-external ───────────────────────────
// External invite — send email to non-Aspire user via orchestrator → Eli → PolarisM
// YELLOW tier: external communication, user's "Send Invite" click IS the confirmation gate

router.post('/api/conference/invite-external', async (req: Request, res: Response) => {
  try {
    const { email, guestName, roomName, hostName, purpose } = req.body;
    const suiteId = (req as any).authenticatedSuiteId;
    const userId = (req as any).authenticatedUserId;
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (!email || !guestName || !roomName) {
      return res.status(400).json({ error: 'email, guestName, and roomName are required' });
    }

    // Guest name validation: cap length
    if (typeof guestName !== 'string' || guestName.length > 100) {
      return res.status(400).json({ error: 'Guest name must be 100 characters or fewer' });
    }

    // Room name validation: cap length (used in LiveKit grants and URLs)
    if (typeof roomName !== 'string' || roomName.length > 200) {
      return res.status(400).json({ error: 'Room name must be 200 characters or fewer' });
    }

    // Email validation: strict format + length cap + no consecutive dots
    if (
      email.length > 254 ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email) ||
      email.includes('..')
    ) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({
        sent: false,
        error: 'Conference service not configured. Copy the room link instead.',
      });
    }

    // Generate guest LiveKit token: 10m TTL, room-scoped, publish+subscribe
    // NOTE: These are session-scoped LiveKit join tokens (NOT orchestrator capability tokens).
    // Law #5 <60s applies to orchestrator capability tokens. LiveKit tokens are infrastructure
    // auth — they grant room access only, not business actions. 10m with refresh is the tradeoff.
    const guestToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: guestName,
      ttl: '10m',
      metadata: JSON.stringify({ guest: true, invitedBy: userId }),
    });

    guestToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const guestJwt = await guestToken.toJwt();
    // Law #9: Never expose raw tokens in URLs — use short join codes
    const joinCode = createJoinCode(guestJwt, roomName, guestName, userId || 'external');
    const joinUrl = `${PUBLIC_BASE_URL}/join/${joinCode}`;
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Route through orchestrator → Eli → PolarisM for governed email delivery
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let orchestratorResponse: globalThis.Response;
      try {
        orchestratorResponse = await fetch(`${ORCHESTRATOR_URL}/v1/intents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            utterance: 'Send conference invite email',
            context: {
              to: email,
              guestName,
              joinUrl,
              hostName: hostName || 'Your host',
              purpose: purpose || 'Conference session',
            },
            suite_id: suiteId,
            office_id: null,
            source: 'conference_invite',
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!orchestratorResponse.ok) {
        logger.warn('Orchestrator invite failed, returning link fallback', {
          status: orchestratorResponse.status,
        });
        // Return the join link so the user can share it manually
        return res.json({
          sent: false,
          error: 'Email service temporarily unavailable. Share this link instead.',
          joinUrl,
          expiresIn: '10m',
        });
      }

      // Law #2: Receipt for YELLOW tier external communication
      // YELLOW tier: Fail-closed — receipt failure surfaces to caller (Law #3)
      try {
        await createTrustSpineReceipt({
          suiteId,
          receiptType: 'conference.invite_external',
          status: 'SUCCEEDED',
          actorType: 'USER',
          actorId: userId,
          ...(correlationId ? { correlationId } : {}),
          action: { guest_email: '<EMAIL_REDACTED>', guestName, roomName, purpose: purpose || 'Conference session' },
          result: { sent: true, tokenExpiresAt },
        });
      } catch (receiptErr) {
        // YELLOW tier fail-closed: receipt is mandatory. Log and surface error.
        logger.error('YELLOW receipt write failed for invite-external', {
          error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
          suiteId, userId, receiptType: 'conference.invite_external',
        });
        return res.status(500).json({
          sent: false,
          error: 'Audit trail unavailable. Invite cannot be completed without a receipt.',
        });
      }

      res.json({ sent: true, guestName, expiresAt: tokenExpiresAt });
    } catch (orchErr) {
      // Orchestrator unreachable — graceful fallback with the link
      logger.warn('Orchestrator unreachable for invite', {
        error: orchErr instanceof Error ? orchErr.message : 'unknown',
      });

      // Law #2: Receipt for fallback path (YELLOW tier: fail-closed)
      try {
        await createTrustSpineReceipt({
          suiteId,
          receiptType: 'conference.invite_external',
          status: 'FAILED',
          actorType: 'USER',
          actorId: userId,
          ...(correlationId ? { correlationId } : {}),
          action: { guest_email: '<EMAIL_REDACTED>', guestName, roomName },
          result: { sent: false, reason: 'orchestrator_unreachable', fallback: 'link_provided' },
        });
      } catch (receiptErr) {
        logger.error('YELLOW receipt write failed for invite-external fallback', {
          error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
          suiteId, userId, receiptType: 'conference.invite_external',
        });
        return res.status(500).json({
          sent: false,
          error: 'Audit trail unavailable. Invite cannot be completed without a receipt.',
        });
      }

      return res.json({
        sent: false,
        error: 'Email service temporarily unavailable. Share this link instead.',
        joinUrl,
        expiresIn: '10m',
      });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference invite-external error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Wave 2D: POST /api/conference/room-link ─────────────────────────────────
// Shareable room link — generate guest token with 10m TTL
// GREEN tier: no external side effects

router.post('/api/conference/room-link', async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    const suiteId = (req as any).authenticatedSuiteId;
    const userId = (req as any).authenticatedUserId;
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (!roomName || typeof roomName !== 'string' || roomName.length > 200) {
      return res.status(400).json({ error: 'roomName is required and must be 200 characters or fewer' });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'Conference service not configured' });
    }

    // 10m TTL — same rationale as external invite tokens (see comment above)
    const guestToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `guest-${Date.now()}`,
      ttl: '10m',
    });

    guestToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await guestToken.toJwt();
    // Law #9: Never expose raw tokens in URLs — use short join codes
    // Idempotency: same room + same user within TTL returns the same code
    const joinCode = createJoinCode(jwt, roomName, `guest-${Date.now()}`, userId || 'room-link');
    const link = `${PUBLIC_BASE_URL}/join/${joinCode}`;

    // Law #2: Receipt for guest token minting (capability grant audit trail)
    try {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'conference.room_link_generated',
        status: 'SUCCEEDED',
        actorType: 'USER',
        actorId: userId,
        ...(correlationId ? { correlationId } : {}),
        action: { roomName, tokenTtl: '10m' },
        result: { link_generated: true, expiresIn: '10m' },
      });
    } catch (receiptErr) {
      // GREEN tier: best-effort with structured log — don't block the operation
      logger.warn('GREEN receipt write failed for room_link_generated', {
        error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
        suiteId, userId, receiptType: 'conference.room_link_generated',
      });
    }

    res.json({ link, expiresIn: '10m' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference room-link error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
