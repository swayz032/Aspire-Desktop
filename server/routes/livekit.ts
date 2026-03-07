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
 * POST /api/conference/invite-internal     — Create FaceTime-style video call invitation
 * PATCH /api/conference/invite-internal/:id — Accept or decline a video call invitation
 *
 * All endpoints require JWT auth (not in PUBLIC_PATHS) except /join/:code.
 * Law #3: Fail Closed — no unauthenticated access to conference infrastructure.
 * Law #6: Tenant Isolation — member search is RLS-scoped by suite_id.
 * Law #9: Join codes replace raw JWTs in URLs — tokens never exposed in links.
 */
import { Router, Request, Response } from 'express';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '../logger';
import { createTrustSpineReceipt } from '../receiptService';

const router = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || process.env.LIVEKIT_SECRET || '';
const LIVEKIT_SERVER_URL = process.env.LIVEKIT_WS_URL || process.env.LIVEKIT_SERVER_URL || process.env.LIVEKIT_URL || 'wss://aspire-3rdm9zjn.livekit.cloud';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.aspireos.app';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function resolveOrchestratorUrl(): string | null {
  const configured = process.env.ORCHESTRATOR_URL?.trim();
  if (configured) return configured;
  if (IS_PRODUCTION) return null;
  return 'http://localhost:8000';
}

// RoomServiceClient for server-side room management (enterprise settings)
const roomService = (LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_SERVER_URL)
  ? new RoomServiceClient(
      LIVEKIT_SERVER_URL.replace('wss://', 'https://').replace('ws://', 'http://'),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    )
  : null;

/**
 * Ensure a LiveKit room exists with enterprise settings.
 * Idempotent — createRoom is a no-op if the room already exists.
 */
async function ensureRoom(roomName: string): Promise<void> {
  if (!roomService) return;
  try {
    await roomService.createRoom({
      name: roomName,
      emptyTimeout: 300,        // 5 min — auto-delete empty rooms
      maxParticipants: 50,      // Business conference limit
      departureTimeout: 20,     // 20s grace for reconnection
    });
  } catch (err) {
    // Non-fatal: room may already exist, or RoomService unavailable
    logger.warn('RoomServiceClient.createRoom non-fatal error', {
      error: err instanceof Error ? err.message : 'unknown',
      roomName,
    });
  }
}

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

    // Enterprise: ensure room exists with maxParticipants, timeouts
    await ensureRoom(roomName);

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
// Short codes (CR-XXXXXX) resolve server-side to LiveKit tokens.
// Persisted in Supabase — survives deploys. 60-minute TTL.

const JOIN_CODE_TTL_MS = 60 * 60 * 1000; // 60 minutes

function generateJoinCode(): string {
  // CR-XXXXXX: 6 uppercase alphanumeric chars → ~900M combinations
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid ambiguity
  let code = 'CR-';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

async function createJoinCode(token: string, roomName: string, guestName: string, createdBy: string): Promise<string> {
  if (!supabaseAdmin) {
    // Fallback: in-memory if Supabase unavailable (dev mode)
    logger.warn('Supabase unavailable for join codes — using ephemeral code');
    return generateJoinCode();
  }

  // Clean up expired codes on each write (simple maintenance)
  await supabaseAdmin
    .from('conference_join_codes')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .then(() => {});  // Best-effort cleanup

  const code = generateJoinCode();
  const expiresAt = new Date(Date.now() + JOIN_CODE_TTL_MS).toISOString();

  const { error } = await supabaseAdmin
    .from('conference_join_codes')
    .insert({
      code,
      token,
      room_name: roomName,
      guest_name: guestName,
      created_by: createdBy,
      server_url: LIVEKIT_SERVER_URL,
      expires_at: expiresAt,
    });

  if (error) {
    logger.error('Failed to persist join code', { error: error.message, code });
    throw new Error('Failed to create join code');
  }

  return code;
}

// ─── GET /api/conference/join/:code — Resolve join code (PUBLIC endpoint) ────
// This endpoint must be in PUBLIC_PATHS — guests use it without Aspire auth.
// The join code itself is the auth gate (short-lived, single-room scoped).
router.get('/api/conference/join/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Join code required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: entry, error: dbError } = await supabaseAdmin
      .from('conference_join_codes')
      .select('token, room_name, guest_name, server_url, expires_at')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (dbError) {
      logger.error('Join code DB error', { error: dbError.message });
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (!entry) {
      return res.status(404).json({ error: 'Invalid or expired join code' });
    }

    if (new Date(entry.expires_at) <= new Date()) {
      // Clean up expired code
      await supabaseAdmin.from('conference_join_codes').delete().eq('code', code.toUpperCase());
      return res.status(410).json({ error: 'This join link has expired. Please request a new link from the host.' });
    }

    // If guest provided their name via ?name= query param, mint a fresh token
    // with their chosen identity instead of using the stored pre-generated token.
    const requestedName = (req.query.name as string)?.trim().slice(0, 50);
    let token = entry.token;
    let guestName = entry.guest_name;

    if (requestedName && LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
      guestName = requestedName;
      const guestToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: requestedName,
        ttl: '60m',
        metadata: JSON.stringify({ guest: true }),
      });
      guestToken.addGrant({
        roomJoin: true,
        room: entry.room_name,
        canPublish: true,
        canSubscribe: true,
      });
      token = await guestToken.toJwt();
    }

    res.json({
      token,
      roomName: entry.room_name,
      guestName,
      serverUrl: entry.server_url || LIVEKIT_SERVER_URL,
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

    const rawSuiteId = (req.query.suiteId as string || '').trim();
    const rawOfficeId = (req.query.officeId as string || '').trim();

    if (!rawSuiteId || !rawOfficeId) {
      return res.status(400).json({ error: 'suiteId and officeId display IDs are required' });
    }

    // Normalize: strip prefixes if provided (accept "122", "STE-122", "STE122")
    // DB stores bare numbers ("128") and alphanumeric office IDs ("A01")
    const suiteDisplayId = rawSuiteId.replace(/^STE-?/i, '');
    const officeDisplayId = rawOfficeId.replace(/^OFF-?/i, '').toUpperCase();

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Query suite_profiles directly — display_id is bare number, office_display_id is like "A01"
    // Include user_id so cross-suite invites match the realtime filter (invitee_user_id=eq.auth_uid)
    const { data: members, error: memberError } = await supabaseAdmin
      .from('suite_profiles')
      .select('suite_id, user_id, name, owner_name, business_name, email, office_display_id')
      .eq('display_id', suiteDisplayId)
      .eq('office_display_id', officeDisplayId)
      .limit(10);

    if (memberError) {
      logger.error('Conference lookup query error', { error: memberError.message });
      return res.status(500).json({ error: 'Lookup failed' });
    }

    if (!members || members.length === 0) {
      return res.status(404).json({ error: 'No users found with that Suite ID and Office ID' });
    }

    const results = (members || []).map((row: any) => ({
      userId: row.user_id || row.suite_id,  // Prefer auth user_id for realtime matching, fallback to suite_id
      suiteId: row.suite_id,
      name: row.owner_name || row.name || 'Unknown',
      businessName: row.business_name || '',
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

    // Enterprise: ensure room exists before generating guest token
    await ensureRoom(roomName);

    // Generate guest LiveKit token: 60m TTL, room-scoped, publish+subscribe
    // NOTE: These are session-scoped LiveKit join tokens (NOT orchestrator capability tokens).
    // Law #5 <60s applies to orchestrator capability tokens. LiveKit tokens are infrastructure
    // auth — they grant room access only, not business actions. 60m TTL matches join code TTL.
    const guestToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: guestName,
      ttl: '60m',
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
    const joinCode = await createJoinCode(guestJwt, roomName, guestName, userId || 'external');
    const joinUrl = `${PUBLIC_BASE_URL}/join/${joinCode}`;
    const tokenExpiresAt = new Date(Date.now() + JOIN_CODE_TTL_MS).toISOString();

    // Route through orchestrator → Eli → PolarisM for governed email delivery
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      let orchestratorResponse: globalThis.Response;
      try {
        const orchestratorUrl = resolveOrchestratorUrl();
        if (!orchestratorUrl) {
          throw new Error('ORCHESTRATOR_NOT_CONFIGURED');
        }
        orchestratorResponse = await fetch(`${orchestratorUrl}/v1/intents`, {
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
          expiresIn: '60m',
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
        expiresIn: '60m',
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

    // Enterprise: ensure room exists before generating guest token
    await ensureRoom(roomName);

    // 60m TTL — matches join code persistence window
    const guestToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: `guest-${Date.now()}`,
      ttl: '60m',
    });

    guestToken.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await guestToken.toJwt();
    // Law #9: Never expose raw tokens in URLs — use short join codes
    // Persisted in Supabase — survives deploys
    const joinCode = await createJoinCode(jwt, roomName, `guest-${Date.now()}`, userId || 'room-link');
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
        action: { roomName, tokenTtl: '60m' },
        result: { link_generated: true, expiresIn: '60m' },
      });
    } catch (receiptErr) {
      // GREEN tier: best-effort with structured log — don't block the operation
      logger.warn('GREEN receipt write failed for room_link_generated', {
        error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
        suiteId, userId, receiptType: 'conference.room_link_generated',
      });
    }

    res.json({ link, expiresIn: '60m' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference room-link error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Wave 2E: POST /api/conference/invite-internal ────────────────────────────
// Internal FaceTime-style invitation — creates a realtime DB record that pushes
// to the invitee's connected client via Supabase Realtime.
// YELLOW tier: inter-user notification + conference session initiation
// Rate-limited: max 5 invitations per sender per minute to prevent spam/DoS

const inviteRateLimit = new Map<string, { count: number; resetAt: number }>();
const INVITE_RATE_LIMIT = 5;
const INVITE_RATE_WINDOW_MS = 60 * 1000; // 1 minute

// UUID v4 format validation
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post('/api/conference/invite-internal', async (req: Request, res: Response) => {
  try {
    const { invitee_suite_id, invitee_user_id, room_name } = req.body;
    const suiteId = (req as any).authenticatedSuiteId as string | undefined;
    const userId = (req as any).authenticatedUserId as string | undefined;
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (!invitee_suite_id || !invitee_user_id || !room_name) {
      return res.status(400).json({ error: 'invitee_suite_id, invitee_user_id, and room_name are required' });
    }

    // Input validation: UUID format + room_name length cap (matches /api/livekit/token pattern)
    if (typeof room_name !== 'string' || room_name.length > 200) {
      return res.status(400).json({ error: 'room_name must be 200 characters or fewer' });
    }
    if (!UUID_RE.test(invitee_suite_id)) {
      return res.status(400).json({ error: 'invitee_suite_id must be a valid UUID' });
    }
    if (!UUID_RE.test(invitee_user_id)) {
      return res.status(400).json({ error: 'invitee_user_id must be a valid UUID' });
    }

    if (!suiteId || !userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Rate limit: 5 invitations per sender per minute (prevent spam/DoS — THREAT-002)
    const now = Date.now();
    const senderLimit = inviteRateLimit.get(userId);
    if (senderLimit && now < senderLimit.resetAt) {
      if (senderLimit.count >= INVITE_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many invitations. Please wait before sending more.' });
      }
      senderLimit.count++;
    } else {
      inviteRateLimit.set(userId, { count: 1, resetAt: now + INVITE_RATE_WINDOW_MS });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Look up inviter's profile for display in the notification
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('suite_profiles')
      .select('display_id, office_display_id, owner_name, business_name, avatar_url')
      .eq('suite_id', suiteId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to load inviter profile', {
        error: profileError?.message || 'no profile found',
        suiteId,
      });
      return res.status(500).json({ error: 'Failed to load your profile' });
    }

    // Best-effort cleanup: expire stale pending invitations before inserting
    await supabaseAdmin
      .from('conference_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    // Insert the invitation — Supabase Realtime will push to invitee
    const { data: invitation, error: insertError } = await supabaseAdmin
      .from('conference_invitations')
      .insert({
        inviter_suite_id: suiteId,
        inviter_user_id: userId,
        inviter_name: profile.owner_name || 'Unknown',
        inviter_avatar_url: profile.avatar_url || null,
        inviter_suite_display_id: profile.display_id || '',
        inviter_office_display_id: profile.office_display_id || '',
        inviter_business_name: profile.business_name || null,
        invitee_suite_id,
        invitee_user_id,
        room_name,
        livekit_server_url: LIVEKIT_SERVER_URL,
      })
      .select('id')
      .single();

    if (insertError || !invitation) {
      logger.error('Failed to create conference invitation', {
        error: insertError?.message || 'no data returned',
        suiteId,
        invitee_user_id,
      });
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    // Law #2: YELLOW tier receipt — mandatory (fail-closed)
    try {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'conference.invite_internal',
        status: 'SUCCEEDED',
        actorType: 'USER',
        actorId: userId,
        ...(correlationId ? { correlationId } : {}),
        action: {
          invitee_suite_id,
          invitee_user_id,
          room_name,
          invitation_id: invitation.id,
        },
        result: { invitation_created: true },
      });
    } catch (receiptErr) {
      // YELLOW tier fail-closed: receipt is mandatory
      logger.error('YELLOW receipt write failed for invite-internal', {
        error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
        suiteId, userId, receiptType: 'conference.invite_internal',
      });
      return res.status(500).json({
        error: 'Audit trail unavailable. Invitation cannot be completed without a receipt.',
      });
    }

    res.json({ success: true, invitation_id: invitation.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference invite-internal error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Wave 2F: PATCH /api/conference/invite-internal/:id ───────────────────────
// Accept or decline a conference invitation.
// Accept: generates a LiveKit token for the invitee to join the room.
// YELLOW tier: state change + potential room join

router.patch('/api/conference/invite-internal/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    const userId = (req as any).authenticatedUserId as string | undefined;
    const suiteId = (req as any).authenticatedSuiteId as string | undefined;
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (!id) {
      return res.status(400).json({ error: 'Invitation ID required' });
    }

    if (!action || (action !== 'accept' && action !== 'decline')) {
      return res.status(400).json({ error: 'action must be "accept" or "decline"' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Fetch the invitation and verify ownership + status
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('conference_invitations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Law #6: Tenant isolation — only the invitee can respond
    if (invitation.invitee_user_id !== userId) {
      // Law #2: Receipt for denial (ownership mismatch is a security event)
      try {
        await createTrustSpineReceipt({
          suiteId: suiteId || 'unknown',
          receiptType: 'conference.invite_response_denied',
          status: 'DENIED',
          actorType: 'USER',
          actorId: userId,
          ...(correlationId ? { correlationId } : {}),
          action: { invitation_id: id, attempted_action: action },
          result: { reason: 'ownership_mismatch', denied: true },
        });
      } catch {
        // Best-effort denial receipt — don't block the 403 response
      }
      return res.status(403).json({ error: 'Not authorized to respond to this invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(409).json({ error: `Invitation already ${invitation.status}` });
    }

    // Check expiry
    if (new Date(invitation.expires_at) <= new Date()) {
      // Auto-expire the stale invitation
      await supabaseAdmin
        .from('conference_invitations')
        .update({ status: 'expired' })
        .eq('id', id);
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    // Update the invitation status
    // Defense-in-depth: .eq('invitee_user_id', userId) enforces ownership at DB layer
    // in addition to the application-level check above (THREAT-004)
    const { error: updateError } = await supabaseAdmin
      .from('conference_invitations')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('invitee_user_id', userId);

    if (updateError) {
      logger.error('Failed to update invitation', { error: updateError.message, id });
      return res.status(500).json({ error: 'Failed to update invitation' });
    }

    // Law #2: YELLOW tier receipt
    try {
      await createTrustSpineReceipt({
        suiteId: suiteId || invitation.invitee_suite_id,
        receiptType: `conference.invite_${newStatus}`,
        status: 'SUCCEEDED',
        actorType: 'USER',
        actorId: userId,
        ...(correlationId ? { correlationId } : {}),
        action: {
          invitation_id: id,
          room_name: invitation.room_name,
          response: newStatus,
        },
        result: { status_updated: true },
      });
    } catch (receiptErr) {
      logger.error(`YELLOW receipt write failed for invite_${newStatus}`, {
        error: receiptErr instanceof Error ? receiptErr.message : 'unknown',
        suiteId, userId, receiptType: `conference.invite_${newStatus}`,
      });
      return res.status(500).json({
        error: 'Audit trail unavailable. Response cannot be completed without a receipt.',
      });
    }

    if (action === 'decline') {
      return res.json({ success: true });
    }

    // Accept: generate LiveKit token for the invitee to join
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'Conference service not configured' });
    }

    await ensureRoom(invitation.room_name);

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userId,
      ttl: '10m',
      metadata: JSON.stringify({ suiteId: invitation.invitee_suite_id, invitationId: id }),
    });

    token.addGrant({
      roomJoin: true,
      room: invitation.room_name,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    res.json({
      token: jwt,
      serverUrl: LIVEKIT_SERVER_URL,
      roomName: invitation.room_name,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference invite-internal PATCH error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
