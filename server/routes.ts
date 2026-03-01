import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId, getDefaultOfficeId } from './suiteContext';
import { logger } from './logger';

// Supabase admin client for bootstrap operations (user_metadata updates)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const router = Router();

type SupportedAgent =
  | 'ava'
  | 'finn'
  | 'eli'
  | 'nora'
  | 'sarah'
  | 'adam'
  | 'quinn'
  | 'tec'
  | 'teressa'
  | 'milo'
  | 'clara'
  | 'mail_ops';

type AnamSessionContext = {
  userId: string;
  suiteId: string;
  persona: SupportedAgent;
  createdAt: number;
};

const SUPPORTED_AGENTS = new Set<SupportedAgent>([
  'ava', 'finn', 'eli', 'nora', 'sarah', 'adam',
  'quinn', 'tec', 'teressa', 'milo', 'clara', 'mail_ops',
]);
const ENABLE_INTENT_SSE_PROXY = process.env.ENABLE_INTENT_SSE_PROXY !== 'false';
const STRICT_AGENT_VALIDATION = process.env.STRICT_AGENT_VALIDATION !== 'false';

function parseRequestedAgent(raw: unknown): { value: SupportedAgent; provided: boolean; valid: boolean } {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { value: 'ava', provided: false, valid: true };
  }
  const normalized = raw.trim().toLowerCase() as SupportedAgent;
  if (SUPPORTED_AGENTS.has(normalized)) {
    return { value: normalized, provided: true, valid: true };
  }
  return { value: 'ava', provided: true, valid: false };
}

function normalizeSessionKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^session[:_-]/i, '')
    .replace(/^sess[:_-]/i, '');
}

// ─── Anam Session Store (CUSTOMER_CLIENT_V1 Auth Bridge) ───
// When a user starts an Anam avatar session, we store their auth context.
// When Anam's brain routing calls /api/ava/chat-stream (without JWT), we look up
// the user's suite_id from this store. TTL: 30 minutes, cleanup every 5 minutes.
const anamSessionStore = new Map<string, AnamSessionContext>();

function setAnamSessionContext(sessionKey: string, ctx: AnamSessionContext): void {
  if (!sessionKey) return;
  anamSessionStore.set(sessionKey, ctx);
  const normalized = normalizeSessionKey(sessionKey);
  if (normalized && normalized !== sessionKey) {
    anamSessionStore.set(normalized, ctx);
  }
}

function getAnamSessionContext(sessionKey: unknown): AnamSessionContext | undefined {
  if (typeof sessionKey !== 'string' || !sessionKey.trim()) return undefined;
  return anamSessionStore.get(sessionKey) ?? anamSessionStore.get(normalizeSessionKey(sessionKey));
}

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, val] of anamSessionStore) {
    if (val.createdAt < cutoff) anamSessionStore.delete(key);
  }
}, 5 * 60 * 1000);

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

router.get('/api/stripe/publishable-key', async (req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    res.status(500).json({ error: msg });
  }
});

// ─── Input Sanitization (Law #9: strip XSS vectors) ───
function sanitizeText(text: string | undefined | null): string | null {
  if (!text || typeof text !== 'string') return null;
  return text.replace(/<[^>]*>/g, '').replace(/javascript:/gi, '').trim() || null;
}

function sanitizeArray(arr: any): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((s: any) => typeof s === 'string').map((s: string) => sanitizeText(s) || '').filter(Boolean);
}

// Validate enum field — returns value if valid, null otherwise
function validateEnum(value: any, allowed: string[]): string | null {
  if (typeof value !== 'string') return null;
  return allowed.includes(value) ? value : null;
}

// Canonical JSON: sort object keys recursively for deterministic HMAC signatures
// Must match n8n receiver sortKeys() — both sides produce identical canonical JSON
function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc: any, key: string) => {
      acc[key] = sortKeys(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

// ─── Invite Code Validation (Private Beta Gate) ───
// Rate-limited: 5 attempts per minute per IP to prevent brute force.
// This is a PUBLIC endpoint (no JWT required — user isn't authenticated yet).
const inviteCodeRateLimit = new Map<string, { count: number; resetAt: number }>();

router.post('/api/auth/validate-invite-code', (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate limit: 5 attempts per 60 seconds per IP
  const rl = inviteCodeRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 5) {
      return res.status(429).json({
        valid: false,
        error: 'Too many attempts. Please wait a minute and try again.',
      });
    }
    rl.count++;
  } else {
    inviteCodeRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Invite code is required.' });
  }

  const expectedCode = process.env.ASPIRE_INVITE_CODE;
  if (!expectedCode) {
    logger.error('ASPIRE_INVITE_CODE env var not set — invite validation will always fail');
    return res.status(500).json({ valid: false, error: 'Invite system not configured.' });
  }

  const valid = code.trim().toLowerCase() === expectedCode.trim().toLowerCase();
  if (!valid) {
    return res.status(403).json({ valid: false, error: 'Invalid invite code.' });
  }

  return res.json({ valid: true });
});

// Cleanup rate limit maps every 5 minutes
setInterval(() => {
  const cutoff = Date.now();
  for (const [key, val] of inviteCodeRateLimit) {
    if (cutoff >= val.resetAt) inviteCodeRateLimit.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Server-Side Signup (Private Beta) ───
// Creates user with email auto-confirmed (no email verification in beta).
// Validates invite code server-side before creating the account.
// PUBLIC endpoint — rate-limited via the invite code rate limiter above.
const signupRateLimit = new Map<string, { count: number; resetAt: number }>();

router.post('/api/auth/signup', async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Rate limit: 3 signups per minute per IP
  const rl = signupRateLimit.get(ip);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 3) {
      return res.status(429).json({ error: 'Too many signup attempts. Please wait a minute.' });
    }
    rl.count++;
  } else {
    signupRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
  }

  const { email, password, inviteCode } = req.body || {};

  if (!email || !password || !inviteCode) {
    return res.status(400).json({ error: 'Email, password, and invite code are required.' });
  }

  if (typeof email !== 'string' || typeof password !== 'string' || typeof inviteCode !== 'string') {
    return res.status(400).json({ error: 'Invalid input types.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  // Validate invite code
  const expectedCode = process.env.ASPIRE_INVITE_CODE;
  if (!expectedCode || inviteCode.trim().toLowerCase() !== expectedCode.trim().toLowerCase()) {
    return res.status(403).json({ error: 'Invalid invite code.' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Auth service unavailable.' });
  }

  try {
    // Create user with email auto-confirmed (beta — no email verification)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (error) {
      // Supabase returns specific error for duplicate email
      if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
        return res.status(409).json({ error: 'An account with this email already exists. Try signing in.' });
      }
      return res.status(400).json({ error: error.message });
    }

    logger.info('Beta signup: user created', { userId: data.user?.id, email: email.trim() });
    return res.json({ success: true, userId: data.user?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    logger.error('Signup error', { error: msg });
    return res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
});

/**
 * Emit a receipt to the Trust Spine receipts table.
 * Maps desktop-friendly params to the actual receipts schema:
 *   receipt_type (TEXT), status (SUCCEEDED/FAILED/DENIED), action (JSONB), result (JSONB),
 *   actor_type (USER/SYSTEM/WORKER)
 */
async function emitReceipt(params: {
  receiptId: string;
  receiptType: string;
  outcome: 'success' | 'failed' | 'denied';
  suiteId: string;
  tenantId: string;
  correlationId: string;
  actorType: 'user' | 'system' | 'worker';
  actorId: string;
  riskTier: string;
  actionData?: Record<string, any>;
  resultData?: Record<string, any>;
}): Promise<void> {
  const STATUS_MAP: Record<string, string> = { success: 'SUCCEEDED', failed: 'FAILED', denied: 'DENIED' };
  const ACTOR_MAP: Record<string, string> = { user: 'USER', system: 'SYSTEM', worker: 'WORKER' };

  await db.execute(sql`
    INSERT INTO receipts (receipt_id, receipt_type, status, action, result,
                          suite_id, tenant_id, correlation_id, actor_type, actor_id,
                          created_at)
    VALUES (${params.receiptId}, ${params.receiptType},
            ${STATUS_MAP[params.outcome] || 'FAILED'},
            ${JSON.stringify({ risk_tier: params.riskTier, ...params.actionData })}::jsonb,
            ${JSON.stringify({ outcome: params.outcome, ...params.resultData })}::jsonb,
            ${params.suiteId}, ${params.tenantId},
            ${params.correlationId},
            ${ACTOR_MAP[params.actorType] || 'SYSTEM'},
            ${params.actorId},
            NOW())
  `);
}

/**
 * Suite Bootstrap — creates suite infrastructure for new users
 * Called during onboarding when user has no suite_id in their metadata.
 * Uses service role to bypass RLS for initial setup.
 *
 * Risk Tier: YELLOW (creates tenant context, collects business intelligence)
 * Receipt: onboarding.intake_submission (PII redacted — Law #2 + #9)
 */
// In-memory rate limiter: 3 requests per 60s per user
const bootstrapRateLimit = new Map<string, { count: number; resetAt: number }>();
router.post('/api/onboarding/bootstrap', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-bootstrap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = (req as any).authenticatedUserId;
  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Must be authenticated' });
  }

  // Rate limit check — 3 bootstrap attempts per minute per user
  const now = Date.now();
  const rl = bootstrapRateLimit.get(userId);
  if (rl && now < rl.resetAt) {
    if (rl.count >= 3) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many onboarding attempts. Please wait and try again.' });
    }
    rl.count++;
  } else {
    bootstrapRateLimit.set(userId, { count: 1, resetAt: now + 60000 });
  }

  // Check if user already has a suite — but only skip if profile is ALSO complete.
  // Previous attempts may have created the suite but failed on the profile upsert,
  // leaving onboarding_completed_at unset and causing the auth gate to loop.
  const existingSuiteId = (req as any).authenticatedSuiteId;
  if (existingSuiteId && existingSuiteId !== getDefaultSuiteId()) {
    // Verify profile actually exists with all required onboarding fields complete
    const { data: existingProfile } = await supabaseAdmin!.from('suite_profiles')
      .select('onboarding_completed_at, owner_name, business_name, industry')
      .eq('suite_id', existingSuiteId)
      .single();
    if (
      existingProfile?.onboarding_completed_at &&
      existingProfile?.owner_name &&
      existingProfile?.business_name &&
      existingProfile?.industry
    ) {
      return res.json({ suiteId: existingSuiteId, created: false });
    }
    // Profile missing or incomplete — fall through to create/update it
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'BOOTSTRAP_UNAVAILABLE', message: 'Admin client not configured' });
  }

  try {
    // ── Extract & validate all fields ──
    const b = req.body;
    const businessName = sanitizeText(b.businessName);
    const ownerName = sanitizeText(b.ownerName);
    const ownerTitle = sanitizeText(b.ownerTitle);
    const industry = sanitizeText(b.industry);
    const teamSize = sanitizeText(b.teamSize);
    const entityType = validateEnum(b.entityType, ['sole_proprietorship', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other']);
    const yearsInBusiness = validateEnum(b.yearsInBusiness, ['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus']);
    const salesChannel = validateEnum(b.salesChannel, ['online', 'in_person', 'both', 'other']);
    const customerType = validateEnum(b.customerType, ['b2b', 'b2c', 'both']);
    const annualRevenueBand = validateEnum(b.annualRevenueBand, ['under_50k', '50k_100k', '100k_250k', '250k_500k', '500k_1m', '1m_plus']);
    const gender = validateEnum(b.gender, ['male', 'female', 'non-binary', 'prefer-not-to-say']);
    const roleCategory = sanitizeText(b.roleCategory);
    const preferredChannel = validateEnum(b.preferredChannel, ['cold', 'warm', 'hot']) || 'warm';
    const timezone = sanitizeText(b.timezone);
    const currency = (typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency)) ? b.currency : 'USD';
    const fiscalYearEndMonth = (typeof b.fiscalYearEndMonth === 'number' && b.fiscalYearEndMonth >= 1 && b.fiscalYearEndMonth <= 12) ? b.fiscalYearEndMonth : null;

    const servicesNeeded = sanitizeArray(b.servicesNeeded);
    const servicesPriority = sanitizeArray(b.servicesPriority);
    const currentTools = Array.isArray(b.currentTools) ? sanitizeArray(b.currentTools) : (typeof b.currentTools === 'string' ? b.currentTools.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    const toolsPlanning = sanitizeArray(b.toolsPlanning);
    const businessGoals = sanitizeArray(b.businessGoals);

    // V3 marketing fields (migration 064)
    const industrySpecialty = sanitizeText(b.industrySpecialty);
    const incomeRange = validateEnum(b.incomeRange, ['under_25k','25k_50k','50k_75k','75k_100k','100k_150k','150k_250k','250k_500k','500k_plus']);
    const referralSource = validateEnum(b.referralSource, ['google_search','social_media','friend_referral','podcast','blog_article','conference_event','advertisement','app_store','other']);
    const painPoint = sanitizeText(typeof b.painPoint === 'string' ? b.painPoint.slice(0, 1000) : b.painPoint);

    // Address fields
    const homeAddressLine1 = sanitizeText(b.homeAddressLine1);
    const homeAddressLine2 = sanitizeText(b.homeAddressLine2);
    const homeCity = sanitizeText(b.homeCity);
    const homeState = sanitizeText(b.homeState);
    const homeZip = sanitizeText(b.homeZip);
    const homeCountry = sanitizeText(b.homeCountry) || 'US';
    const businessAddressSameAsHome = b.businessAddressSameAsHome !== false;
    const businessAddressLine1 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine1);
    const businessAddressLine2 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine2);
    const businessCity = businessAddressSameAsHome ? null : sanitizeText(b.businessCity);
    const businessState = businessAddressSameAsHome ? null : sanitizeText(b.businessState);
    const businessZip = businessAddressSameAsHome ? null : sanitizeText(b.businessZip);
    const businessCountry = businessAddressSameAsHome ? null : (sanitizeText(b.businessCountry) || 'US');

    // Date of birth — validate format
    const dateOfBirth = (typeof b.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOfBirth)) ? b.dateOfBirth : null;

    // Consent — Law #9: personalization consent required for full intake
    const consentPersonalization = b.consentPersonalization === true;
    const consentCommunications = b.consentCommunications === true;

    // Minimum required fields
    if (!businessName) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Business name is required' });
    }

    // 1. Create suite via app.ensure_suite (handles duplicates gracefully)
    // Deterministic tenantId from userId — ensures idempotency (same user = same tenant)
    const tenantId = `tenant-${userId.replace(/-/g, '').slice(0, 16)}`;
    const suiteName = businessName;
    let suiteId: string;

    try {
      const result = await db.execute(sql`
        SELECT app.ensure_suite(${tenantId}, ${suiteName}) AS suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    } catch {
      // If app.ensure_suite doesn't exist, insert directly
      const result = await db.execute(sql`
        INSERT INTO app.suites (tenant_id, name)
        VALUES (${tenantId}, ${suiteName})
        RETURNING suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    }

    if (!suiteId) {
      return res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: 'Could not create suite' });
    }

    // 2. Get user email from Supabase admin
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return res.status(500).json({ error: 'USER_LOOKUP_FAILED', message: 'Could not find user' });
    }

    // 3. Generate receipt ID (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();

    // 4. Create suite_profile with ALL enterprise fields (service role bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from('suite_profiles')
      .upsert({
        suite_id: suiteId,
        email: user.email || '',
        name: ownerName || user.email?.split('@')[0] || 'Owner',
        business_name: businessName,
        owner_name: ownerName,
        owner_title: ownerTitle,
        industry,
        team_size: teamSize,
        entity_type: entityType,
        years_in_business: yearsInBusiness,
        sales_channel: salesChannel,
        customer_type: customerType,
        annual_revenue_band: annualRevenueBand,
        gender,
        role_category: roleCategory,
        date_of_birth: dateOfBirth,
        // Address
        home_address_line1: homeAddressLine1,
        home_address_line2: homeAddressLine2,
        home_city: homeCity,
        home_state: homeState,
        home_zip: homeZip,
        home_country: homeCountry,
        business_address_same_as_home: businessAddressSameAsHome,
        business_address_line1: businessAddressLine1,
        business_address_line2: businessAddressLine2,
        business_city: businessCity,
        business_state: businessState,
        business_zip: businessZip,
        business_country: businessCountry,
        // Services
        services_needed: servicesNeeded,
        services_priority: servicesPriority,
        current_tools: currentTools,
        tools_planning: toolsPlanning,
        business_goals: businessGoals,
        pain_point: painPoint,
        // Preferences
        preferred_channel: preferredChannel,
        timezone,
        currency,
        fiscal_year_end_month: fiscalYearEndMonth,
        // V3 marketing fields
        industry_specialty: industrySpecialty,
        income_range: incomeRange,
        referral_source: referralSource,
        // Consent
        consent_personalization: consentPersonalization,
        consent_communications: consentCommunications,
        intake_schema_version: 3,
        intake_receipt_id: receiptId,
        onboarding_completed_at: new Date().toISOString(),
      }, { onConflict: 'suite_id' });

    if (profileError) {
      logger.error('Profile creation error', { error: profileError?.message || profileError?.code || 'unknown' });
      // FATAL — without the profile row, onboarding_completed_at is never set,
      // causing the auth gate to loop the user back to onboarding indefinitely.
      return res.status(500).json({
        error: 'PROFILE_CREATION_FAILED',
        message: `Failed to create business profile: ${profileError.message || profileError.code || 'unknown error'}`,
        details: profileError.details || profileError.hint || null,
      });
    }

    // 5. Emit intake receipt (Law #2: Receipt for All — PII redacted per Law #9)
    try {
      await emitReceipt({
        receiptId, receiptType: 'onboarding.intake_submission', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
        actionData: { schema_version: 3, industry_specialty: industrySpecialty, income_range: incomeRange, referral_source: referralSource },
        resultData: {
          fields_completed: Object.entries({
            businessName, industry, teamSize, entityType, yearsInBusiness,
            industrySpecialty, incomeRange, referralSource, painPoint, salesChannel, customerType,
            homeAddressLine1, consentPersonalization,
          }).filter(([, v]) => v != null && v !== '' && (!Array.isArray(v) || v.length > 0)).length,
          industry: industry || '<NOT_PROVIDED>',
          team_size: teamSize || '<NOT_PROVIDED>',
          entity_type: entityType || '<NOT_PROVIDED>',
          consent_personalization: consentPersonalization,
          consent_communications: consentCommunications,
          date_of_birth: dateOfBirth ? '<DOB_REDACTED>' : null,
          gender: gender ? '<GENDER_REDACTED>' : null,
          home_address: homeAddressLine1 ? '<ADDRESS_REDACTED>' : null,
          business_address: businessAddressLine1 ? '<ADDRESS_REDACTED>' : null,
        },
      });
    } catch (receiptErr: unknown) {
      // YELLOW-tier receipt is mandatory — fail closed per Law #3
      logger.error('Receipt emission failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Intake receipt could not be recorded. Operation denied (Law #3: fail closed).' });
    }

    // 6. Update user_metadata with suite_id (so client gets it on session refresh)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { suite_id: suiteId },
    });

    if (updateError) {
      logger.error('User metadata update error', { error: updateError?.message || updateError?.code || 'unknown' });
      return res.status(500).json({ error: 'METADATA_UPDATE_FAILED', message: 'Suite created but metadata update failed' });
    }

    // 7. Fire-and-forget n8n webhook for intake activation (non-blocking)
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678';
    const webhookPayload = {
      suiteId,
      officeId: suiteId, // officeId defaults to suiteId for single-office tenants
      industry,
      industrySpecialty,
      incomeRange,
      referralSource,
      businessGoals,
      painPoint,
      customerType,
      salesChannel,
      teamSize,
      correlationId,
    };
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        const webhookBody = JSON.stringify(sortKeys(webhookPayload));
        // Use sha256= prefix for standard HMAC format
        const hmac = 'sha256=' + crypto.createHmac('sha256', webhookSecret)
          .update(webhookBody)
          .digest('hex');

        fetch(`${N8N_WEBHOOK_URL}/webhook/intake-activation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': hmac,
            'X-Suite-Id': suiteId,
            'X-Correlation-Id': correlationId,
          },
          body: webhookBody,
          signal: AbortSignal.timeout(5000),
        }).catch((err: unknown) => logger.warn('n8n intake webhook failed (non-blocking)', { error: err instanceof Error ? err.message : 'unknown' }));
      } catch (webhookErr: unknown) {
        logger.warn('n8n webhook setup failed (non-blocking)', { error: webhookErr instanceof Error ? webhookErr.message : 'unknown' });
      }
    } else {
      logger.warn('N8N_WEBHOOK_SECRET not set — skipping intake activation webhook (fail-closed)');
    }

    // Query display IDs for celebration screen (triggers populate them on INSERT)
    let suiteDisplayId: string | null = null;
    let officeDisplayId: string | null = null;
    try {
      const { data: profileData } = await supabaseAdmin.from('suite_profiles')
        .select('display_id, office_display_id, business_name')
        .eq('suite_id', suiteId)
        .single();
      suiteDisplayId = profileData?.display_id || null;
      officeDisplayId = profileData?.office_display_id || null;
    } catch (_) { /* best-effort — display IDs are cosmetic */ }

    res.json({ suiteId, created: true, receiptId, suiteDisplayId, officeDisplayId, businessName });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Bootstrap error', { correlationId, error: errorMsg });
    // Emit failure receipt — Law #2: failures also produce receipts
    try {
      const failReceiptId = crypto.randomUUID();
      const sanitizedMsg = sanitizeText(String(errorMsg)) || 'unknown_error';
      // Bootstrap failure — no suite exists yet, so receipt goes to system log only
      logger.error('Bootstrap failed', { correlationId, error: sanitizedMsg });
    } catch (failReceiptErr: unknown) {
      logger.error('Failure receipt also failed', { correlationId, error: failReceiptErr instanceof Error ? failReceiptErr.message : 'unknown' });
    }
    res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: 'Onboarding could not be completed. Please try again.' });
  }
});

/**
 * Onboarding Status — server-side check using supabaseAdmin (bypasses RLS).
 * The client-side Supabase query may be blocked by RLS if no read policy exists
 * on suite_profiles. This endpoint guarantees a reliable answer.
 */
router.get('/api/onboarding/status', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId || suiteId === getDefaultSuiteId()) {
    return res.json({ complete: false, reason: 'no_suite' });
  }
  if (!supabaseAdmin) {
    return res.json({ complete: false, reason: 'admin_unavailable' });
  }
  const { data } = await supabaseAdmin
    .from('suite_profiles')
    .select('onboarding_completed_at, owner_name, business_name, industry')
    .eq('suite_id', suiteId)
    .single();
  const complete = !!(
    data?.onboarding_completed_at &&
    data?.owner_name &&
    data?.business_name &&
    data?.industry
  );
  return res.json({ complete });
});

/**
 * Profile Update — updates existing suite_profiles for returning users
 * Called when a user with an existing suite completes/updates their profile.
 * Uses authenticated suite context with server-side sanitization + receipt.
 *
 * Risk Tier: YELLOW (updates tenant profile, collects business intelligence)
 * Receipt: onboarding.profile_update (PII redacted — Law #2 + #9)
 */
router.patch('/api/onboarding/profile', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-profile-${crypto.randomUUID()}`;
  const userId = (req as any).authenticatedUserId;
  const suiteId = (req as any).authenticatedSuiteId;

  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Must be authenticated' });
  }
  if (!suiteId || suiteId === getDefaultSuiteId()) {
    return res.status(400).json({ error: 'NO_SUITE', message: 'No suite found. Use /api/onboarding/bootstrap instead.' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SERVICE_UNAVAILABLE', message: 'Admin client not configured' });
  }

  try {
    const b = req.body;

    // ── Server-side sanitization (identical to bootstrap — DRY principle) ──
    const businessName = sanitizeText(b.businessName);
    const ownerName = sanitizeText(b.ownerName);
    const ownerTitle = sanitizeText(b.ownerTitle);
    const industry = sanitizeText(b.industry);
    const teamSize = sanitizeText(b.teamSize);
    const entityType = validateEnum(b.entityType, ['sole_proprietorship', 'llc', 's_corp', 'c_corp', 'partnership', 'nonprofit', 'other']);
    const yearsInBusiness = validateEnum(b.yearsInBusiness, ['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus']);
    const salesChannel = validateEnum(b.salesChannel, ['online', 'in_person', 'both', 'other']);
    const customerType = validateEnum(b.customerType, ['b2b', 'b2c', 'both']);
    const servicesNeeded = sanitizeArray(b.servicesNeeded);
    const currentTools = Array.isArray(b.currentTools)
      ? sanitizeArray(b.currentTools)
      : (typeof b.currentTools === 'string' ? b.currentTools.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    const painPoint = sanitizeText(typeof b.painPoint === 'string' ? b.painPoint.slice(0, 1000) : b.painPoint);
    const timezone = sanitizeText(b.timezone);
    const currency = (typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency)) ? b.currency : 'USD';
    const annualRevenueBand = validateEnum(b.annualRevenueBand, ['under_50k', '50k_100k', '100k_250k', '250k_500k', '500k_1m', '1m_plus']);
    const gender = validateEnum(b.gender, ['male', 'female', 'non-binary', 'prefer-not-to-say']);
    const dateOfBirth = (typeof b.dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.dateOfBirth)) ? b.dateOfBirth : null;
    const roleCategory = sanitizeText(b.roleCategory);
    const preferredChannel = validateEnum(b.preferredChannel, ['cold', 'warm', 'hot']);
    const fiscalYearEndMonth = (typeof b.fiscalYearEndMonth === 'number' && b.fiscalYearEndMonth >= 1 && b.fiscalYearEndMonth <= 12)
      ? Math.floor(b.fiscalYearEndMonth) : null;
    const consentPersonalization = b.consentPersonalization === true;
    const consentCommunications = b.consentCommunications === true;

    // V3 marketing fields (migration 064)
    const industrySpecialty = sanitizeText(b.industrySpecialty);
    const incomeRange = validateEnum(b.incomeRange, ['under_25k','25k_50k','50k_75k','75k_100k','100k_150k','150k_250k','250k_500k','500k_plus']);
    const referralSource = validateEnum(b.referralSource, ['google_search','social_media','friend_referral','podcast','blog_article','conference_event','advertisement','app_store','other']);

    // Address fields
    const homeAddressLine1 = sanitizeText(b.homeAddressLine1);
    const homeAddressLine2 = sanitizeText(b.homeAddressLine2);
    const homeCity = sanitizeText(b.homeCity);
    const homeState = sanitizeText(b.homeState);
    const homeZip = sanitizeText(b.homeZip);
    const homeCountry = sanitizeText(b.homeCountry) || 'US';
    const businessAddressSameAsHome = b.businessAddressSameAsHome !== false;
    const businessAddressLine1 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine1);
    const businessAddressLine2 = businessAddressSameAsHome ? null : sanitizeText(b.businessAddressLine2);
    const businessCity = businessAddressSameAsHome ? null : sanitizeText(b.businessCity);
    const businessState = businessAddressSameAsHome ? null : sanitizeText(b.businessState);
    const businessZip = businessAddressSameAsHome ? null : sanitizeText(b.businessZip);
    const businessCountry = businessAddressSameAsHome ? null : (sanitizeText(b.businessCountry) || 'US');

    // Build update object (only non-undefined fields)
    const updatePayload: Record<string, any> = {
      business_name: businessName,
      owner_name: ownerName,
      owner_title: ownerTitle,
      industry,
      team_size: teamSize,
      entity_type: entityType,
      years_in_business: yearsInBusiness,
      sales_channel: salesChannel,
      customer_type: customerType,
      services_needed: servicesNeeded,
      current_tools: currentTools,
      pain_point: painPoint,
      home_address_line1: homeAddressLine1,
      home_address_line2: homeAddressLine2,
      home_city: homeCity,
      home_state: homeState,
      home_zip: homeZip,
      home_country: homeCountry,
      business_address_same_as_home: businessAddressSameAsHome,
      business_address_line1: businessAddressLine1,
      business_address_line2: businessAddressLine2,
      business_city: businessCity,
      business_state: businessState,
      business_zip: businessZip,
      business_country: businessCountry,
      timezone,
      currency,
      annual_revenue_band: annualRevenueBand,
      gender,
      date_of_birth: dateOfBirth,
      role_category: roleCategory,
      preferred_channel: preferredChannel,
      fiscal_year_end_month: fiscalYearEndMonth,
      // V3 marketing fields
      industry_specialty: industrySpecialty,
      income_range: incomeRange,
      referral_source: referralSource,
      consent_personalization: consentPersonalization,
      consent_communications: consentCommunications,
      intake_schema_version: 3,
      onboarding_completed_at: new Date().toISOString(),
    };

    // Upsert via service role — handles both existing and missing profile rows.
    // A missing row can happen if bootstrap created the suite but the profile upsert
    // failed on a previous attempt. Using upsert ensures the profile is created.
    const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authUser?.email || '';
    const { error: updateError } = await supabaseAdmin
      .from('suite_profiles')
      .upsert({ suite_id: suiteId, email: userEmail, name: updatePayload.owner_name || 'Owner', ...updatePayload }, { onConflict: 'suite_id' });

    if (updateError) {
      logger.error('Profile update error', { error: updateError?.message || updateError?.code || 'unknown' });
      // Emit failure receipt — Law #2
      try {
        await emitReceipt({
          receiptId: crypto.randomUUID(), receiptType: 'onboarding.profile_update', outcome: 'failed',
          suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
          resultData: { reason: 'supabase_update_error', error_code: updateError.code || 'UNKNOWN' },
        });
      } catch (_receiptErr) { /* best-effort — primary error takes precedence */ }
      return res.status(500).json({ error: 'UPDATE_FAILED', message: 'Failed to update profile' });
    }

    // Emit YELLOW receipt — Law #2 (fail-closed per Law #3)
    const receiptId = crypto.randomUUID();
    const updatedFields = Object.keys(updatePayload).filter(k => updatePayload[k] != null);
    try {
      await emitReceipt({
        receiptId, receiptType: 'onboarding.profile_update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId, actorType: 'user', actorId: userId, riskTier: 'yellow',
        resultData: {
          fields_updated: updatedFields, field_count: updatedFields.length,
          ...(dateOfBirth ? { date_of_birth: '<DOB_REDACTED>' } : {}),
          ...(gender ? { gender: '<GENDER_REDACTED>' } : {}),
          ...(homeAddressLine1 ? { home_address: '<ADDRESS_REDACTED>' } : {}),
          ...(businessAddressLine1 ? { business_address: '<ADDRESS_REDACTED>' } : {}),
        },
      });
    } catch (receiptErr: unknown) {
      // YELLOW-tier receipt is mandatory — fail closed per Law #3
      logger.error('Profile update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Profile update receipt could not be recorded (Law #3: fail closed).' });
    }

    res.json({ suiteId, updated: true, receiptId });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Profile update error', { correlationId, error: errorMsg });
    // Emit failure receipt — Law #2 (outer catch — best-effort)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'onboarding.profile_update', outcome: 'failed',
        suiteId: suiteId || '00000000-0000-0000-0000-000000000000', tenantId: suiteId || 'unknown',
        correlationId, actorType: 'user', actorId: userId || 'unknown', riskTier: 'yellow',
        resultData: { reason: 'unexpected_error', error_message: errorMsg },
      });
    } catch (_receiptErr) { /* best-effort */ }
    res.status(500).json({ error: 'UPDATE_FAILED', message: 'Profile update could not be completed. Please try again.' });
  }
});

router.get('/api/suites/:suiteId', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfile(getParam(req.params.suiteId));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

// Backward-compatible alias: /api/users/:userId -> suite profile lookup
router.get('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfile(getParam(req.params.userId));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/slug/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/users', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-create-profile-${crypto.randomUUID()}`;
  const suiteId = (req as any).authenticatedSuiteId || req.body?.suiteId || 'unknown';
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const profile = await storage.createSuiteProfile(req.body);

    // Law #2: Receipt for profile creation (YELLOW — state change)
    const receiptId = crypto.randomUUID();
    try {
      await emitReceipt({
        receiptId, receiptType: 'profile.create', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'create_suite_profile' },
        resultData: { profile_id: profile?.suiteId },
      });
    } catch (receiptErr: unknown) {
      logger.error('Profile create receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed — receipt required.' });
    }

    res.status(201).json(profile);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    // Law #2: Receipt for failure
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'profile.create', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'create_suite_profile' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort failure receipt */ }
    res.status(500).json({ error: errorMsg });
  }
});

// DEPRECATED: Use PATCH /api/onboarding/profile instead (has full sanitization + receipt + auth).
// This legacy endpoint is auth-gated to prevent unauthenticated profile writes.
router.patch('/api/users/:userId', async (req: Request, res: Response) => {
  // Auth enforcement — Law #3: fail closed
  const authedUserId = (req as any).authenticatedUserId;
  const authedSuiteId = (req as any).authenticatedSuiteId;
  if (!authedUserId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required. Use PATCH /api/onboarding/profile for profile updates.' });
  }

  const userId = getParam(req.params.userId);
  // Prevent cross-tenant writes: authed user can only update their own suite
  if (userId !== authedSuiteId) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot update another tenant\'s profile.' });
  }

  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-profile-update-${crypto.randomUUID()}`;
  try {
    // Sanitize all string fields before passing to storage
    const sanitizedBody: Record<string, any> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        sanitizedBody[key] = sanitizeText(value);
      } else if (Array.isArray(value)) {
        sanitizedBody[key] = sanitizeArray(value);
      } else {
        sanitizedBody[key] = value;
      }
    }

    const profile = await storage.updateSuiteProfile(userId, sanitizedBody);
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });

    // Emit YELLOW receipt for profile update — Law #2
    const receiptId = crypto.randomUUID();
    const updatedFields = Object.keys(sanitizedBody).filter(k => sanitizedBody[k] !== undefined);
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, risk_tier, created_at, payload)
        VALUES (${receiptId}, 'onboarding.profile_update', 'success', ${userId}, ${userId},
                ${correlationId}, 'user', ${authedUserId}, 'yellow', NOW(),
                ${JSON.stringify({ fields_updated: updatedFields, field_count: updatedFields.length, via: 'legacy_endpoint' })}::jsonb)
      `);
    } catch (receiptErr: unknown) {
      logger.error('Profile update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Profile update receipt could not be recorded (Law #3: fail closed).' });
    }

    res.json(profile);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/services', async (req: Request, res: Response) => {
  try {
    const services = await storage.getServices(getParam(req.params.userId));
    res.json(services);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/services/active', async (req: Request, res: Response) => {
  try {
    const services = await storage.getActiveServices(getParam(req.params.userId));
    res.json(services);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/users/:userId/services', async (req: Request, res: Response) => {
  const suiteId = getParam(req.params.userId);
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-create-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const stripe = await getUncachableStripeClient();

    const product = await stripe.products.create({
      name: req.body.name,
      description: req.body.description || '',
      metadata: { suiteId },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: req.body.price,
      currency: req.body.currency || 'usd',
    });

    const service = await storage.createService({
      ...req.body,
      suiteId,
      stripeProductId: product.id,
      stripePriceId: price.id,
    });

    // Law #2: Receipt for service creation (RED — Stripe financial operation)
    const receiptId = crypto.randomUUID();
    try {
      await emitReceipt({
        receiptId, receiptType: 'service.create', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'create_service', stripe_product_id: product.id, service_name: req.body.name?.substring(0, 50) },
        resultData: { service_id: service?.id, stripe_price_id: price.id },
      });
    } catch (receiptErr: unknown) {
      logger.error('Service create receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed — receipt required for Stripe operations.' });
    }

    res.status(201).json(service);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.create', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'create_service' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort failure receipt */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.patch('/api/services/:serviceId', async (req: Request, res: Response) => {
  const serviceId = getParam(req.params.serviceId);
  const suiteId = (req as any).authenticatedSuiteId || 'unknown';
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-update-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const service = await storage.updateService(serviceId, req.body);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Law #2: Receipt for service update (YELLOW — state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'update_service', service_id: serviceId, fields_updated: Object.keys(req.body) },
        resultData: { service_id: serviceId },
      });
    } catch (receiptErr: unknown) {
      logger.error('Service update receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(service);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'update_service', service_id: serviceId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.delete('/api/services/:serviceId', async (req: Request, res: Response) => {
  const serviceId = getParam(req.params.serviceId);
  const suiteId = (req as any).authenticatedSuiteId || 'unknown';
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-delete-service-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    await storage.deleteService(serviceId);

    // Law #2: Receipt for service deletion (RED — irreversible state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.delete', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'delete_service', service_id: serviceId },
        resultData: { deleted: true },
      });
    } catch (receiptErr: unknown) {
      logger.warn('Service delete receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      // Note: deletion already happened — emit warning but don't fail the response
    }

    res.status(204).send();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'service.delete', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'red',
        actionData: { operation: 'delete_service', service_id: serviceId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/availability', async (req: Request, res: Response) => {
  try {
    const availability = await storage.getAvailability(getParam(req.params.userId));
    res.json(availability);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.put('/api/users/:userId/availability', async (req: Request, res: Response) => {
  const suiteId = getParam(req.params.userId);
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-set-availability-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const slots = req.body.slots.map((slot: any) => ({
      ...slot,
      suiteId,
    }));
    const availability = await storage.setAvailability(suiteId, slots);

    // Law #2: Receipt for availability update (YELLOW — scheduling state change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'availability.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'set_availability', slot_count: slots.length },
        resultData: { updated_count: availability?.length },
      });
    } catch (receiptErr: unknown) {
      logger.error('Availability receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(availability);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'availability.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'set_availability' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  try {
    const settings = await storage.getBufferSettings(getParam(req.params.userId));
    res.json(settings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.put('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  const suiteId = getParam(req.params.userId);
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-buffer-settings-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const settings = await storage.upsertBufferSettings(suiteId, req.body);

    // Law #2: Receipt for buffer settings update (YELLOW — scheduling config change)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'buffer_settings.update', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'upsert_buffer_settings', fields: Object.keys(req.body) },
        resultData: { updated: true },
      });
    } catch (receiptErr: unknown) {
      logger.error('Buffer settings receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      return res.status(500).json({ error: 'RECEIPT_EMISSION_FAILED', message: 'Law #3: fail closed.' });
    }

    res.json(settings);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'buffer_settings.update', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'upsert_buffer_settings' },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/users/:userId/bookings', async (req: Request, res: Response) => {
  try {
    const bookings = await storage.getBookings(getParam(req.params.userId));
    res.json(bookings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/bookings/upcoming', async (req: Request, res: Response) => {
  try {
    const bookings = await storage.getUpcomingBookings(getParam(req.params.userId));
    res.json(bookings);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/users/:userId/bookings/stats', async (req: Request, res: Response) => {
  try {
    const stats = await storage.getBookingStats(getParam(req.params.userId));
    res.json(stats);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/bookings/:bookingId', async (req: Request, res: Response) => {
  try {
    const booking = await storage.getBooking(getParam(req.params.bookingId));
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  const bookingId = getParam(req.params.bookingId);
  const suiteId = (req as any).authenticatedSuiteId || 'unknown';
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cancel-booking-${crypto.randomUUID()}`;
  const actorId = (req as any).authenticatedUserId || 'unknown';
  try {
    const booking = await storage.cancelBooking(bookingId, req.body.reason);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Law #2: Receipt for booking cancellation (YELLOW — schedule state change, may trigger refund)
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'booking.cancel', outcome: 'success',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'cancel_booking', booking_id: bookingId, reason: req.body.reason?.substring(0, 100) },
        resultData: { cancelled: true, booking_id: bookingId },
      });
    } catch (receiptErr: unknown) {
      logger.warn('Booking cancel receipt failed', { correlationId, error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
      // Cancellation already happened — log but don't fail response
    }

    res.json(booking);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    try {
      await emitReceipt({
        receiptId: crypto.randomUUID(), receiptType: 'booking.cancel', outcome: 'failed',
        suiteId, tenantId: suiteId, correlationId,
        actorType: 'user', actorId, riskTier: 'yellow',
        actionData: { operation: 'cancel_booking', booking_id: bookingId },
        resultData: { error: errorMsg.substring(0, 200) },
      });
    } catch (_) { /* best-effort */ }
    res.status(500).json({ error: errorMsg });
  }
});

router.get('/api/book/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const services = await storage.getActiveServices(profile.suiteId);
    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);

    res.json({
      user: { id: profile.suiteId, name: profile.name, businessName: profile.businessName, logoUrl: profile.logoUrl, accentColor: profile.accentColor },
      services,
      availability,
      bufferSettings: bufferSettings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.get('/api/book/:slug/slots', async (req: Request, res: Response) => {
  try {
    const { serviceId, date } = req.query;
    if (!serviceId || !date) {
      return res.status(400).json({ error: 'serviceId and date are required' });
    }

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId as string);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);
    const existingBookings = await storage.getBookingsByDate(profile.suiteId, new Date(date as string));

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek && a.isActive);

    const slots: string[] = [];
    const buffer = bufferSettings?.afterBuffer || 15;

    for (const avail of dayAvailability) {
      const [startHour, startMin] = avail.startTime.split(':').map(Number);
      const [endHour, endMin] = avail.endTime.split(':').map(Number);

      let currentTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      while (currentTime + service.duration <= endTime) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + service.duration);

        const isAvailable = !existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledAt);
          const bookingEnd = new Date(bookingStart);
          bookingEnd.setMinutes(bookingEnd.getMinutes() + booking.duration);
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (isAvailable) {
          const hours = Math.floor(currentTime / 60).toString().padStart(2, '0');
          const mins = (currentTime % 60).toString().padStart(2, '0');
          slots.push(`${hours}:${mins}`);
        }

        currentTime += 30;
      }
    }

    res.json({ slots });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/book/:slug/checkout', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-checkout-${crypto.randomUUID()}`;
  try {
    const { serviceId, scheduledAt, clientName, clientEmail, clientPhone, clientNotes } = req.body;

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const booking = await storage.createBooking({
      suiteId: profile.suiteId,
      serviceId,
      clientName,
      clientEmail,
      clientPhone,
      clientNotes,
      scheduledAt: new Date(scheduledAt),
      duration: service.duration,
      amount: service.price,
      currency: service.currency,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    if (service.price > 0 && service.stripePriceId) {
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: service.stripePriceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/book/${getParam(req.params.slug)}/success?bookingId=${booking.id}`,
        cancel_url: `${baseUrl}/book/${getParam(req.params.slug)}/cancel?bookingId=${booking.id}`,
        metadata: { bookingId: booking.id },
        customer_email: clientEmail,
      });

      await storage.updateBooking(booking.id, { stripeCheckoutSessionId: session.id });

      // Law #2: Receipt for booking checkout (RED — financial operation via Stripe)
      await createTrustSpineReceipt({
        suiteId: profile.suiteId,
        receiptType: 'booking.checkout',
        status: 'SUCCEEDED',
        correlationId,
        actorType: 'SYSTEM',
        action: { operation: 'booking_checkout', service_id: serviceId, amount: service.price, currency: service.currency, risk_tier: 'RED' },
        result: { booking_id: booking.id, stripe_session_id: session.id, client_email: '<EMAIL_REDACTED>' },
      }).catch(() => {});

      res.json({ checkoutUrl: session.url, bookingId: booking.id });
    } else {
      await storage.updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'free' });

      // Law #2: Receipt for free booking (YELLOW — state change, no payment)
      await createTrustSpineReceipt({
        suiteId: profile.suiteId,
        receiptType: 'booking.checkout',
        status: 'SUCCEEDED',
        correlationId,
        actorType: 'SYSTEM',
        action: { operation: 'booking_checkout_free', service_id: serviceId, risk_tier: 'YELLOW' },
        result: { booking_id: booking.id, confirmed: true },
      }).catch(() => {});

      res.json({ bookingId: booking.id, confirmed: true });
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    res.status(500).json({ error: errorMsg });
  }
});

router.post('/api/book/:slug/confirm/:bookingId', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-confirm-${crypto.randomUUID()}`;
  try {
    const bookingId = getParam(req.params.bookingId);
    const booking = await storage.updateBooking(bookingId, {
      status: 'confirmed',
      paymentStatus: 'paid',
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Law #2: Receipt for booking confirmation (YELLOW — state change, payment confirmed)
    const suiteId = (booking as any).suiteId || 'unknown';
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'booking.confirm',
      status: 'SUCCEEDED',
      correlationId,
      actorType: 'SYSTEM',
      action: { operation: 'confirm_booking', booking_id: bookingId, risk_tier: 'YELLOW' },
      result: { booking_id: bookingId, confirmed: true, payment_status: 'paid' },
    }).catch(() => {});

    res.json(booking);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

// @deprecated — frontdesk setup/preview-audio endpoints moved to telephonyEnterpriseRoutes.ts

/**
 * ElevenLabs TTS — Text-to-Speech Only (Law #1: Single Brain)
 *
 * ElevenLabs is the mouth. NOT the brain.
 * Intelligence comes from the LangGraph orchestrator via OpenAI SDK skill packs.
 * This route converts orchestrator response text → audio via ElevenLabs TTS API.
 */
const VOICE_IDS: Record<string, string> = {
  ava: 'uYXf8XasLslADfZ2MB4u',
  eli: 'c6kFzbpMaJ8UMD5P6l72',
  finn: 's3TPKV1kjDlVtZbl4Ksh',
  nora: '6aDn1KB0hjpdcocrUkmq',
  sarah: 'DODLEQrClDo8wCz460ld',
};

/**
 * Parse ElevenLabs API error responses into actionable client messages.
 * ElevenLabs returns: { detail: { type, code, message, request_id } }
 */
function parseElevenLabsError(body: string, httpStatus: number): { code: string; clientMessage: string; httpStatus: number } {
  try {
    const parsed = JSON.parse(body);
    const detail = parsed?.detail;
    if (detail && typeof detail === 'object') {
      const code = detail.code || detail.type || 'unknown';
      const map: Record<string, string> = {
        rate_limit_exceeded: 'Voice service is busy — try again in a moment.',
        concurrent_limit_exceeded: 'Too many voice requests — please wait.',
        insufficient_credits: 'Voice credits exhausted. Check your ElevenLabs plan.',
        invalid_api_key: 'Voice service authentication failed.',
        missing_api_key: 'Voice service not configured.',
        voice_not_found: 'Voice not available. Try a different agent.',
        text_too_long: 'Response too long for voice — shown in chat instead.',
        system_busy: 'Voice service temporarily unavailable.',
        service_unavailable: 'Voice service temporarily unavailable.',
      };
      return {
        code,
        clientMessage: map[code] || detail.message || `Voice error: ${code}`,
        httpStatus: httpStatus === 429 ? 429 : httpStatus >= 500 ? 503 : 400,
      };
    }
  } catch { /* not JSON */ }
  return { code: 'unknown', clientMessage: `Voice synthesis failed (${httpStatus})`, httpStatus };
}

router.post('/api/elevenlabs/tts', async (req: Request, res: Response) => {
  try {
    const { agent, text, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      logger.warn('[TTS] ELEVENLABS_API_KEY is missing — voice synthesis disabled');
      return res.status(500).json({ error: 'Voice synthesis service not configured' });
    }
    logger.info('[TTS] Request', { agent, textLength: text?.length ?? 0 });

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    if (!resolvedVoiceId) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('ElevenLabs TTS error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      return res.status(parsed.httpStatus).json({ error: parsed.clientMessage, code: parsed.code });
    }

    const audioBuffer = await response.arrayBuffer();
    logger.info('[TTS] Success', { agent, bytes: audioBuffer.byteLength });
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error: unknown) {
    logger.error('TTS error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

router.post('/api/elevenlabs/tts/stream', async (req: Request, res: Response) => {
  try {
    const { agent, text, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'Voice synthesis service not configured' });
    }

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    if (!resolvedVoiceId) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      logger.error('ElevenLabs TTS stream error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      return res.status(parsed.httpStatus).json({ error: parsed.clientMessage, code: parsed.code });
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('Transfer-Encoding', 'chunked');
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    };
    await pump();
  } catch (error: unknown) {
    logger.error('TTS stream error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

// ─── ElevenLabs STT — Speech-to-Text via server proxy (no API key on client) ───
router.post('/api/elevenlabs/stt', async (req: Request, res: Response) => {
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: 'Speech recognition service not configured' });
    }

    // Expect raw audio body (audio/webm, audio/wav, etc.) or base64 in JSON
    let audioBuffer: Buffer;

    if (req.is('application/json')) {
      // JSON body with base64 audio
      const { audio, encoding } = req.body;
      if (!audio) {
        return res.status(400).json({ error: 'Missing audio data' });
      }
      audioBuffer = Buffer.from(audio, encoding || 'base64');
    } else {
      // Raw binary audio body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      audioBuffer = Buffer.concat(chunks);
    }

    if (audioBuffer.length === 0) {
      return res.status(400).json({ error: 'Empty audio data' });
    }

    // Cap audio size at 25MB (ElevenLabs limit)
    if (audioBuffer.length > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'Audio file too large (max 25MB)' });
    }

    // Use ElevenLabs Speech-to-Text API
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' }), 'audio.webm');
    formData.append('model_id', 'scribe_v1');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('ElevenLabs STT error', { status: response.status, error: errorBody.substring(0, 200) });
      const parsed = parseElevenLabsError(errorBody, response.status);
      return res.status(parsed.httpStatus).json({ error: parsed.clientMessage, code: parsed.code });
    }

    const result = await response.json() as { text?: string; language_code?: string };
    res.json({ text: result.text || '', language: result.language_code || 'en' });
  } catch (error: unknown) {
    logger.error('STT error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'unknown' });
  }
});

/**
 * Sandbox Health Check — Verify provider sandbox API keys are configured
 * Does NOT log or expose key values (Law #9: Never log secrets)
 */
router.get('/api/sandbox/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { configured: boolean; sandbox: boolean; status: string }> = {};

  // Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  checks.stripe = {
    configured: !!stripeKey,
    sandbox: stripeKey.startsWith('sk_test_'),
    status: !stripeKey ? 'NOT_SET' : stripeKey.startsWith('sk_test_') ? 'SANDBOX_OK' : 'LIVE_KEY_WARNING',
  };

  // Plaid
  const plaidId = process.env.PLAID_CLIENT_ID || '';
  const plaidSecret = process.env.PLAID_SECRET || '';
  checks.plaid = {
    configured: !!plaidId && !!plaidSecret,
    sandbox: true, // Plaid sandbox is env-based, not key-prefix based
    status: !plaidId || !plaidSecret ? 'NOT_SET' : 'CONFIGURED',
  };

  // Gusto
  const gustoId = process.env.GUSTO_CLIENT_ID || '';
  checks.gusto = {
    configured: !!gustoId,
    sandbox: true, // Gusto uses gusto-demo.com for sandbox
    status: !gustoId ? 'NOT_SET' : 'CONFIGURED',
  };

  // QuickBooks
  const qbId = process.env.QUICKBOOKS_CLIENT_ID || '';
  checks.quickbooks = {
    configured: !!qbId,
    sandbox: true, // QB sandbox is app-level config
    status: !qbId ? 'NOT_SET' : 'CONFIGURED',
  };

  // ElevenLabs
  checks.elevenlabs = {
    configured: !!process.env.ELEVENLABS_API_KEY,
    sandbox: true,
    status: process.env.ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };

  // Deepgram
  checks.deepgram = {
    configured: !!process.env.DEEPGRAM_API_KEY,
    sandbox: true,
    status: process.env.DEEPGRAM_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };

  // Domain Rail / PolarisM
  checks.domain_rail = {
    configured: !!process.env.DOMAIN_RAIL_HMAC_SECRET,
    sandbox: true,
    status: process.env.DOMAIN_RAIL_HMAC_SECRET ? 'CONFIGURED' : 'NOT_SET',
  };

  // Orchestrator
  const orchUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
  checks.orchestrator = {
    configured: !!process.env.ORCHESTRATOR_URL,
    sandbox: true,
    status: process.env.ORCHESTRATOR_URL ? 'CONFIGURED' : 'DEFAULT_LOCALHOST',
  };

  // LiveKit
  checks.livekit = {
    configured: !!process.env.LIVEKIT_URL && !!process.env.LIVEKIT_API_KEY,
    sandbox: true,
    status: !process.env.LIVEKIT_URL ? 'NOT_SET' : 'CONFIGURED',
  };

  // Supabase
  checks.supabase = {
    configured: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    sandbox: false,
    status: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'CONFIGURED' : 'NOT_SET',
  };

  const total = Object.keys(checks).length;
  const configured = Object.values(checks).filter(c => c.configured).length;

  res.json({
    summary: `${configured}/${total} providers configured`,
    all_configured: configured === total,
    checks,
  });
});

/**
 * Orchestrator Intent Proxy — Law #1: Single Brain
 *
 * Routes user text/voice intent to the LangGraph orchestrator.
 * The orchestrator decides which skill pack handles the intent.
 * Returns response text that gets spoken via ElevenLabs TTS.
 *
 * Hardened with:
 * - 15s timeout (AbortController) — Gate 3: Reliability
 * - Circuit breaker (3 failures → open 60s) — Gate 3: Reliability
 * - Correlation ID forwarding — Gate 2: Observability
 */
const ORCHESTRATOR_TIMEOUT_MS = 45_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;
let orchestratorConsecutiveFailures = 0;
let orchestratorLastFailureAt = 0;

function writeSseHeaders(res: Response, correlationId: string): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Correlation-Id', correlationId);
}

function writeSseEvent(res: Response, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/api/orchestrator/intent', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const streamRequested = req.query.stream === 'true';
  if (!ENABLE_INTENT_SSE_PROXY) {
    return res.status(404).json({
      error: 'DISABLED',
      message: 'SSE proxy endpoint disabled by configuration.',
      correlation_id: correlationId,
    });
  }

  if (!streamRequested) {
    return res.status(400).json({
      error: 'STREAM_REQUIRED',
      message: 'GET /api/orchestrator/intent requires stream=true. Use POST /api/orchestrator/intent for non-streaming requests.',
      correlation_id: correlationId,
    });
  }

  const suiteId = (req as any).authenticatedSuiteId || (typeof req.query.suiteId === 'string' ? req.query.suiteId : '');
  if (!suiteId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authenticated suite context required.',
      correlation_id: correlationId,
    });
  }

  const rawAgent = typeof req.query.agent === 'string' ? req.query.agent : '';
  const parsedAgent = parseRequestedAgent(rawAgent);
  if (STRICT_AGENT_VALIDATION && parsedAgent.provided && !parsedAgent.valid) {
    return res.status(400).json({
      error: 'INVALID_AGENT',
      message: `Unsupported agent '${rawAgent}'.`,
      correlation_id: correlationId,
      allowed_agents: Array.from(SUPPORTED_AGENTS),
    });
  }

  writeSseHeaders(res, correlationId);

  const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
  if (!text || req.query.passive === 'true') {
    writeSseEvent(res, {
      type: 'connected',
      message: 'stream_connected',
      timestamp: Date.now(),
      correlation_id: correlationId,
      resolved_agent: parsedAgent.value,
    });

    const heartbeat = setInterval(() => {
      writeSseEvent(res, {
        type: 'heartbeat',
        timestamp: Date.now(),
        correlation_id: correlationId,
      });
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
    });
    return;
  }

  const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);
  req.on('close', () => controller.abort());

  try {
    const response = await fetch(`${ORCHESTRATOR_URL}/v1/intents?stream=true`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': getDefaultOfficeId() || suiteId,
        'X-Actor-Id': (req as any).authenticatedUserId || 'web-stream-client',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        text,
        agent: 'ava',
        requested_agent: parsedAgent.value,
        channel: typeof req.query.channel === 'string' ? req.query.channel : 'chat',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      writeSseEvent(res, {
        type: 'error',
        timestamp: Date.now(),
        correlation_id: correlationId,
        code: 'ORCHESTRATOR_ERROR',
        message: `Orchestrator returned ${response.status}`,
        detail: errorText.substring(0, 200),
      });
      res.end();
      return;
    }

    if (!response.body) {
      writeSseEvent(res, {
        type: 'error',
        timestamp: Date.now(),
        correlation_id: correlationId,
        code: 'ORCHESTRATOR_NO_STREAM',
        message: 'Orchestrator returned no stream body.',
      });
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error: unknown) {
    const code = error instanceof Error && error.name === 'AbortError'
      ? 'ORCHESTRATOR_TIMEOUT'
      : 'ORCHESTRATOR_UNAVAILABLE';
    writeSseEvent(res, {
      type: 'error',
      timestamp: Date.now(),
      correlation_id: correlationId,
      code,
      message: error instanceof Error ? error.message : 'Unknown stream error',
    });
    res.end();
  } finally {
    clearTimeout(timeoutId);
  }
});

router.post('/api/orchestrator/intent', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { agent, text, voiceId, channel, userProfile } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
    const suiteId = (req as any).authenticatedSuiteId;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
    }

    // Circuit breaker check — Law #3: fail fast when orchestrator is known-down
    const now = Date.now();
    if (
      orchestratorConsecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD &&
      (now - orchestratorLastFailureAt) < CIRCUIT_BREAKER_RESET_MS
    ) {
      return res.status(503).json({
        error: 'ORCHESTRATOR_CIRCUIT_OPEN',
        message: 'Orchestrator circuit breaker open. Retrying automatically.',
        correlation_id: correlationId,
      });
    }

    const parsedAgent = parseRequestedAgent(agent);
    if (STRICT_AGENT_VALIDATION && parsedAgent.provided && !parsedAgent.valid) {
      return res.status(400).json({
        error: 'INVALID_AGENT',
        message: `Unsupported agent '${String(agent)}'.`,
        correlation_id: correlationId,
        allowed_agents: Array.from(SUPPORTED_AGENTS),
      });
    }
    const requestedAgent = parsedAgent.value;

    // Build profile context for Ava personalization (PII-filtered — Law #9)
    // Only safe business context fields, never DOB/address/gender
    const profileContext = userProfile ? {
      owner_name: userProfile.ownerName,
      business_name: userProfile.businessName,
      industry: userProfile.industry,
      team_size: userProfile.teamSize,
      industry_specialty: userProfile.industrySpecialty,
      business_goals: userProfile.businessGoals,
      pain_point: userProfile.painPoint,
      preferred_channel: userProfile.preferredChannel,
    } : undefined;

    // Timeout enforcement — Gate 3: Reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);

    const response = await fetch(`${ORCHESTRATOR_URL}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': getDefaultOfficeId() || suiteId,
        'X-Actor-Id': (req as any).authenticatedUserId || '',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        text: text.trim(),
        agent: 'ava',
        requested_agent: requestedAgent,
        voice_id: voiceId,
        channel: channel || 'voice',
        user_profile: profileContext,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      orchestratorConsecutiveFailures++;
      orchestratorLastFailureAt = Date.now();
      const errorText = await response.text();
      logger.error('Orchestrator error', { correlationId, status: response.status, error: errorText.substring(0, 200) });

      // Extract human-readable text from orchestrator error response
      let errorData: any = null;
      try { errorData = JSON.parse(errorText); } catch { /* non-JSON error */ }
      const responseText = errorData?.text || errorData?.message || 'I\'m having trouble processing that right now. Please try again.';

      return res.status(response.status).json({
        response: responseText,
        error: errorData?.error || `Orchestrator returned ${response.status}`,
        approval_payload_hash: errorData?.approval_payload_hash || null,
        required_approvals: errorData?.required_approvals || null,
        receipt_ids: errorData?.receipt_ids || [],
        correlation_id: correlationId,
      });
    }

    // Success — reset circuit breaker
    orchestratorConsecutiveFailures = 0;

    // Emit GREEN receipt when profile context was loaded — Law #2
    if (profileContext && suiteId) {
      try {
        const profileReceiptId = crypto.randomUUID();
        await db.execute(sql`
          INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                                correlation_id, actor_type, actor_id, risk_tier, created_at, payload)
          VALUES (${profileReceiptId}, 'ava.profile_context_loaded', 'success', ${suiteId}, ${suiteId},
                  ${correlationId}, 'system', 'ava-profile-loader', 'green', NOW(),
                  ${JSON.stringify({
                    fields_sent: Object.keys(profileContext).filter(k => (profileContext as any)[k] != null),
                    pii_filtered: ['dateOfBirth', 'gender', 'homeAddress', 'businessAddress'],
                  })}::jsonb)
        `);
      } catch (profileReceiptErr: unknown) {
        // GREEN-tier receipt failure is non-blocking
        logger.warn('Ava profile receipt failed', { correlationId, error: profileReceiptErr instanceof Error ? profileReceiptErr.message : 'unknown' });
      }
    }

    const data = await response.json();
    res.json({
      response: data.text || data.message || 'I processed your request.',
      receipt_id: data.governance?.receipt_ids?.[0] || null,
      receipt_ids: data.governance?.receipt_ids || [],
      resolved_agent: requestedAgent,
      action: data.plan?.task_type || null,
      governance: data.governance || null,
      risk_tier: data.risk?.tier || null,
      route: data.route || null,
      plan: data.plan || null,
      correlation_id: correlationId,
    });
  } catch (error: unknown) {
    orchestratorConsecutiveFailures++;
    orchestratorLastFailureAt = Date.now();

    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Orchestrator timeout', { correlationId, timeout_ms: ORCHESTRATOR_TIMEOUT_MS });
      return res.status(504).json({
        error: 'ORCHESTRATOR_TIMEOUT',
        message: `Orchestrator request timed out after ${ORCHESTRATOR_TIMEOUT_MS / 1000}s`,
        correlation_id: correlationId,
      });
    }

    logger.error('Orchestrator intent error', { correlationId, error: error instanceof Error ? error.message : 'unknown' });
    // Law #3: Fail Closed — return 503, not 200
    res.status(503).json({
      error: 'ORCHESTRATOR_UNAVAILABLE',
      message: 'The orchestrator is currently unavailable. Please try again.',
      correlation_id: correlationId,
    });
  }
});

router.get('/api/inbox/items', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, type, sender_name AS "from", subject, preview, priority,
             unread, created_at AS timestamp, tags
      FROM inbox_items
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const rows = (result.rows || result) as any[];
    res.json({ items: rows });
  } catch (error: unknown) {
    // Graceful degradation: table may not exist yet
    logger.warn('inbox_items query failed, returning empty', { error: error instanceof Error ? error.message : 'unknown' });
    res.json({ items: [] });
  }
});

router.get('/api/authority-queue', async (_req: Request, res: Response) => {
  try {
    // Query pending approval requests — aligned with orchestrator schema
    const approvalResult = await db.execute(sql`
      SELECT approval_id AS id,
             tool || '.' || operation AS type,
             COALESCE(draft_summary, COALESCE(payload_redacted->>'title', tool || ' ' || operation)) AS title,
             COALESCE(
               (execution_payload->>'amount_cents')::numeric / 100,
               (payload_redacted->>'amount')::numeric
             ) AS amount,
             COALESCE(execution_payload->>'currency', payload_redacted->>'currency', 'usd') AS currency,
             created_by_user_id AS "requestedBy",
             risk_tier AS risk,
             status,
             created_at AS "createdAt",
             assigned_agent AS "assignedAgent",
             draft_summary AS "draftSummary",
             execution_payload->>'invoice_id' AS "stripeInvoiceId",
             execution_payload->>'customer_name' AS "customerName",
             execution_payload->>'document_id' AS "pandadocDocumentId"
      FROM approval_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const pendingApprovals = (approvalResult.rows || approvalResult) as any[];

    // Query recent completed receipts — aligned with trust_spine_bundle schema
    const receiptResult = await db.execute(sql`
      SELECT receipt_id AS id,
             receipt_type AS type,
             COALESCE(receipt_type, 'Action') AS title,
             status,
             created_at AS "completedAt"
      FROM receipts
      WHERE status = 'SUCCEEDED'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    const recentReceipts = (receiptResult.rows || receiptResult) as any[];

    res.json({ pendingApprovals, recentReceipts });
  } catch (error: unknown) {
    // Graceful degradation: tables may not exist yet
    logger.warn('authority-queue query failed, returning empty', { error: error instanceof Error ? error.message : 'unknown' });
    res.json({ pendingApprovals: [], recentReceipts: [] });
  }
});

router.post('/api/authority-queue/:id/approve', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require authenticated suite context for state-changing operations
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  const userId = (req as any).authenticatedUserId;
  const { id } = req.params;
  try {
    // Update approval request status — aligned with orchestrator schema
    await db.execute(sql`
      UPDATE approval_requests
      SET status = 'approved', decided_at = NOW(), decided_by_user_id = ${userId || null},
          decision_surface = 'desktop_authority_queue', decision_reason = 'user_approved'
      WHERE approval_id = ${id}
    `);

    // Generate approval receipt (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                            correlation_id, actor_type, actor_id, created_at)
      VALUES (${receiptId}, 'approval.approve', 'success', ${suiteId}, ${suiteId},
              ${correlationId}, 'user', ${userId || null}, NOW())
    `);

    // After successful approval, trigger resume execution via orchestrator
    const officeId = getDefaultOfficeId();
    try {
      const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
      const resumeRes = await fetch(`${orchestratorUrl}/v1/resume/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-suite-id': suiteId,
          'x-office-id': officeId || '',
          'x-actor-id': userId || '',
        },
      });
      const resumeData = await resumeRes.json();
      return res.json({
        approved: true,
        executed: resumeRes.ok,
        ...resumeData,
      });
    } catch (resumeErr) {
      // Approval succeeded but execution failed — return partial success
      return res.json({
        approved: true,
        executed: false,
        error: 'Resume execution failed',
        retry_available: true,
        receiptId,
      });
    }
  } catch (error: unknown) {
    logger.warn('approve failed', { error: error instanceof Error ? error.message : 'unknown' });
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'APPROVE_FAILED', message: 'Failed to approve request' });
  }
});

router.post('/api/authority-queue/:id/deny', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require authenticated suite context for state-changing operations
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  const userId = (req as any).authenticatedUserId;
  const { id } = req.params;
  const { reason } = req.body;
  try {
    // Update approval request status — aligned with orchestrator schema
    await db.execute(sql`
      UPDATE approval_requests
      SET status = 'denied', decided_at = NOW(), decided_by_user_id = ${userId || null},
          decision_surface = 'desktop_authority_queue',
          decision_reason = ${reason || 'No reason provided'}
      WHERE approval_id = ${id}
    `);

    // Generate denial receipt (Law #2: Receipt for All)
    const receiptId = crypto.randomUUID();
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, action, result, suite_id, tenant_id,
                            correlation_id, actor_type, actor_id, created_at)
      VALUES (${receiptId}, 'approval.deny', 'denied', ${suiteId}, ${suiteId},
              ${correlationId}, 'user', ${userId || null}, NOW())
    `);

    res.json({ id, status: 'denied', reason, deniedAt: new Date().toISOString(), receiptId });
  } catch (error: unknown) {
    logger.warn('deny failed', { error: error instanceof Error ? error.message : 'unknown' });
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'DENY_FAILED', message: 'Failed to deny request' });
  }
});

/**
 * Execute an already-approved authority queue item via orchestrator resume.
 * Used for retry when approve succeeded but auto-execute failed,
 * or for manual execution after review.
 */
router.post('/api/authority-queue/:id/execute', async (req: Request, res: Response) => {
  const { id } = req.params;
  const suiteId = (req as any).authenticatedSuiteId;
  const userId = (req as any).authenticatedUserId;
  const officeId = getDefaultOfficeId();

  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authenticated suite context required.' });
  }

  try {
    const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
    const result = await fetch(`${orchestratorUrl}/v1/resume/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-suite-id': suiteId,
        'x-office-id': officeId || '',
        'x-actor-id': userId || '',
      },
    });
    const data = await result.json();
    return res.status(result.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'EXECUTE_FAILED', message: 'Failed to execute approved request' });
  }
});

/**
 * Anam Avatar — Session Token Exchange (Law #9: secrets server-side only)
 *
 * The Anam API key stays on the server. The client receives a short-lived
 * session token to initialize the Anam JS SDK with streamToVideoElement().
 *
 * Persona "Ava" created in Anam dashboard (lab.anam.ai/personas):
 *   - Avatar: Cara at desk (30fa96d0)
 *   - Voice: Hope (0c8b52f4-f26d-4810-855c-c90e5f599cbc)
 *   - LLM: CUSTOMER_CLIENT_V1 → routes to /api/ava/chat-stream (Law #1: Single Brain)
 *   - Persona ID stored in ANAM_PERSONA_ID env var
 */

router.post('/api/anam/session', async (req: Request, res: Response) => {
  try {
    // Law #3: Fail Closed — require authenticated user for avatar sessions
    const userId = (req as any).authenticatedUserId;
    if (!userId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required for avatar sessions' });
    }

    const ANAM_API_KEY = process.env.ANAM_API_KEY;

    if (!ANAM_API_KEY) {
      return res.status(503).json({ error: 'AVATAR_NOT_CONFIGURED', message: 'Avatar API key not configured' });
    }

    // Determine which persona — Finn or Ava (default)
    // Use EPHEMERAL persona config (not stateful ID) to avoid legacy token type.
    // Anam SDK v4.8 rejects legacy tokens — ephemeral returns type: "ephemeral".
    const requestedPersona = req.body?.persona;
    const resolvedPersona: 'ava' | 'finn' = requestedPersona === 'finn' ? 'finn' : 'ava';

    // Ava: Cara avatar + Hope voice, Finn: custom avatar + voice
    // llmId: CUSTOMER_CLIENT_V1 routes all conversation to /api/ava/chat-stream (Law #1: Single Brain)
    const AVA_CONFIG = {
      name: 'Ava',
      avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',   // Cara at desk
      voiceId: '0c8b52f4-f26d-4810-855c-c90e5f599cbc',    // Hope
      llmId: 'CUSTOMER_CLIENT_V1',
      systemPrompt: 'You are Ava, a professional AI assistant for Aspire business operations.',
      skipGreeting: true,      // Client sends greeting — no built-in LLM for CUSTOMER_CLIENT_V1
      avatarModel: 'cara-3',   // Latest model: sharper video, better lip sync
    };
    const FINN_CONFIG = {
      name: 'Finn',
      avatarId: req.body?.avatarId || '45ddc55c-14a9-4b25-8e28-f6c1ce39ccc5',
      voiceId: req.body?.voiceId || '7db5f408-833c-49ce-97aa-eaec17077a4c',
      llmId: 'CUSTOMER_CLIENT_V1',
      systemPrompt: 'You are Finn, the Aspire finance and money desk specialist.',
      skipGreeting: true,      // Client sends greeting — no built-in LLM for CUSTOMER_CLIENT_V1
      avatarModel: 'cara-3',   // Latest model: sharper video, better lip sync
    };

    const personaConfig = resolvedPersona === 'finn' ? FINN_CONFIG : AVA_CONFIG;
    const agent = resolvedPersona === 'finn' ? 'Finn' : 'Ava';

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ personaConfig }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Anam session token API error', {
        status: response.status,
        persona: agent,
        avatarId: personaConfig.avatarId,
        error: errorText.substring(0, 500),
      });
      return res.status(502).json({
        error: 'AVATAR_SESSION_FAILED',
        message: `Avatar service error (Anam API ${response.status})`,
        anamStatus: response.status,
      });
    }

    const data = await response.json() as { sessionToken?: string };
    if (!data.sessionToken) {
      logger.error('Anam returned no session token', { responseKeys: Object.keys(data), persona: resolvedPersona });
      return res.status(502).json({ error: 'AVATAR_NO_TOKEN', message: 'Avatar service returned invalid response' });
    }

    logger.info('Anam session token obtained', { persona: resolvedPersona, tokenLength: data.sessionToken.length });

    // Store user context for CUSTOMER_CLIENT_V1 brain routing auth bridge.
    // When Anam calls /api/ava/chat-stream, it sends the session_id — we look up the suite context.
    const suiteId = (req as any).authenticatedSuiteId;
    if (suiteId && data.sessionToken) {
      setAnamSessionContext(data.sessionToken, {
        userId,
        suiteId,
        persona: resolvedPersona,
        createdAt: Date.now(),
      });
      logger.info('Anam session stored for brain routing', { userId, persona: resolvedPersona });
    }

    // Return only the session token — no API key exposure
    res.json({ sessionToken: data.sessionToken });
  } catch (error: unknown) {
    logger.error('Avatar session error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'AVATAR_ERROR', message: 'Avatar service error' });
  }
});

// ─── Anam CUSTOMER_CLIENT_V1 Chat Stream ───
// When Anam is configured with llmId: CUSTOMER_CLIENT_V1, it sends user speech
// transcripts to this endpoint instead of using its built-in LLM.
// This endpoint forwards to our orchestrator (Law #1: Single Brain).

router.post('/api/ava/chat-stream', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sendSse = (text: string, extra: Record<string, unknown> = {}) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
    }
    res.write(`data: ${JSON.stringify({ text, done: false, ...extra })}\n\n`);
    res.write(`data: ${JSON.stringify({ text: '', done: true, ...extra })}\n\n`);
    res.end();
  };

  try {
    const { message, session_id, message_history, userProfile, agent } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing or empty message parameter' });
    }

    const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';

    // Auth bridge: prefer JWT-derived suiteId/userId, fall back to session store for Anam brain routing
    let suiteId = (req as any).authenticatedSuiteId;
    let userId = (req as any).authenticatedUserId;
    let sessionCtx: AnamSessionContext | undefined;
    if ((!suiteId || !userId) && session_id) {
      // CUSTOMER_CLIENT_V1 callback — Anam sends session_id, look up stored context
      sessionCtx = getAnamSessionContext(session_id);
      if (sessionCtx) {
        if (!suiteId) suiteId = sessionCtx.suiteId;
        if (!userId) userId = sessionCtx.userId;
        logger.info('Anam brain routing: resolved context from session store', { correlationId });
      }
    }

    const parsedAgent = parseRequestedAgent(agent ?? sessionCtx?.persona);
    if (STRICT_AGENT_VALIDATION && parsedAgent.provided && !parsedAgent.valid) {
      return sendSse('Unsupported agent selection. Please choose a valid agent.', {
        correlation_id: correlationId,
        error: 'INVALID_AGENT',
        allowed_agents: Array.from(SUPPORTED_AGENTS),
      });
    }
    const requestedAgent = parsedAgent.value;

    if (!suiteId) {
      logger.warn('Ava chat-stream: no suite context available', { correlationId, hasSessionId: !!session_id });
      return sendSse("Your session expired. Please reconnect your avatar and try again.", {
        correlation_id: correlationId,
        error: 'AUTH_REQUIRED',
      });
    }

    // Build profile context for Ava avatar personalization (PII-filtered — Law #9)
    const profileContext = userProfile ? {
      owner_name: userProfile.ownerName,
      business_name: userProfile.businessName,
      industry: userProfile.industry,
      team_size: userProfile.teamSize,
      industry_specialty: userProfile.industrySpecialty,
      business_goals: userProfile.businessGoals,
      pain_point: userProfile.painPoint,
      preferred_channel: userProfile.preferredChannel,
    } : undefined;

    // Forward to orchestrator (Law #1: Single Brain decides)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);

    const response = await fetch(`${ORCHESTRATOR_URL}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Office-Id': getDefaultOfficeId() || suiteId,
        'X-Actor-Id': userId || 'anam-brain-routing',
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        text: message.trim(),
        agent: 'ava',
        requested_agent: requestedAgent,
        channel: 'avatar',
        session_id,
        message_history: message_history?.slice(-10),
        user_profile: profileContext,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Ava chat-stream orchestrator error', { correlationId, status: response.status, error: errorText.substring(0, 200) });
      return sendSse("I'm having trouble processing that right now. Could you try again?", {
        correlation_id: correlationId,
        error: 'ORCHESTRATOR_ERROR',
      });
    }

    const data = await response.json();
    const responseText = data.text || data.message || "I'm ready when you are.";
    return sendSse(responseText, {
      correlation_id: correlationId,
      receipt_id: data.governance?.receipt_ids?.[0] || null,
      resolved_agent: requestedAgent,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error('Ava chat-stream timeout', { correlationId });
      return sendSse("I'm taking longer than expected. Please try again.", {
        correlation_id: correlationId,
        error: 'ORCHESTRATOR_TIMEOUT',
      });
    }
    logger.error('Ava chat-stream error', { correlationId, error: error instanceof Error ? error.message : 'unknown' });
    return sendSse("I'm having trouble connecting right now.", {
      correlation_id: correlationId,
      error: 'ORCHESTRATOR_UNAVAILABLE',
    });
  }
});

// ─── Mail Onboarding API (Local Service) ───
// Enterprise-grade: Auth required, input validated, fail-closed

import { buildAuthUrl, handleCallback, getValidToken } from './mail/googleOAuth';
import * as onboarding from './mail/onboardingService';
import { createTrustSpineReceipt } from './receiptService';
import * as imapClient from './mail/imapClient';
import * as gmailClient from './mail/gmailClient';

// ─── Validation Helpers (Law #3: Fail Closed) ───

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOMAIN_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const EMAIL_LOCAL_RE = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;

function isValidUUID(s: string): boolean { return UUID_RE.test(s); }
function isValidDomain(s: string): boolean { return DOMAIN_RE.test(s) && s.length <= 253; }
function isValidLocalPart(s: string): boolean { return EMAIL_LOCAL_RE.test(s) && s.length <= 64; }

/** Extract and validate suite_id from authenticated request. Returns null + sends 401 if missing. */
function requireAuth(req: Request, res: Response): string | null {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
    return null;
  }
  return suiteId;
}

/** Validate jobId from URL params. Returns null + sends 400 if invalid. */
function requireJobId(req: Request, res: Response): string | null {
  const jobId = getParam(req.params.jobId);
  if (!jobId || !isValidUUID(jobId)) {
    res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid job ID required' });
    return null;
  }
  return jobId;
}

// Rate limiter for onboarding (5 starts per minute per suite)
const onboardingRateMap = new Map<string, { count: number; resetAt: number }>();
function checkOnboardingRate(suiteId: string): boolean {
  const now = Date.now();
  const entry = onboardingRateMap.get(suiteId);
  if (!entry || now > entry.resetAt) {
    onboardingRateMap.set(suiteId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const DOMAIN_RAIL_URL = process.env.DOMAIN_RAIL_URL || 'https://domain-rail-production.up.railway.app';

/**
 * Build S2S HMAC headers matching Domain Rail auth.ts format exactly:
 *   x-aspire-timestamp: unix seconds
 *   x-aspire-nonce: random hex string (replay protection)
 *   x-aspire-signature: HMAC-SHA256 of `${timestamp}.${nonce}.${METHOD}.${pathAndQuery}.${sha256(rawBody)}`
 */
function getDomainRailS2SHeaders(
  method: string,
  pathAndQuery: string,
  rawBody: string,
  suiteId?: string,
): Record<string, string> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) throw new Error('DOMAIN_RAIL_HMAC_SECRET not configured');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const base = `${timestamp}.${nonce}.${method.toUpperCase()}.${pathAndQuery}.${bodyHash}`;
  const signature = crypto.createHmac('sha256', secret).update(base).digest('hex');

  return {
    'Content-Type': 'application/json',
    'x-aspire-timestamp': timestamp,
    'x-aspire-nonce': nonce,
    'x-aspire-signature': signature,
    'x-suite-id': suiteId || '',
    'x-correlation-id': `corr_${crypto.randomUUID()}`,
  };
}

async function domainRailProxy(method: string, path: string, body?: any, suiteId?: string, extraHeaders?: Record<string, string>): Promise<{ status: number; data: any }> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) return { status: 503, data: { error: 'DOMAIN_RAIL_HMAC_SECRET not configured' } };
  if (!supabaseAdmin) return { status: 503, data: { error: 'Supabase not configured' } };

  // Mint a short-lived capability token for Domain Rail (Law #5)
  const correlationId = `corr_${crypto.randomUUID()}`;
  const { data: tokenResult, error: tokenErr } = await supabaseAdmin.rpc('trust_issue_capability_token', {
    p_suite_id: suiteId,
    p_office_id: suiteId, // office_id defaults to suite for now
    p_scope: 'domain-rail',
    p_ttl_seconds: 60,
    p_correlation_id: correlationId,
    p_requested_action: { method, path },
    p_metadata: {},
  });
  if (tokenErr || !tokenResult?.token) {
    return { status: 503, data: { error: 'Failed to mint capability token' } };
  }

  const bodyStr = body ? JSON.stringify(body) : '';
  const url = `${DOMAIN_RAIL_URL}${path}`;
  const headers = getDomainRailS2SHeaders(method, path, bodyStr, suiteId);
  headers['x-aspire-capability-token'] = tokenResult.token;
  headers['x-correlation-id'] = correlationId;
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
  }
  const opts: RequestInit = { method, headers };
  if (body && method !== 'GET') opts.body = bodyStr;
  const response = await fetch(url, opts);
  const data = await response.json().catch(() => ({ error: 'Invalid response from Domain Rail' }));
  return { status: response.status, data };
}

// ─── Calendar Events API (Law #2: Receipts, Law #4: Risk Tiers, Law #6: RLS) ───

// Rate limiter for calendar creates: 10 per minute per suite
const calendarRateMap = new Map<string, { count: number; resetAt: number }>();
function checkCalendarRate(suiteId: string): boolean {
  const now = Date.now();
  const entry = calendarRateMap.get(suiteId);
  if (!entry || now > entry.resetAt) {
    calendarRateMap.set(suiteId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const CALENDAR_EVENT_TYPES = ['meeting', 'task', 'reminder', 'call', 'deadline', 'other'] as const;
const CALENDAR_SOURCES = ['manual', 'ava', 'booking', 'google_calendar', 'import'] as const;

// GET /api/calendar/events — list calendar events for suite (GREEN)
router.get('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const result = await db.execute(sql`
      SELECT * FROM calendar_events
      WHERE suite_id = ${suiteId}
      ORDER BY start_time ASC
      LIMIT 100`);
    res.json({ events: result.rows });
  } catch (e: unknown) {
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/events — create calendar event (YELLOW — Law #4)
router.post('/api/calendar/events', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    if (!checkCalendarRate(suiteId)) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many calendar creates. Please wait.' });
    }

    const { title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day, source, source_ref, created_by } = req.body;

    // Validate required fields (Law #3: Fail Closed)
    const cleanTitle = sanitizeText(title);
    if (!cleanTitle || cleanTitle.length > 500) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Title required (max 500 chars)' });
    }
    if (!start_time || isNaN(Date.parse(start_time))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Valid start_time (ISO 8601) required' });
    }
    const validType = validateEnum(event_type, [...CALENDAR_EVENT_TYPES]) || 'meeting';
    const validSource = validateEnum(source, [...CALENDAR_SOURCES]) || 'manual';

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-create-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const cleanDesc = sanitizeText(description);
    const cleanLoc = sanitizeText(location);
    const cleanSourceRef = sanitizeText(source_ref);
    const cleanCreatedBy = sanitizeText(created_by);
    const cleanParticipants = sanitizeArray(participants);
    const participantsPgArray = cleanParticipants.length > 0
      ? `{${cleanParticipants.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`
      : null;

    const result = await db.execute(sql`
      INSERT INTO calendar_events (suite_id, title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day, source, source_ref, created_by)
      VALUES (${suiteId}, ${cleanTitle}, ${cleanDesc}, ${validType}, ${start_time}, ${end_time || null}, ${duration_minutes || null}, ${cleanLoc}, ${participantsPgArray}::text[], ${is_all_day || false}, ${validSource}, ${cleanSourceRef}, ${cleanCreatedBy})
      RETURNING *`);

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const receiptAction = JSON.stringify({ type: 'calendar.event.create', title: cleanTitle, event_type: validType, start_time, source: validSource });
    const receiptResult = JSON.stringify({ outcome: 'success', event_id: result.rows[0]?.id });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.create', ${receiptAction}::jsonb, ${receiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar receipt write failed (event created)', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.status(201).json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar create error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/events/:id — update calendar event (YELLOW — Law #4)
router.put('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = getParam(req.params.id);
    if (!eventId || !isValidUUID(eventId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Valid event UUID required' });
    }

    const { title, description, event_type, start_time, end_time, duration_minutes, location, participants, is_all_day } = req.body;

    // Validate if provided
    if (title !== undefined) {
      const cleanTitle = sanitizeText(title);
      if (!cleanTitle || cleanTitle.length > 500) {
        return res.status(400).json({ error: 'INVALID_INPUT', message: 'Title must be 1-500 chars' });
      }
    }
    if (start_time !== undefined && isNaN(Date.parse(start_time))) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Valid start_time (ISO 8601) required' });
    }
    if (event_type !== undefined && !validateEnum(event_type, [...CALENDAR_EVENT_TYPES])) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid event_type' });
    }

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await db.execute(sql`
      UPDATE calendar_events SET
        title = COALESCE(${sanitizeText(title)}, title),
        description = COALESCE(${description !== undefined ? sanitizeText(description) : null}, description),
        event_type = COALESCE(${event_type !== undefined ? validateEnum(event_type, [...CALENDAR_EVENT_TYPES]) : null}, event_type),
        start_time = COALESCE(${start_time || null}, start_time),
        end_time = COALESCE(${end_time !== undefined ? end_time : null}, end_time),
        duration_minutes = COALESCE(${duration_minutes !== undefined ? duration_minutes : null}, duration_minutes),
        location = COALESCE(${location !== undefined ? sanitizeText(location) : null}, location),
        participants = COALESCE(${participants !== undefined ? (sanitizeArray(participants).length > 0 ? `{${sanitizeArray(participants).map((p: string) => `"${p.replace(/"/g, '\\"')}"`).join(',')}}` : null) : null}::text[], participants),
        is_all_day = COALESCE(${is_all_day !== undefined ? is_all_day : null}, is_all_day),
        updated_at = NOW()
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING *`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Calendar event not found' });
    }

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const updReceiptAction = JSON.stringify({ type: 'calendar.event.update', event_id: eventId, fields_updated: Object.keys(req.body) });
    const updReceiptResult = JSON.stringify({ outcome: 'success' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.update', ${updReceiptAction}::jsonb, ${updReceiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar update receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar update error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /api/calendar/events/:id — delete calendar event (YELLOW — Law #4)
router.delete('/api/calendar/events/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = getParam(req.params.id);
    if (!eventId || !isValidUUID(eventId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Valid event UUID required' });
    }

    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const result = await db.execute(sql`
      DELETE FROM calendar_events
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING id`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Calendar event not found' });
    }

    // Emit receipt (Law #2) — matches receipts table schema
    const receiptId = crypto.randomBytes(16).toString('hex');
    const delReceiptAction = JSON.stringify({ type: 'calendar.event.delete', event_id: eventId });
    const delReceiptResult = JSON.stringify({ outcome: 'success' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.delete', ${delReceiptAction}::jsonb, ${delReceiptResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar delete receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ success: true, receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar delete error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// PATCH /api/calendar/events/:id/complete — mark event as completed (YELLOW)
router.patch('/api/calendar/events/:id/complete', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const eventId = req.params.id as string;
    if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const { status: newStatus } = req.body || {};
    const validStatuses = ['completed', 'cancelled', 'pending', 'in_progress'];
    const targetStatus = validStatuses.includes(newStatus) ? newStatus : 'completed';
    const completedAt = (targetStatus === 'completed') ? new Date().toISOString() : null;

    const result = await db.execute(sql`
      UPDATE calendar_events SET
        status = ${targetStatus},
        completed_at = ${completedAt},
        updated_at = NOW()
      WHERE id = ${eventId} AND suite_id = ${suiteId}
      RETURNING *`);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Emit receipt (Law #2)
    const correlationId = (req.headers['x-correlation-id'] as string) || `corr-cal-complete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const receiptId = crypto.randomBytes(16).toString('hex');
    const completeAction = JSON.stringify({ type: 'calendar.event.complete', event_id: eventId, new_status: targetStatus });
    const completeResult = JSON.stringify({ outcome: 'success', previous_status: 'pending' });
    try {
      await db.execute(sql`
        INSERT INTO receipts (receipt_id, receipt_type, action, result, suite_id, tenant_id,
                              correlation_id, actor_type, actor_id, status, created_at)
        VALUES (${receiptId}, 'calendar.event.complete', ${completeAction}::jsonb, ${completeResult}::jsonb,
                ${suiteId}, ${suiteId.toString()}, ${correlationId}, 'USER',
                ${(req as any).authenticatedUserId || 'unknown'}, 'SUCCEEDED', NOW())`);
    } catch (receiptErr: unknown) {
      logger.warn('Calendar complete receipt write failed', { error: receiptErr instanceof Error ? receiptErr.message : 'unknown' });
    }

    res.json({ event: result.rows[0], receipt_id: receiptId });
  } catch (e: unknown) {
    logger.error('Calendar complete error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

// GET /api/calendar/today — today's events merged from calendar_events + bookings (GREEN)
router.get('/api/calendar/today', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;

    const [calResult, bookResult] = await Promise.all([
      db.execute(sql`
        SELECT * FROM calendar_events
        WHERE suite_id = ${suiteId}
          AND start_time::date = CURRENT_DATE
        ORDER BY start_time ASC`),
      db.execute(sql`
        SELECT * FROM bookings
        WHERE suite_id = ${suiteId}
          AND scheduled_at::date = CURRENT_DATE
        ORDER BY scheduled_at ASC`),
    ]);

    const calEvents = (calResult.rows as any[]).map(e => ({
      ...e,
      _source: 'calendar',
    }));

    const bookEvents = (bookResult.rows as any[]).map(b => ({
      id: b.id,
      suite_id: b.suite_id,
      title: `Booking: ${b.client_name || 'Client'}`,
      description: b.client_notes || null,
      event_type: 'meeting',
      start_time: b.scheduled_at,
      end_time: b.scheduled_at && b.duration ? new Date(new Date(b.scheduled_at).getTime() + b.duration * 60_000).toISOString() : null,
      duration_minutes: b.duration,
      location: null,
      participants: [b.client_email].filter(Boolean),
      is_all_day: false,
      source: 'booking',
      source_ref: b.id,
      created_at: b.created_at,
      updated_at: b.updated_at,
      _source: 'booking',
      _booking_status: b.status,
      _booking_amount: b.amount,
    }));

    const merged = [...calEvents, ...bookEvents].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    res.json({ events: merged });
  } catch (e: unknown) {
    logger.error('Calendar today error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch today\'s events' });
  }
});

// GET /api/mail/accounts — list connected mail accounts
router.get('/api/mail/accounts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const accounts = await onboarding.listAccounts(suiteId);
    res.json({ accounts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch accounts' }); }
});

// GET /api/mail/receipts — list mail receipts
router.get('/api/mail/receipts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const receipts = await onboarding.listMailReceipts(suiteId);
    res.json({ receipts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch receipts' }); }
});

// ─── /v1/* Mail Onboarding API (Local Service) ───

// GET /v1/inbox/accounts
router.get('/v1/inbox/accounts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const accounts = await onboarding.listAccounts(suiteId);
    res.json({ accounts });
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch accounts' }); }
});

// POST /v1/mail/onboarding/start (YELLOW — external service setup)
router.post('/v1/mail/onboarding/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    if (!checkOnboardingRate(suiteId)) {
      return res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many onboarding requests. Try again in 1 minute.' });
    }
    const { provider, context } = req.body;
    if (!provider || !['POLARIS', 'GOOGLE'].includes(provider)) {
      return res.status(400).json({ error: 'INVALID_PROVIDER', message: 'provider must be POLARIS or GOOGLE' });
    }
    const result = await onboarding.startOnboarding(suiteId, officeId, provider, context);

    // Law #2: Receipt for mail onboarding start (YELLOW — external service setup)
    await createTrustSpineReceipt({
      suiteId,
      officeId,
      receiptType: 'mail.onboarding.start',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'start_mail_onboarding', provider, risk_tier: 'YELLOW' },
      result: { job_id: (result as any)?.jobId || (result as any)?.id },
    }).catch(() => {});

    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'Onboarding start failed' }); }
});

// GET /v1/mail/onboarding/:jobId
router.get('/v1/mail/onboarding/:jobId', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const data = await onboarding.getOnboarding(jobId, suiteId);
    res.json(data);
  } catch (e: unknown) { res.status(500).json({ error: 'Failed to fetch onboarding status' }); }
});

// POST /v1/mail/onboarding/:jobId/dns/plan
router.post('/v1/mail/onboarding/:jobId/dns/plan', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const { domain, mailbox, displayName, domainMode } = req.body;
    if (domain && !isValidDomain(domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Invalid domain format' });
    }
    if (mailbox && !isValidLocalPart(mailbox)) {
      return res.status(400).json({ error: 'INVALID_MAILBOX', message: 'Invalid mailbox name' });
    }
    const result = await onboarding.generateDnsPlan(jobId, suiteId, domain, mailbox, displayName, domainMode);
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'DNS plan generation failed' }); }
});

// POST /v1/mail/onboarding/:jobId/dns/check
router.post('/v1/mail/onboarding/:jobId/dns/check', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const result = await onboarding.checkDns(jobId, suiteId);
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'DNS check failed' }); }
});

// GET /v1/domains/search — proxy to Domain Rail (needs static IP for ResellerClub)
router.get('/v1/domains/search', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const q = (req.query.q as string || '').trim();
    if (!q || q.length > 253) return res.status(400).json({ error: 'INVALID_QUERY', message: 'Valid search query required' });

    // Build canonical domain (add .com if no TLD provided)
    const domain = q.includes('.') ? q : `${q}.com`;
    const dotIdx = domain.indexOf('.');
    const tld = dotIdx > 0 ? domain.substring(dotIdx + 1) : 'com';

    // Proxy to Domain Rail — only Domain Rail's static IP is whitelisted at ResellerClub
    const drResult = await domainRailProxy('GET', `/v1/domains/check?domain=${encodeURIComponent(domain)}`, undefined, suiteId);
    const rawData: Record<string, any> = drResult.data?.data || {};

    // Transform RC response into DomainSearchResult[] format
    const results: Array<{ domain: string; available: boolean; price: string; currency: string; tld: string; term: number }> = [];
    for (const [rcKey, info] of Object.entries(rawData)) {
      const domainInfo = info as any;
      const rcStatus = typeof domainInfo === 'string' ? domainInfo : domainInfo?.status;
      if (!rcStatus) continue;
      const priceVal = typeof domainInfo === 'object' ? (domainInfo.price || domainInfo.sellingprice) : undefined;
      results.push({
        domain: rcKey.includes('.') ? rcKey : `${rcKey}.${tld}`,
        available: rcStatus === 'available',
        price: priceVal || '12.99',
        currency: (typeof domainInfo === 'object' ? domainInfo.currency : undefined) || 'USD',
        tld,
        term: 1,
      });
    }

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.search',
      status: 'SUCCEEDED',
      action: { operation: 'domain_search', query: q },
      result: { resultCount: results.length },
    }).catch(() => {});

    res.json({ query: q, results });
  } catch (e: unknown) { res.status(500).json({ error: 'Domain search failed' }); }
});

// POST /v1/domains/purchase/request — proxy to Domain Rail (RED tier — explicit authority)
router.post('/v1/domains/purchase/request', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    if (!req.body?.domain || !isValidDomain(req.body.domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Valid domain required' });
    }
    const { status, data } = await domainRailProxy('POST', '/v1/domains', req.body, suiteId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.purchase_requested',
      status: status < 400 ? 'SUCCEEDED' : 'FAILED',
      action: { operation: 'domain_purchase', domain: req.body.domain },
      result: { orderId: data?.orderId, statusCode: status },
    }).catch(() => {});

    res.status(status).json(data);
  } catch (e: unknown) { res.status(500).json({ error: 'Domain purchase request failed' }); }
});

// POST /v1/domains/checkout/start — Purchase domain via Domain Rail → ResellerClub (RED tier)
// Payment flows through RC's configured PayPal — no separate PayPal credentials needed
router.post('/v1/domains/checkout/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { jobId, domain } = req.body;
    if (!domain || !isValidDomain(domain)) {
      return res.status(400).json({ error: 'INVALID_DOMAIN', message: 'Valid domain required' });
    }

    // 1. Verify domain is still available via Domain Rail
    const { data: checkData } = await domainRailProxy('GET', `/v1/domains/check?domain=${encodeURIComponent(domain)}`, undefined, suiteId);
    const rawAvail: Record<string, any> = checkData?.data || {};
    const availEntry = Object.values(rawAvail).find((v: any) => typeof v === 'object' && v?.status) as any;
    if (!availEntry || availEntry?.status !== 'available') {
      return res.status(400).json({ error: 'DOMAIN_NOT_AVAILABLE', message: 'Domain is not available for purchase' });
    }
    const price = availEntry?.price || availEntry?.sellingprice || '12.99';

    // 2. Get contact ID from Domain Rail (proxies to ResellerClub)
    let contactId: string;
    try {
      const { data: contactData } = await domainRailProxy('GET', '/v1/domains/contacts/default', undefined, suiteId);
      contactId = contactData?.contactId;
      if (!contactId) throw new Error('No contact ID returned');
    } catch (e: unknown) {
      return res.status(503).json({ error: 'RC_CONTACT_MISSING', message: 'Could not discover ResellerClub contact. ' + (e instanceof Error ? e.message.slice(0, 100) : '') });
    }

    // 3. Create approval receipt (RED tier — user clicking "Purchase Now" is the approval)
    const approvalId = crypto.randomUUID();
    if (supabaseAdmin) {
      await supabaseAdmin.from('receipts').insert({
        receipt_id: approvalId,
        suite_id: suiteId,
        receipt_type: 'approval',
        status: 'SUCCEEDED',
        risk_tier: 'red',
        actor_type: 'USER',
        tool_used: 'desktop.domain.purchase',
        action: { operation: 'domain_purchase_approval', domain, price },
        result: { approved: true, approved_at: new Date().toISOString() },
      }).then(() => {}, () => {});
    }

    // 4. Register domain via Domain Rail (which calls ResellerClub)
    const idempotencyKey = crypto.randomUUID();
    const { status: drStatus, data: drData } = await domainRailProxy('POST', '/v1/domains', {
      domain,
      years: 1,
      nameservers: ['ns1.emailarray.com', 'ns2.emailarray.com'],
      registrantContactId: contactId,
      adminContactId: contactId,
      techContactId: contactId,
      billingContactId: contactId,
      invoiceOption: 'PayInvoice',
    }, suiteId, {
      'x-aspire-approval-id': approvalId,
      'x-idempotency-key': idempotencyKey,
    });

    if (drStatus >= 400) {
      const errMsg = drData?.error || 'Registration failed';
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.domain.purchase_failed',
        status: 'FAILED',
        action: { operation: 'domain_register', domain, invoiceOption: 'PayInvoice' },
        result: { error: String(errMsg).slice(0, 200), drStatus },
      }).catch(() => {});
      return res.status(400).json({ error: 'REGISTRATION_FAILED', message: String(errMsg).slice(0, 200) });
    }

    const orderId = drData?.data?.domain_id || drData?.receipt_id || crypto.randomUUID();

    // 5. Update onboarding job if present
    if (supabaseAdmin && jobId) {
      await supabaseAdmin.from('mail_onboarding_jobs').update({
        state: 'DOMAIN_SELECTED',
        domain,
        domain_mode: 'buy_domain',
        last_health: { orderId, price, contactId },
        state_updated_at: new Date().toISOString(),
      }).eq('id', jobId).eq('suite_id', suiteId).then(() => {}, () => {});
    }

    // 6. Receipt (Law #2) — Domain Rail already emits its own receipt, this is the Desktop-side one
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.domain.purchased',
      status: 'SUCCEEDED',
      action: { operation: 'domain_register', domain, invoiceOption: 'PayInvoice', price },
      result: { orderId, contactId, approvalId },
    }).catch(() => {});

    // 7. Return with DNS plan for immediate display
    const dnsPlan = [
      { type: 'MX', host: '@', value: 'mx1.emailarray.com', priority: 10, ttl: 3600 },
      { type: 'MX', host: '@', value: 'mx2.emailarray.com', priority: 20, ttl: 3600 },
      { type: 'TXT', host: '@', value: 'v=spf1 include:spf.emailarray.com ~all', ttl: 3600 },
      { type: 'CNAME', host: 'webmail', value: 'webmail.emailarray.com', ttl: 3600 },
    ];

    res.json({ status: 'COMPLETED', orderId, domain, amount: price, currency: 'USD', dnsPlan });
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'unknown';
    logger.error('Checkout start error', { error: errorMsg });
    res.status(500).json({ error: 'CHECKOUT_FAILED', message: errorMsg.slice(0, 200) });
  }
});

// GET /v1/mail/oauth/google/start — redirect to Google consent screen
router.get('/v1/mail/oauth/google/start', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = req.query.jobId as string;
    if (!jobId || !isValidUUID(jobId)) {
      return res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid jobId required' });
    }
    const authUrl = buildAuthUrl(jobId, suiteId);
    res.json({ authUrl });
  } catch (e: unknown) { res.status(500).json({ error: 'OAuth initialization failed' }); }
});

// GET /api/mail/oauth/google/callback — handle Google OAuth callback
router.get('/api/mail/oauth/google/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      return res.redirect('/inbox/setup?error=' + encodeURIComponent(error));
    }
    if (!code || !state) {
      return res.redirect('/inbox/setup?error=missing_code');
    }

    const result = await handleCallback(code, state);
    res.redirect(`/inbox/setup?step=2&provider=google&email=${encodeURIComponent(result.email)}`);
  } catch (e: unknown) {
    const eMsg = e instanceof Error ? e.message : 'oauth_failed';
    logger.error('Google OAuth callback error', { error: eMsg });
    // Sanitize error — don't pass raw error messages into redirect URL
    const safeError = eMsg.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    res.redirect('/inbox/setup?error=' + encodeURIComponent(safeError));
  }
});

// POST /v1/mail/onboarding/:jobId/checks/run
router.post('/v1/mail/onboarding/:jobId/checks/run', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const validChecks = ['LIST', 'DRAFT', 'SEND_TEST', 'LABEL'];
    const requestedChecks = req.body.checks;
    if (requestedChecks && !Array.isArray(requestedChecks)) {
      return res.status(400).json({ error: 'INVALID_CHECKS', message: 'checks must be an array' });
    }
    if (requestedChecks?.some((c: string) => !validChecks.includes(c))) {
      return res.status(400).json({ error: 'INVALID_CHECK_ID', message: `Valid checks: ${validChecks.join(', ')}` });
    }
    const { runChecks } = await import('./mail/verificationService');
    const checks = await runChecks(jobId, suiteId, requestedChecks);
    res.json({ checks });
  } catch (e: unknown) { res.status(500).json({ error: 'Verification checks failed' }); }
});

// POST /v1/mail/eli/policy/apply
router.post('/v1/mail/eli/policy/apply', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { jobId, policy } = req.body;
    if (!jobId || !isValidUUID(jobId)) {
      return res.status(400).json({ error: 'INVALID_JOB_ID', message: 'Valid jobId required' });
    }
    if (!policy || typeof policy !== 'object') {
      return res.status(400).json({ error: 'INVALID_POLICY', message: 'Policy object required' });
    }
    const validKeys = ['canDraft', 'canSend', 'externalApprovalRequired', 'attachmentsAlwaysApproval', 'rateLimitPreset'];
    const policyKeys = Object.keys(policy);
    if (policyKeys.some(k => !validKeys.includes(k))) {
      return res.status(400).json({ error: 'INVALID_POLICY_KEY', message: `Valid keys: ${validKeys.join(', ')}` });
    }
    await onboarding.applyEliPolicy(jobId, suiteId, policy);

    // Law #2: Receipt for Eli mail policy application (YELLOW — governance config change)
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.eli.policy_applied',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'apply_eli_policy', job_id: jobId, policy_keys: policyKeys, risk_tier: 'YELLOW' },
      result: { applied: true },
    }).catch(() => {});

    res.json({ applied: true });
  } catch (e: unknown) { res.status(500).json({ error: 'Policy application failed' }); }
});

// POST /v1/mail/onboarding/:jobId/activate
router.post('/v1/mail/onboarding/:jobId/activate', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const jobId = requireJobId(req, res); if (!jobId) return;
    const result = await onboarding.activateOnboarding(jobId, suiteId);

    // Law #2: Receipt for mail onboarding activation (YELLOW — activating mail account)
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.activated',
      status: 'SUCCEEDED',
      actorType: 'USER',
      actorId: (req as any).authenticatedUserId || undefined,
      action: { operation: 'activate_mail_onboarding', job_id: jobId, risk_tier: 'YELLOW' },
      result: { activated: true },
    }).catch(() => {});

    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: 'Activation failed' }); }
});

// GET /v1/receipts (by jobId) — mail receipts filtered by correlation
router.get('/v1/receipts', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const receipts = await onboarding.listMailReceipts(suiteId);
    res.json({ receipts });
  } catch (e: unknown) { res.status(500).json({ error: 'Receipt retrieval failed' }); }
});

// ─── Mail Thread & Message Routes (Production) ───
// Supports both Google (Gmail API) and PolarisM (IMAP) accounts.
// Account type detected from mail_accounts/oauth_tokens, routes to correct client.

/** Load IMAP credentials for a PolarisM account */
async function loadImapCredentials(suiteId: string, accountEmail?: string): Promise<imapClient.MailAccountCredentials | null> {
  let query;
  if (accountEmail) {
    query = sql`
      SELECT email_address, encrypted_password, display_name, imap_host, imap_port, smtp_host, smtp_port
      FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND email_address = ${accountEmail} AND status = 'active' AND encrypted_password IS NOT NULL
      LIMIT 1
    `;
  } else {
    query = sql`
      SELECT email_address, encrypted_password, display_name, imap_host, imap_port, smtp_host, smtp_port
      FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND mailbox_provider = 'polaris' AND status = 'active' AND encrypted_password IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `;
  }
  const result = await db.execute(query);
  const rows = (result.rows || result) as any[];
  if (!rows.length) return null;

  const row = rows[0];
  try {
    const password = imapClient.decryptPassword(row.encrypted_password);
    return {
      email: row.email_address,
      password,
      displayName: row.display_name,
      imapHost: row.imap_host || process.env.POLARIS_IMAP_HOST || 'mail.emailarray.com',
      imapPort: row.imap_port || parseInt(process.env.POLARIS_IMAP_PORT || '993', 10),
      smtpHost: row.smtp_host || process.env.POLARIS_SMTP_HOST || 'mail.emailarray.com',
      smtpPort: row.smtp_port || parseInt(process.env.POLARIS_SMTP_PORT || '465', 10),
    };
  } catch {
    // Fail closed — can't decrypt credentials
    return null;
  }
}

/** Detect account type: 'google' or 'polaris', and load the right token/creds */
async function detectMailProvider(suiteId: string, preferredAccount?: string): Promise<'google' | 'polaris' | null> {
  if (preferredAccount) {
    // Check if it's a Google account
    const googleResult = await db.execute(sql`
      SELECT email FROM oauth_tokens
      WHERE suite_id = ${suiteId}::uuid AND provider = 'google' AND email = ${preferredAccount}
    `);
    if (((googleResult.rows || googleResult) as any[]).length > 0) return 'google';

    // Check PolarisM
    const polarisResult = await db.execute(sql`
      SELECT email_address FROM app.mail_accounts
      WHERE suite_id = ${suiteId}::uuid AND email_address = ${preferredAccount} AND status = 'active'
    `);
    if (((polarisResult.rows || polarisResult) as any[]).length > 0) return 'polaris';
    return null;
  }

  // No preferred account — check what's available, prefer PolarisM (Aspire Business Email)
  const polarisResult = await db.execute(sql`
    SELECT email_address FROM app.mail_accounts
    WHERE suite_id = ${suiteId}::uuid AND mailbox_provider = 'polaris' AND status = 'active'
    LIMIT 1
  `);
  if (((polarisResult.rows || polarisResult) as any[]).length > 0) return 'polaris';

  const googleResult = await db.execute(sql`
    SELECT email FROM oauth_tokens WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  if (((googleResult.rows || googleResult) as any[]).length > 0) return 'google';

  return null;
}

// GET /api/mail/threads — list email threads (Google or PolarisM)
router.get('/api/mail/threads', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    const account = req.query.account as string | undefined;
    const maxResults = Math.min(parseInt(req.query.limit as string || '30', 10), 100);
    const pageToken = req.query.pageToken as string | undefined;

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) {
      return res.json({ threads: [], total: 0, provider: null });
    }

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const gmailResult = await gmailClient.listThreads(accessToken, { maxResults, pageToken });

      // Fetch full thread detail for each (with messages) to build MailThread objects
      const threads = [];
      for (const t of gmailResult.threads.slice(0, maxResults)) {
        try {
          const fullThread = await gmailClient.getThread(accessToken, t.id);
          threads.push(gmailClient.gmailThreadToMailThread(fullThread, suiteId, officeId));
        } catch {
          // Skip failed threads
        }
      }

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.threads.listed',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'list_threads', count: threads.length },
        result: { threadCount: threads.length },
      }).catch(() => {});

      return res.json({ threads, total: threads.length, nextPageToken: gmailResult.nextPageToken, provider: 'google' });
    }

    // PolarisM — IMAP
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) {
      return res.json({ threads: [], total: 0, provider: 'polaris', error: 'NO_CREDENTIALS' });
    }

    const imapResult = await imapClient.listThreads(creds, suiteId, officeId, { maxResults });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.threads.listed',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'list_threads', count: imapResult.threads.length },
      result: { threadCount: imapResult.threads.length },
    }).catch(() => {});

    return res.json({ threads: imapResult.threads, total: imapResult.total, provider: 'polaris' });
  } catch (e: unknown) {
    const eMsg = e instanceof Error ? e.message : 'unknown';
    logger.error('Mail threads list error', { error: eMsg });
    res.status(500).json({ error: 'Failed to fetch threads', message: eMsg.slice(0, 200) });
  }
});

// GET /api/mail/threads/:threadId — get thread detail with messages
router.get('/api/mail/threads/:threadId', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const officeId = (req as any).authenticatedOfficeId || getDefaultOfficeId();
    const threadId = req.params.threadId as string;
    if (!threadId) return res.status(400).json({ error: 'Thread ID required' });

    const account = req.query.account as string | undefined;

    // Detect provider from thread ID prefix
    const isImapThread = threadId.startsWith('imap-');

    if (isImapThread) {
      const creds = await loadImapCredentials(suiteId, account);
      if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

      const detail = await imapClient.getThreadDetail(creds, threadId, suiteId, officeId);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.thread.read',
        status: 'SUCCEEDED',
        action: { provider: 'polaris', operation: 'get_thread', threadId },
        result: { messageCount: detail.messages.length },
      }).catch(() => {});

      return res.json(detail);
    }

    // Gmail thread
    const accessToken = await getValidToken(suiteId);
    const fullThread = await gmailClient.getThread(accessToken, threadId);
    const detail = gmailClient.gmailThreadToMailDetail(fullThread, suiteId, officeId);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.thread.read',
      status: 'SUCCEEDED',
      action: { provider: 'google', operation: 'get_thread', threadId },
      result: { messageCount: detail.messages.length },
    }).catch(() => {});

    return res.json(detail);
  } catch (e: unknown) {
    logger.error('Mail thread detail error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// POST /api/mail/messages/send — send email (YELLOW tier — external comms)
router.post('/api/mail/messages/send', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { to, subject, body, html, account, replyToMessageId } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Invalid recipient email' });
    }

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) return res.status(404).json({ error: 'No active mail account found' });

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const raw = gmailClient.buildRawMessage({ to, subject, body, html, replyToMessageId });
      const result = await gmailClient.sendMessage(accessToken, raw);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.message.sent',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'send_message', to: '<EMAIL_REDACTED>' },
        result: { sent: true, provider: 'google' },
      });

      return res.json({ sent: true, messageId: result.id, provider: 'google' });
    }

    // PolarisM — SMTP
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

    const result = await imapClient.sendMail(creds, { to, subject, body, html, replyToMessageId });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.message.sent',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'send_message', to: '<EMAIL_REDACTED>' },
      result: { sent: true, provider: 'polaris' },
    });

    return res.json({ sent: true, messageId: result.messageId, provider: 'polaris' });
  } catch (e: unknown) {
    logger.error('Mail send error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/mail/messages/draft — create draft
router.post('/api/mail/messages/draft', async (req: Request, res: Response) => {
  try {
    const suiteId = requireAuth(req, res); if (!suiteId) return;
    const { to, subject, body, html, account } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }

    const provider = await detectMailProvider(suiteId, account);
    if (!provider) return res.status(404).json({ error: 'No active mail account found' });

    if (provider === 'google') {
      const accessToken = await getValidToken(suiteId);
      const raw = gmailClient.buildRawMessage({ to, subject, body, html });
      const result = await gmailClient.createDraft(accessToken, raw);

      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.draft.created',
        status: 'SUCCEEDED',
        action: { provider: 'google', operation: 'create_draft' },
        result: { draftCreated: true },
      }).catch(() => {});

      return res.json({ created: true, draftId: result.id, provider: 'google' });
    }

    // PolarisM — IMAP APPEND to Drafts
    const creds = await loadImapCredentials(suiteId, account);
    if (!creds) return res.status(404).json({ error: 'Mail credentials not found' });

    const result = await imapClient.createDraft(creds, { to, subject, body, html });

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.draft.created',
      status: 'SUCCEEDED',
      action: { provider: 'polaris', operation: 'create_draft' },
      result: { draftCreated: true },
    }).catch(() => {});

    return res.json({ created: true, draftId: result.uid, provider: 'polaris' });
  } catch (e: unknown) {
    logger.error('Mail draft error', { error: e instanceof Error ? e.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create draft' });
  }
});

// ─── PandaDoc Webhook (Clara Legal) ───
// HMAC-verified webhook endpoint for PandaDoc document lifecycle events.
// Events: document_state_change (sent, viewed, completed, voided, declined)
// Idempotent: dedup by event_id in processed_webhooks table.

const PANDADOC_WEBHOOK_SECRET = process.env.PANDADOC_WEBHOOK_SECRET || '';

router.post('/api/webhooks/pandadoc', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-pandadoc-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    // HMAC verification (Law #3: fail closed on missing/invalid signature)
    if (!PANDADOC_WEBHOOK_SECRET) {
      logger.error('PandaDoc webhook secret not configured — rejecting (fail-closed)');
      return res.status(503).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      logger.warn('PandaDoc webhook missing X-PandaDoc-Signature header — rejecting');
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    const expected = crypto
      .createHmac('sha256', PANDADOC_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (expected.length !== signature.length ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      logger.warn('PandaDoc webhook HMAC signature mismatch — possible forgery');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const payload = req.body;
    const eventId = payload.event_id || payload.id || '';
    const eventType = payload.event || 'unknown';
    const docData = payload.data || {};
    const docId = docData.id || '';
    const docStatus = docData.status || '';

    // Extract Aspire metadata
    const metadata = docData.metadata || {};
    const suiteId = metadata.aspire_suite_id || '';
    const correlationId = metadata.aspire_correlation_id || '';

    logger.info('PandaDoc webhook received', { event: eventType, doc: docId?.substring(0, 8), status: docStatus, suite: suiteId?.substring(0, 8) });

    // Idempotency: check processed_webhooks (if DB available)
    if (db && eventId) {
      try {
        const existing = await db.execute(
          sql`SELECT event_id FROM processed_webhooks WHERE event_id = ${eventId} LIMIT 1`
        );
        if (existing.rows && existing.rows.length > 0) {
          logger.info('PandaDoc webhook duplicate event — skipping', { eventId });
          return res.status(200).json({ status: 'already_processed' });
        }

        // Mark as processed
        await db.execute(
          sql`INSERT INTO processed_webhooks (event_id, source, document_id, suite_id, processed_at)
              VALUES (${eventId}, 'pandadoc', ${docId}, ${suiteId || null}::uuid, now())
              ON CONFLICT (event_id) DO NOTHING`
        );
      } catch (dbErr: unknown) {
        // DB error shouldn't block webhook processing — log and continue
        logger.warn('PandaDoc webhook DB dedup error', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
      }
    }

    // Emit receipt for webhook event
    if (suiteId) {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: `webhook.pandadoc.${eventType}`,
        status: 'SUCCEEDED',
        action: { provider: 'pandadoc', operation: 'webhook', event: eventType },
        result: { documentId: docId, pandadocStatus: docStatus },
      }).catch(() => {});
    }

    // Advance contract state in Supabase based on PandaDoc status
    const statusToState: Record<string, string> = {
      'document.draft': 'draft',
      'document.sent': 'sent',
      'document.viewed': 'sent',
      'document.waiting_approval': 'sent',
      'document.completed': 'signed',
      'document.voided': 'expired',
      'document.declined': 'expired',
      'document.expired': 'expired',
    };
    const targetState = statusToState[docStatus];

    if (targetState && docId && suiteId && db) {
      try {
        await db.execute(
          sql`UPDATE contracts
              SET contract_state = ${targetState},
                  pandadoc_status = ${docStatus},
                  updated_at = now()
              WHERE document_id = ${docId}
              AND suite_id = ${suiteId}::uuid`
        );
        logger.info('PandaDoc webhook state advanced', { doc: docId.substring(0, 8), targetState });
      } catch (stateErr: unknown) {
        // State update failure doesn't block webhook acknowledgement
        logger.warn('PandaDoc webhook state update failed', { error: stateErr instanceof Error ? stateErr.message : 'unknown' });
      }
    }

    res.status(200).json({ status: 'received', event_id: eventId, target_state: targetState || null });
  } catch (error: unknown) {
    logger.error('PandaDoc webhook error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── PandaDoc Health Check ───
router.get('/api/health/pandadoc', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY || '';
    if (!apiKey) {
      return res.status(503).json({ status: 'unconfigured', detail: 'ASPIRE_PANDADOC_API_KEY not set' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch('https://api.pandadoc.com/public/v1/documents?count=1', {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      return res.json({ status: 'healthy', latency_ms: Date.now() });
    }
    return res.status(503).json({ status: 'unhealthy', http_status: resp.status });
  } catch (error: unknown) {
    return res.status(503).json({ status: 'unhealthy', error: error instanceof Error ? error.message : 'unknown' });
  }
});

// ─── PandaDoc Templates (Live from workspace) ───
// Proxies PandaDoc GET /templates + /templates/{id}/details.
// Any template added to the PandaDoc workspace appears here automatically.
// Clara uses the same API endpoint — single source of truth.

router.get('/api/contracts/templates', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Fetch template list from PandaDoc workspace
    const listResp = await fetch('https://api.pandadoc.com/public/v1/templates?count=100', {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!listResp.ok) {
      return res.status(listResp.status).json({ error: 'Failed to fetch templates from PandaDoc' });
    }

    const listData = await listResp.json() as { results: Array<{ id: string; name: string; date_created: string; date_modified: string; version: string }> };
    const templates = listData.results || [];

    // Fetch details for each template (tokens, fields, roles)
    // Safe for small workspace counts (<50 templates)
    const enriched = await Promise.all(
      templates.map(async (t) => {
        try {
          const detailCtrl = new AbortController();
          const detailTimeout = setTimeout(() => detailCtrl.abort(), 10000);

          const detailResp = await fetch(`https://api.pandadoc.com/public/v1/templates/${t.id}/details`, {
            headers: { 'Authorization': `API-Key ${apiKey}` },
            signal: detailCtrl.signal,
          });
          clearTimeout(detailTimeout);

          if (!detailResp.ok) {
            return {
              id: t.id,
              name: t.name,
              date_created: t.date_created,
              date_modified: t.date_modified,
              tokens: [],
              fields: [],
              roles: [],
              images: [],
              content_placeholders: [],
              has_pricing: false,
            };
          }

          const detail = await detailResp.json() as any;
          return {
            id: t.id,
            name: detail.name || t.name,
            date_created: t.date_created,
            date_modified: t.date_modified,
            tokens: (detail.tokens || []).map((tk: any) => ({ name: tk.name, value: tk.value })),
            fields: (detail.fields || []).map((f: any) => ({
              name: f.name,
              type: f.type,
              field_id: f.field_id,
              assigned_to: f.assigned_to?.name || null,
            })),
            roles: (detail.roles || []).map((r: any) => ({ id: r.id, name: r.name })),
            images: (detail.images || []).length,
            preview_image_url: detail.images?.[0]?.urls?.[0] || null,
            content_placeholders: (detail.content_placeholders || []).length,
            has_pricing: Boolean(detail.pricing?.quotes?.length),
          };
        } catch {
          // Graceful degradation — return basic info if detail fetch fails
          return {
            id: t.id,
            name: t.name,
            date_created: t.date_created,
            date_modified: t.date_modified,
            tokens: [],
            fields: [],
            roles: [],
            images: 0,
            preview_image_url: null,
            content_placeholders: 0,
            has_pricing: false,
          };
        }
      })
    );

    res.json({ templates: enriched, count: enriched.length });
  } catch (error: unknown) {
    logger.error('Contracts templates error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ─── Contract CRUD (Clara Legal — Document Hub) ───
// All routes require JWT auth + suite_id scoping (Law #6).

// GET /api/contracts — List contracts (paginated, filterable)
router.get('/api/contracts', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });

    const status = req.query.status as string || '';
    const templateKey = req.query.template_key as string || '';
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const offset = (page - 1) * limit;

    if (!db) return res.status(503).json({ error: 'Database not available' });

    let query;
    if (status && templateKey) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND contract_state = ${status} AND template_key = ${templateKey}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (status) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND contract_state = ${status}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (templateKey) {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid AND template_key = ${templateKey}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      query = sql`SELECT * FROM contracts
        WHERE suite_id = ${suiteId}::uuid
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    }

    const result = await db.execute(query);
    const contracts = result.rows || [];

    // Get total count for pagination
    const countResult = await db.execute(
      sql`SELECT COUNT(*)::int as total FROM contracts WHERE suite_id = ${suiteId}::uuid`
    );
    const total = countResult.rows?.[0]?.total || 0;

    res.json({ contracts, total, page, limit });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    console.error('[Contracts] Database query failed:', (error as Error)?.message || error);
    logger.error('Contracts list error', { error: msg });
    // Graceful degradation: contracts table doesn't exist yet (feature not launched).
    // Return empty state for ANY database error on this endpoint to prevent 500s
    // from breaking the entire Documents page.
    return res.json({ contracts: [], total: 0, page: 1, limit: 20, configured: false });
  }
});

// GET /api/contracts/:id — Contract detail + history
router.get('/api/contracts/:id', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT * FROM contracts WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const contract = result.rows[0];

    // Fetch signing sessions for this contract
    let sessions: any[] = [];
    try {
      const sessResult = await db.execute(
        sql`SELECT id, token, signer_email, signer_name, expires_at, completed_at, created_at
            FROM signing_sessions
            WHERE document_id = ${contract.document_id} AND suite_id = ${suiteId}::uuid
            ORDER BY created_at DESC`
      );
      sessions = sessResult.rows || [];
    } catch {
      // signing_sessions table may not exist yet
    }

    res.json({ contract, sessions });
  } catch (error: unknown) {
    logger.error('Contracts detail error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// POST /api/contracts/:id/send — Send document for signature
router.post('/api/contracts/:id/send', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    // Look up the contract to get document_id
    const result = await db.execute(
      sql`SELECT document_id, contract_state FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state } = result.rows[0] as any;

    // Only draft or reviewed contracts can be sent
    if (!['draft', 'reviewed'].includes(contract_state)) {
      return res.status(400).json({
        error: `Cannot send contract in state '${contract_state}'. Must be draft or reviewed.`,
      });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const message = req.body.message || 'Please review and sign this document.';
    const silent = req.body.silent !== undefined ? req.body.silent : true;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, silent }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc send failed', detail: errBody });
    }

    // Update contract state to 'sent'
    await db.execute(
      sql`UPDATE contracts SET contract_state = 'sent', pandadoc_status = 'document.sent', updated_at = now()
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid`
    );

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.send',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'send', documentId: document_id },
      result: { contractId, state: 'sent' },
    }).catch(() => {});

    res.json({ success: true, contract_state: 'sent' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract send error', { error: errorMsg });
    const sid = req.headers['x-suite-id'] as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.send',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'send' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to send contract' });
  }
});

// POST /api/contracts/:id/session — Create embedded signing session
router.post('/api/contracts/:id/session', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id, contract_state, title FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state, title } = result.rows[0] as any;

    if (contract_state !== 'sent') {
      return res.status(400).json({
        error: `Cannot create signing session for contract in state '${contract_state}'. Must be sent.`,
      });
    }

    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const signerEmail = req.body.recipient || '';
    const signerName = req.body.signer_name || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const sessionBody: any = {};
    if (signerEmail) sessionBody.recipient = signerEmail;

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc session failed', detail: errBody });
    }

    const sessionData = await resp.json();
    const sessionId = sessionData.id || '';
    const expiresAt = sessionData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Generate a secure token for the public signing URL
    const signingToken = crypto.randomUUID();

    // Store signing session in DB
    try {
      await db.execute(
        sql`INSERT INTO signing_sessions (id, token, document_id, suite_id, signer_email, signer_name, pandadoc_session_id, expires_at, created_at)
            VALUES (${crypto.randomUUID()}::uuid, ${signingToken}, ${document_id}, ${suiteId}::uuid, ${signerEmail}, ${signerName}, ${sessionId}, ${expiresAt}::timestamptz, now())`
      );
    } catch (dbErr: unknown) {
      logger.warn('Failed to store signing session', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
    }

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.session.create',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'session', documentId: document_id },
      result: { sessionId, signingToken, expiresAt },
    }).catch(() => {});

    res.json({
      session_id: sessionId,
      signing_token: signingToken,
      signing_url: `/sign/${signingToken}`,
      expires_at: expiresAt,
      document_name: title || '',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract session create error', { error: errorMsg });
    const sid = req.headers['x-suite-id'] as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.session.create',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'session.create' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to create signing session' });
  }
});

// POST /api/pandadoc/:documentId/preview — Create PandaDoc view session for document preview
// Used by Authority Queue "Review" button so user sees the REAL document before approving
router.post('/api/pandadoc/:documentId/preview', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const documentId = req.params.documentId;
    if (!documentId || documentId.length < 10) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Create a PandaDoc embedded session for the document.
    // For draft documents this gives a read-only view.
    // For sent documents this shows the document with signing fields visible but not actionable
    // unless a recipient is specified.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${documentId}/session`, {
      method: 'POST',
      headers: {
        'Authorization': `API-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      // Fallback: if session creation fails (e.g. draft status not supported),
      // try fetching document details to confirm it exists and return document info only
      if (resp.status === 409 || resp.status === 400) {
        const detailResp = await fetch(`https://api.pandadoc.com/public/v1/documents/${documentId}`, {
          headers: { 'Authorization': `API-Key ${apiKey}` },
        });
        if (detailResp.ok) {
          const doc = await detailResp.json();
          return res.json({
            session_id: null,
            fallback: true,
            document_name: doc.name || '',
            document_status: doc.status || '',
            message: 'Preview session not available for this document status. Document exists.',
          });
        }
      }
      const errBody = await resp.text();
      return res.status(resp.status).json({ error: 'PandaDoc preview session failed', detail: errBody });
    }

    const sessionData = await resp.json();
    res.json({
      session_id: sessionData.id || '',
      expires_at: sessionData.expires_at || '',
      preview_url: `https://app.pandadoc.com/s/${sessionData.id}`,
    });
  } catch (error: unknown) {
    logger.error('PandaDoc preview error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to create preview session' });
  }
});

// POST /api/contracts/:id/void — Void/cancel a document
router.post('/api/contracts/:id/void', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id, contract_state FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id, contract_state } = result.rows[0] as any;

    // Only sent contracts can be voided
    if (!['sent', 'draft', 'reviewed'].includes(contract_state)) {
      return res.status(400).json({
        error: `Cannot void contract in state '${contract_state}'.`,
      });
    }

    // Update state to expired
    await db.execute(
      sql`UPDATE contracts SET contract_state = 'expired', pandadoc_status = 'document.voided', updated_at = now()
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid`
    );

    // Emit receipt
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'contract.void',
      status: 'SUCCEEDED',
      action: { provider: 'pandadoc', operation: 'void', documentId: document_id },
      result: { contractId, state: 'expired' },
    }).catch(() => {});

    res.json({ success: true, contract_state: 'expired' });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'unknown';
    logger.error('Contract void error', { error: errorMsg });
    const sid = req.headers['x-suite-id'] as string;
    if (sid) {
      await createTrustSpineReceipt({
        suiteId: sid,
        receiptType: 'contract.void',
        status: 'FAILED',
        action: { provider: 'pandadoc', operation: 'void' },
        result: { error: errorMsg },
      }).catch(() => {});
    }
    res.status(500).json({ error: 'Failed to void contract' });
  }
});

// GET /api/contracts/:id/download — Get PandaDoc download URL
router.get('/api/contracts/:id/download', async (req: Request, res: Response) => {
  try {
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) return res.status(400).json({ error: 'Missing x-suite-id header' });
    if (!db) return res.status(503).json({ error: 'Database not available' });

    const contractId = req.params.id;
    const result = await db.execute(
      sql`SELECT document_id FROM contracts
          WHERE id = ${contractId}::uuid AND suite_id = ${suiteId}::uuid LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const { document_id } = result.rows[0] as any;
    const apiKey = process.env.ASPIRE_PANDADOC_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PandaDoc API key not configured' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`https://api.pandadoc.com/public/v1/documents/${document_id}/download`, {
      headers: { 'Authorization': `API-Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return res.status(resp.status).json({ error: 'Download not available' });
    }

    // PandaDoc returns the PDF directly — proxy it
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${contractId}.pdf"`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (error: unknown) {
    logger.error('Contract download error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to download contract' });
  }
});

// ─── Public Signing Route (NO AUTH REQUIRED) ───
// External signers access signing sessions via token — no Aspire account needed.
// Token-only access, minimal data exposure.
// Simple in-memory rate limiter for public signing route (per-IP, 20 req/min)
const signingRateLimiter = new Map<string, { count: number; resetAt: number }>();
const SIGNING_RATE_LIMIT = 20;
const SIGNING_RATE_WINDOW_MS = 60_000;

router.get('/api/signing/:token', async (req: Request, res: Response) => {
  try {
    // Rate limit by IP (Law #3: fail-closed on abuse)
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = signingRateLimiter.get(clientIp);
    if (entry && now < entry.resetAt) {
      entry.count++;
      if (entry.count > SIGNING_RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }
    } else {
      signingRateLimiter.set(clientIp, { count: 1, resetAt: now + SIGNING_RATE_WINDOW_MS });
    }

    if (!db) return res.status(503).json({ error: 'Database not available' });

    const token = req.params.token as string;
    // UUID format validation (36 chars: 8-4-4-4-12 hex)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!token || !UUID_RE.test(token)) {
      return res.status(400).json({ error: 'Invalid signing token' });
    }

    const result = await db.execute(
      sql`SELECT s.document_id, s.signer_email, s.signer_name, s.pandadoc_session_id,
                 s.expires_at, s.completed_at, s.created_at,
                 c.title as document_name
          FROM signing_sessions s
          LEFT JOIN contracts c ON c.document_id = s.document_id AND c.suite_id = s.suite_id
          WHERE s.token = ${token}
          LIMIT 1`
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Signing session not found' });
    }

    const session = result.rows[0] as any;

    // Check expiration
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Signing session expired' });
    }

    // Check if already completed
    if (session.completed_at) {
      return res.json({
        status: 'completed',
        document_name: session.document_name || 'Document',
        completed_at: session.completed_at,
      });
    }

    // Return ONLY safe data — no suite_id, no contract terms, no other signers
    res.json({
      status: 'pending',
      document_name: session.document_name || 'Document',
      signer_name: session.signer_name || '',
      pandadoc_session_id: session.pandadoc_session_id,
      expires_at: session.expires_at,
    });
  } catch (error: unknown) {
    logger.error('Signing token error', { error: error instanceof Error ? error.message : 'unknown' });
    res.status(500).json({ error: 'Failed to load signing session' });
  }
});

export default router;
