/**
 * Conference & Zoom Video SDK Routes
 *
 * POST /api/zoom/token              — Generate participant token (Zoom Video SDK JWT)
 * GET  /api/zoom/status             — Check if Zoom Video SDK is configured
 * GET  /api/conference/members      — Search suite members for internal invite
 * GET  /api/conference/lookup       — Cross-suite user lookup by office ID
 * POST /api/conference/invite-external — Send email invite to non-Aspire user
 * POST /api/conference/room-link    — Generate shareable room link with guest token
 * GET  /api/conference/join/:code   — Resolve join code to Zoom token (PUBLIC)
 * POST /api/conference/invite-internal     — Create FaceTime-style video call invitation
 * PATCH /api/conference/invite-internal/:id — Accept or decline a video call invitation
 *
 * All endpoints require JWT auth (not in PUBLIC_PATHS) except /join/:code.
 * Law #3: Fail Closed — no unauthenticated access to conference infrastructure.
 * Law #6: Tenant Isolation — member search is RLS-scoped by suite_id.
 * Law #9: Join codes replace raw JWTs in URLs — tokens never exposed in links.
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';
import { logger } from '../logger';
import { createTrustSpineReceipt } from '../receiptService';
import { db } from '../db';

const router = Router();

const ZOOM_SDK_KEY = process.env.ZOOM_SDK_KEY || '';
const ZOOM_SDK_SECRET = process.env.ZOOM_SDK_SECRET || '';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.aspireos.app';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Format an email local part into a readable name.
 * "tonioscott58@gmail.com" → "Tonio Scott"
 * "john.doe@company.com" → "John Doe"
 */
function formatEmailAsName(email: string | null | undefined): string {
  if (!email) return '';
  const local = email.split('@')[0] || '';
  // Split on dots, underscores, hyphens, or camelCase boundaries
  const parts = local
    .replace(/[._-]/g, ' ')
    .replace(/(\d+)$/g, '') // strip trailing numbers (tonioscott58 → tonioscott)
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel Case
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return parts.join(' ') || local;
}

function resolveOrchestratorUrl(): string | null {
  const configured = process.env.ORCHESTRATOR_URL?.trim();
  if (configured) return configured;
  if (IS_PRODUCTION) return null;
  return 'http://localhost:8000';
}

/**
 * Generate a Zoom Video SDK JWT for a given topic and participant.
 * Used by the guest join page (Video SDK sessions).
 * role_type: 1 = host, 0 = attendee
 */
function generateZoomJwt(
  topic: string,
  userIdentity: string,
  roleType: 0 | 1,
  expirationSeconds: number = 7200,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expirationSeconds;

  return jwt.sign(
    {
      app_key: ZOOM_SDK_KEY,
      tpc: topic,
      role_type: roleType,
      version: 1,
      iat,
      exp,
      user_identity: userIdentity,
    },
    ZOOM_SDK_SECRET,
  );
}

/**
 * Generate a Zoom Meeting SDK signature for embedded component view.
 * Used by the internal conference page (Meeting SDK embedded UI).
 * role: 0 = attendee, 1 = host
 */
function generateMeetingSdkSignature(
  meetingNumber: string,
  role: 0 | 1,
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 7200;

  return jwt.sign(
    {
      appKey: ZOOM_SDK_KEY,
      sdkKey: ZOOM_SDK_KEY,
      mn: meetingNumber,
      role,
      iat,
      exp,
      tokenExp: exp,
    },
    ZOOM_SDK_SECRET,
  );
}

// Supabase admin for member queries (service role bypasses RLS for controlled lookups)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

if (!supabaseAdmin) {
  logger.warn('[CRITICAL] supabaseAdmin NOT initialized. Conference invitations, member search, and join codes will fail. Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
}

// ─── POST /api/zoom/token ─────────────────────────────────────────────────────

router.post('/api/zoom/token', async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, suiteId } = req.body;

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: 'roomName and participantName are required' });
    }

    // Input length caps — prevent oversized values in Zoom session metadata
    if (typeof roomName !== 'string' || roomName.length > 200 ||
        typeof participantName !== 'string' || participantName.length > 100) {
      return res.status(400).json({ error: 'roomName and participantName must be reasonable length' });
    }

    if (!ZOOM_SDK_KEY || !ZOOM_SDK_SECRET) {
      return res
        .status(500)
        .json({ error: 'Conference service not configured' });
    }

    // Generate Meeting SDK signature for embedded component view.
    // The roomName is used as the meeting number identifier.
    // For production: create a real Zoom meeting via API and use its meeting number.
    const meetingNumber = roomName;
    const signature = generateMeetingSdkSignature(meetingNumber, 1);

    // Also generate a Video SDK JWT for fallback/guest usage
    const participantIdentity = `${(req as any).authenticatedUserId || participantName}-${suiteId || 'default'}`;
    const videoSdkToken = generateZoomJwt(roomName, participantIdentity, 1, 7200);

    res.json({
      signature,
      sdkKey: ZOOM_SDK_KEY,
      meetingNumber,
      token: videoSdkToken,
      topic: roomName,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Zoom token error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/zoom/status ─────────────────────────────────────────────────────

router.get('/api/zoom/status', async (_req: Request, res: Response) => {
  try {
    const configured = !!(ZOOM_SDK_KEY && ZOOM_SDK_SECRET);
    res.json({
      configured,
      status: configured ? 'CONFIGURED' : 'NOT_SET',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Zoom status error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
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
      return res.status(503).json({ error: 'Database not configured', detail: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    // Sanitize search input: strip PostgREST special chars to prevent filter injection
    // Commas stripped because PostgREST .or() uses comma as condition separator
    const q = rawQuery.replace(/[%_\\'"();,.]/g, '').slice(0, 50);

    // Query suite_profiles for members of the same suite
    // Note: suite_profiles has no user_id column — resolve via profiles table join by email
    let query = supabaseAdmin
      .from('suite_profiles')
      .select('suite_id, owner_name, name, email, office_display_id')
      .eq('suite_id', suiteId)
      .limit(10);

    if (q) {
      query = query.or(`owner_name.ilike.*${q}*,name.ilike.*${q}*,email.ilike.*${q}*`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Conference members query error', { error: error.message, suiteId });
      return res.status(500).json({ error: 'Failed to search members' });
    }

    // Resolve user_ids + full names from profiles table via email match
    const emails = (data || []).map((r: any) => r.email).filter(Boolean);
    let userIdMap: Record<string, string> = {};
    let profileNameMap: Record<string, string> = {};
    if (emails.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email, display_name')
        .in('email', emails);
      for (const p of profiles || []) {
        if (p.email) {
          userIdMap[p.email] = p.user_id;
          // Use display_name from profiles as name fallback
          const profileName = (p.display_name || '').trim();
          if (profileName) profileNameMap[p.email] = profileName;
        }
      }
    }

    const members = (data || [])
      .filter((row: any) => {
        // Exclude self by resolved user_id
        const resolvedId = row.email ? userIdMap[row.email] : null;
        return !userId || resolvedId !== userId;
      })
      // Exclude members without a resolved user_id (can't receive invitations)
      .filter((row: any) => row.email && userIdMap[row.email])
      .map((row: any) => ({
        userId: userIdMap[row.email],
        suiteId: row.suite_id,
        // Priority: suite owner_name → suite name → profile full_name → formatted email → Unknown
        name: row.owner_name || row.name || profileNameMap[row.email] || formatEmailAsName(row.email) || 'Unknown',
        email: row.email || '',
        officeId: row.office_display_id || '',
        officeLabel: row.office_display_id ? `Office ${row.office_display_id}` : '',
        avatarUrl: null,
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
// Short codes (CR-XXXXXX) resolve server-side to Zoom Video SDK tokens.
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
      server_url: 'zoom',
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
      return res.status(503).json({ error: 'Database not configured', detail: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
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

    // If guest provided their name via ?name= query param, mint a fresh Zoom JWT
    // with their chosen identity instead of using the stored pre-generated token.
    const requestedName = (req.query.name as string)?.trim().slice(0, 50);
    let token = entry.token;
    let guestName = entry.guest_name;

    if (requestedName && ZOOM_SDK_KEY && ZOOM_SDK_SECRET) {
      guestName = requestedName;
      // role_type 0 = attendee for guests
      token = generateZoomJwt(entry.room_name, requestedName, 0, 3600);
    }

    res.json({
      token,
      topic: entry.room_name,
      roomName: entry.room_name,
      guestName,
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
      return res.status(503).json({ error: 'Database not configured', detail: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    // Query suite_profiles — display_id is bare number, office_display_id is like "A01"
    // Note: suite_profiles has no user_id — resolve via profiles table join by email
    const { data: members, error: memberError } = await supabaseAdmin
      .from('suite_profiles')
      .select('suite_id, name, owner_name, business_name, email, office_display_id')
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

    // Resolve user_ids from profiles table via email match (needed for realtime invitations)
    const lookupEmails = members.map((r: any) => r.email).filter(Boolean);
    let lookupUserIdMap: Record<string, string> = {};
    if (lookupEmails.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .in('email', lookupEmails);
      for (const p of profiles || []) {
        if (p.email) lookupUserIdMap[p.email] = p.user_id;
      }
    }

    const results = members
      // Law #3: Only return users with a resolved auth user_id — suite_id fallback
      // would cause invite to target wrong entity and Realtime subscription miss
      .filter((row: any) => row.email && lookupUserIdMap[row.email])
      .map((row: any) => ({
        userId: lookupUserIdMap[row.email],
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

    // Room name validation: cap length (used in Zoom session topic)
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

    if (!ZOOM_SDK_KEY || !ZOOM_SDK_SECRET) {
      return res.status(503).json({
        sent: false,
        error: 'Conference service not configured. Copy the room link instead.',
      });
    }

    // Zoom Video SDK: sessions are topic-based, created on-demand — no server-side room creation needed.

    // Generate guest Zoom Video SDK JWT: 60m TTL, topic-scoped, attendee role
    // NOTE: These are session-scoped Zoom join tokens (NOT orchestrator capability tokens).
    // Law #5 <60s applies to orchestrator capability tokens. Zoom tokens are infrastructure
    // auth — they grant session access only, not business actions. 60m TTL matches join code TTL.
    const guestJwt = generateZoomJwt(roomName, guestName, 0, 3600);

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
// Shareable room link — generate guest Zoom Video SDK token
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

    if (!ZOOM_SDK_KEY || !ZOOM_SDK_SECRET) {
      return res.status(503).json({ error: 'Conference service not configured' });
    }

    // Zoom Video SDK: sessions are topic-based, created on-demand — no server-side room creation needed.

    // 60m TTL — matches join code persistence window
    const guestIdentity = `guest-${Date.now()}`;
    const guestJwt = generateZoomJwt(roomName, guestIdentity, 0, 3600);

    // Law #9: Never expose raw tokens in URLs — use short join codes
    // Persisted in Supabase — survives deploys
    const joinCode = await createJoinCode(guestJwt, roomName, guestIdentity, userId || 'room-link');
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
    // Prefer X-Suite-Id header (active suite selection) over JWT metadata suite_id
    const headerSuiteId = typeof req.headers['x-suite-id'] === 'string' ? req.headers['x-suite-id'].trim() : '';
    const suiteId = headerSuiteId || (req as any).authenticatedSuiteId as string | undefined;
    const userId = (req as any).authenticatedUserId as string | undefined;
    const correlationId = req.headers['x-correlation-id'] as string | undefined;

    if (!invitee_suite_id || !invitee_user_id || !room_name) {
      return res.status(400).json({ error: 'invitee_suite_id, invitee_user_id, and room_name are required' });
    }

    // Input validation: UUID format + room_name length cap (matches /api/zoom/token pattern)
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
      return res.status(503).json({ error: 'Database not configured', detail: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    }

    // Look up inviter's profile for display in the notification
    logger.info('Profile lookup for invite', { suiteId, headerSuiteId, authSuiteId: (req as any).authenticatedSuiteId });
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('suite_profiles')
      .select('display_id, office_display_id, owner_name, business_name, logo_url, owner_title')
      .eq('suite_id', suiteId)
      .single();

    logger.info('Profile lookup result', {
      found: !!profile,
      error: profileError?.message || null,
      suiteId,
      profileName: profile?.owner_name || null,
      profileDisplayId: profile?.display_id || null,
    });

    if (profileError || !profile) {
      logger.warn('Profile lookup failed via Supabase client', {
        error: profileError?.message || 'no profile found',
        suiteId,
        code: profileError?.code || null,
        hint: profileError?.hint || null,
      });
    }

    // Direct SQL fallback — bypasses any Supabase client/RLS issues
    let inviterProfile = profile;
    if (!inviterProfile) {
      try {
        const result = await db.execute(sql`
          SELECT display_id, office_display_id, owner_name, business_name, logo_url, owner_title
          FROM suite_profiles WHERE suite_id = ${suiteId} LIMIT 1
        `);
        const rows = (result.rows || result) as any[];
        if (rows.length > 0) {
          inviterProfile = rows[0];
          logger.info('Profile resolved via direct SQL fallback', { suiteId });
        }
      } catch (e) {
        logger.error('Direct SQL profile fallback also failed', { error: (e as Error).message, suiteId });
      }
    }

    // Final fallback — at least use auth context name
    if (!inviterProfile) {
      inviterProfile = {
        display_id: '',
        office_display_id: '',
        owner_name: (req as any).authenticatedUserName || 'Aspire User',
        business_name: null,
        logo_url: null,
        owner_title: null,
      };
    }

    // Best-effort cleanup: expire stale pending invitations before inserting
    await supabaseAdmin
      .from('conference_invitations')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    // Insert the invitation — Supabase Realtime will push to invitee
    // TTL: 5 minutes (override SQL default of 60s for production reliability)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: invitation, error: insertError } = await supabaseAdmin
      .from('conference_invitations')
      .insert({
        inviter_suite_id: suiteId,
        inviter_user_id: userId,
        inviter_name: inviterProfile.owner_name || 'Unknown',
        inviter_avatar_url: inviterProfile.logo_url || null,
        inviter_suite_display_id: inviterProfile.display_id || '',
        inviter_office_display_id: inviterProfile.office_display_id || '',
        inviter_business_name: inviterProfile.business_name || null,
        inviter_role: inviterProfile.owner_title || null,
        invitee_suite_id,
        invitee_user_id,
        room_name,
        zoom_session_id: room_name,
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single();

    if (insertError || !invitation) {
      logger.error('Failed to create conference invitation', {
        error: insertError?.message || 'no data returned',
        suiteId,
        invitee_user_id,
      });
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    logger.info('Conference invitation created', {
      invitationId: invitation.id,
      inviterSuiteId: suiteId,
      inviteeUserId: invitee_user_id,
      roomName: room_name,
      expiresAt,
    });

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
// Accept: generates a Zoom Video SDK JWT for the invitee to join the session.
// YELLOW tier: state change + potential session join

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
      return res.status(503).json({ error: 'Database not configured', detail: 'Server missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
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

    // Accept: generate Zoom Video SDK JWT for the invitee to join the session
    if (!ZOOM_SDK_KEY || !ZOOM_SDK_SECRET) {
      return res.status(503).json({ error: 'Conference service not configured' });
    }

    // Zoom Video SDK: sessions are topic-based, created on-demand — no server-side room creation needed.

    // Look up invitee's display name for Zoom session participant identity
    const { data: inviteeProfile } = await supabaseAdmin
      .from('suite_profiles')
      .select('owner_name')
      .eq('suite_id', invitation.invitee_suite_id)
      .single();

    const participantIdentity = `${userId}-${invitation.invitee_suite_id}`;
    const participantName = inviteeProfile?.owner_name || 'Participant';
    // role_type 1 = host for accepted internal invitees (full participant rights)
    const token = generateZoomJwt(invitation.room_name, participantIdentity, 1, 7200);

    res.json({
      token,
      topic: invitation.room_name,
      roomName: invitation.room_name,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Conference invite-internal PATCH error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
