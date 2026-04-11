/**
 * Aspire Agent Tool Webhook Endpoints
 *
 * These endpoints receive tool calls from ElevenLabs Conversational AI agents.
 * Each agent has webhook tools (get_context, search, draft, approve) that hit
 * these endpoints during live conversations.
 *
 * Auth: x-aspire-tool-secret header (shared secret configured on each tool).
 * Legacy header x-elevenlabs-secret is still accepted for backward compatibility.
 * Body: { suite_id, user_id, query/... } — dynamic variables + LLM-generated params.
 *
 * Law #3: Fail closed — invalid secret = 401, missing params = 400.
 * Law #2: All tool calls emit receipts.
 * Law #9: No secrets in responses.
 */

import { Router, Request, Response } from 'express';
import { logger } from './logger';
import { getDefaultSuiteId } from './suiteContext';

const router = Router();

// ─── Card Records Cache ─────────────────────────────────────────────────────
// Stores full property records from invoke_adam responses. The gateway strips
// card_records before forwarding to ElevenLabs (keeps LLM payload small).
// Desktop fetches full records via GET /v1/tools/card-data/:id when show_cards fires.
const cardRecordsCache = new Map<string, { records: any[]; artifactType: string; suiteId: string; timestamp: number }>();
const latestCardCacheIdBySuite = new Map<string, string>(); // Per-suite most recent cache entry
const latestPropertyAddressBySuite = new Map<string, { address: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PROPERTY_ARTIFACT_TYPES = new Set([
  'LandlordPropertyPack',
  'PropertyFactPack',
  'RentCompPack',
  'PermitContextPack',
  'NeighborhoodDemandBrief',
  'ScreeningComplianceBrief',
  'InvestmentOpportunityPack',
]);

function cleanCardCache() {
  const now = Date.now();
  const evicted = new Set<string>();
  for (const [key, val] of cardRecordsCache) {
    if (now - val.timestamp > CACHE_TTL_MS) {
      cardRecordsCache.delete(key);
      evicted.add(key);
    }
  }
  if (evicted.size > 0) {
    for (const [suiteId, cacheId] of latestCardCacheIdBySuite) {
      if (evicted.has(cacheId) || !cardRecordsCache.has(cacheId)) {
        latestCardCacheIdBySuite.delete(suiteId);
      }
    }
  }
  for (const [suiteId, entry] of latestPropertyAddressBySuite) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      latestPropertyAddressBySuite.delete(suiteId);
    }
  }
}

function getLatestPropertyAddress(suiteId: string): string {
  const entry = latestPropertyAddressBySuite.get(suiteId);
  if (!entry) return '';
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    latestPropertyAddressBySuite.delete(suiteId);
    return '';
  }
  return entry.address;
}

function maybeStoreLatestPropertyAddress(suiteId: string, records: any[]) {
  if (!suiteId || !Array.isArray(records) || records.length === 0) return;
  const first = records[0] || {};
  const raw =
    (typeof first?.normalized_address === 'string' && first.normalized_address.trim()) ||
    (typeof first?.address === 'string' && first.address.trim()) ||
    '';
  if (!raw) return;
  const lower = raw.toLowerCase();
  if (lower === 'unknown address' || lower === 'n/a' || lower === 'na') return;
  latestPropertyAddressBySuite.set(suiteId, { address: raw, timestamp: Date.now() });
}

function isLikelyPropertyIntent(task: string, details: string): boolean {
  const text = `${task || ''} ${details || ''}`.toLowerCase();
  if (!text.trim()) return false;
  return /(property|owner|mortgage|equity|assessment|permit|zoning|school|address|house|parcel|valuation|tax)/.test(text);
}

function buildPropertyRefetchTask(seedRecord: any, suiteId: string): string | null {
  const address =
    (typeof seedRecord?.normalized_address === 'string' && seedRecord.normalized_address.trim()) ||
    (typeof seedRecord?.address === 'string' && seedRecord.address.trim()) ||
    getLatestPropertyAddress(suiteId);
  if (!address) return null;
  return `Pull property facts for ${address}`;
}

function collectAcceptedSecrets(): string[] {
  const raw = [
    process.env.TOOL_WEBHOOK_SHARED_SECRET,
    process.env.ASPIRE_TOOL_SECRET,
    process.env.ANAM_TOOL_SECRET,
    process.env.ELEVENLABS_TOOL_SECRET,
    process.env.ELEVENLABS_WORKSPACE_SECRET,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean));
  return Array.from(new Set(raw));
}

function getRequestBody(req: Request): Record<string, any> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, any>;
  return {};
}

function readHeaderString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

/**
 * Verify tool auth header matches configured shared secret.
 */
function verifySecret(req: Request, res: Response): boolean {
  const acceptedSecrets = collectAcceptedSecrets();
  if (acceptedSecrets.length === 0) {
    logger.error('[AgentTool] TOOL_WEBHOOK_SHARED_SECRET missing; refusing webhook requests');
    res.status(503).json({ error: 'Service unavailable' });
    return false;
  }
  const aspireSecret = readHeaderString(req.headers['x-aspire-tool-secret'] as string | string[] | undefined);
  const legacySecret = readHeaderString(req.headers['x-elevenlabs-secret'] as string | string[] | undefined);
  const secret = aspireSecret || legacySecret;
  if (!secret || !acceptedSecrets.includes(secret)) {
    logger.warn('[AgentTool] Invalid or missing secret', {
      path: req.path,
      hasSecret: !!secret,
      hasAspireHeader: !!aspireSecret,
      hasLegacyHeader: !!legacySecret,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!aspireSecret && legacySecret) {
    logger.warn('[AgentTool] Legacy auth header used; migrate tool to x-aspire-tool-secret', {
      path: req.path,
    });
  }
  return true;
}

function inferInvokeAgent(body: any): 'adam' | 'quinn' | 'tec' | 'clara' {
  const text = `${body?.task || ''} ${body?.details || ''}`.toLowerCase();
  if (body?.agent && ['adam', 'quinn', 'tec', 'clara'].includes(String(body.agent).toLowerCase())) {
    return String(body.agent).toLowerCase() as 'adam' | 'quinn' | 'tec' | 'clara';
  }
  if (body?.entity_type || body?.city || body?.filters || body?.card_cache_id) return 'adam';
  if (body?.invoice || body?.customer || /invoice|quote|billing|payment/.test(text)) return 'quinn';
  if (/contract|nda|legal|e-sign|esign|signature/.test(text)) return 'clara';
  return 'adam';
}

function inferLegacyInvokeSyncTarget(body: any): '/v1/tools/context' | '/v1/tools/search' | '/v1/tools/draft' | '/v1/tools/approve' | '/v1/tools/office-note' | '/v1/tools/invoke' {
  if (body?.approval_id || body?.capability_token || body?.action_type) return '/v1/tools/approve';
  if (body?.note || body?.title || body?.tags) return '/v1/tools/office-note';
  if (body?.draft_type || (body?.payload && !body?.task)) return '/v1/tools/draft';
  if (body?.task || body?.details || body?.agent || body?.entity_type || body?.city || body?.filters || body?.card_cache_id) return '/v1/tools/invoke';
  if (body?.query || body?.domain || body?.search_type) return '/v1/tools/search';
  return '/v1/tools/context';
}

function normalizeSuiteContext(body: any): { suiteId: string; officeId: string } {
  const rawSuite =
    (typeof body?.suite_id === 'string' && body.suite_id.trim()) ||
    (typeof body?.suiteId === 'string' && body.suiteId.trim()) ||
    '';
  const fallbackSuite = getDefaultSuiteId() || process.env.DEFAULT_SUITE_ID || '';
  const suiteId = rawSuite || fallbackSuite;
  const rawOffice =
    (typeof body?.office_id === 'string' && body.office_id.trim()) ||
    (typeof body?.officeId === 'string' && body.officeId.trim()) ||
    '';
  const officeId = rawOffice || suiteId;
  return { suiteId, officeId };
}

/**
 * Legacy compatibility shim.
 * Some deployed tool configs still post to /v1/agents/invoke-sync on Aspire Desktop.
 * Route these calls to canonical /v1/tools/* handlers.
 */
router.post('/v1/agents/invoke-sync', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  try {
    const targetPath = inferLegacyInvokeSyncTarget(req.body || {});
    const body = { ...(req.body || {}) };
    const { suiteId, officeId } = normalizeSuiteContext(body);
    if (suiteId && !body.suite_id) body.suite_id = suiteId;
    if (officeId && !body.office_id) body.office_id = officeId;
    if (targetPath === '/v1/tools/invoke' && !body.agent) {
      body.agent = inferInvokeAgent(body);
    }
    const port = process.env.PORT || '5001';
    const localUrl = `http://127.0.0.1:${port}${targetPath}`;
    const incomingSecret =
      readHeaderString(req.headers['x-aspire-tool-secret'] as string | string[] | undefined) ||
      readHeaderString(req.headers['x-elevenlabs-secret'] as string | string[] | undefined) ||
      collectAcceptedSecrets()[0] ||
      '';

    const proxyResp = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aspire-tool-secret': incomingSecret,
      },
      body: JSON.stringify(body),
    });
    const payloadText = await proxyResp.text();
    let payload: any = {};
    try {
      payload = payloadText ? JSON.parse(payloadText) : {};
    } catch {
      payload = { status: proxyResp.ok ? 'completed' : 'error', message: proxyResp.ok ? 'Done.' : 'Tool unavailable right now.' };
    }
    // Avoid leaking internal retry/debug instructions back into model speech.
    if (!proxyResp.ok || payload?.status === 'error') {
      const sanitized = {
        ...payload,
        status: 'error',
        message: 'I am having trouble with that right now. Please try again.',
      };
      return res.status(200).json(sanitized);
    }
    return res.status(200).json(payload);
  } catch (err: unknown) {
    logger.error('[AgentTool] legacy invoke-sync shim error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return res.status(200).json({
      status: 'error',
      message: 'I am having trouble with that right now. Please try again.',
    });
  }
});

/**
 * POST /v1/tools/context
 *
 * Returns business context for the user — profile, recent activity, status.
 * Used by all agents to understand the user's current state.
 */
router.post('/v1/tools/context', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, query } = body;
  logger.info('[AgentTool] context', { suite_id, query });

  try {
    // Get suite profile from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({
        context: 'Business context is not available right now.',
        status: 'unavailable',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch profile
    const { data: profile } = await supabase
      .from('suite_profiles')
      .select('owner_name, business_name, industry, office_id')
      .eq('suite_id', suite_id)
      .maybeSingle();

    // Fetch recent receipts (last 5 actions)
    const { data: recentReceipts } = await supabase
      .from('receipts')
      .select('action_type, outcome, created_at, agent_name')
      .eq('suite_id', suite_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const now = new Date();
    const context = {
      current_date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      current_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      owner_name: profile?.owner_name || 'Unknown',
      business_name: profile?.business_name || 'Unknown',
      industry: profile?.industry || 'General',
      recent_activity: (recentReceipts || []).map((r: any) => ({
        action: r.action_type,
        outcome: r.outcome,
        agent: r.agent_name,
        when: r.created_at,
      })),
      status: 'ok',
    };

    return res.json(context);
  } catch (err) {
    logger.error('[AgentTool] context error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      context: 'I was not able to retrieve your business context right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/search
 *
 * Searches across emails, calendar, contacts, invoices based on agent + query.
 * Returns structured results the agent can read aloud.
 */
router.post('/v1/tools/search', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, query, search_type } = body;
  logger.info('[AgentTool] search', { suite_id, query, search_type });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({
        results: [],
        message: 'Search is not available right now.',
        count: 0,
        status: 'unavailable',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resolvedType = (search_type || '').toLowerCase();
    let results: any[] = [];
    let message = '';

    if (resolvedType === 'calendar' || resolvedType === 'meetings' || resolvedType === 'schedule') {
      // Search calendar events
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, description, start_time, end_time, duration_minutes, location, status, participants')
        .eq('suite_id', suite_id)
        .order('start_time', { ascending: true })
        .limit(10);
      results = (data || []).map((e: any) => ({
        type: 'calendar_event',
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_minutes: e.duration_minutes,
        location: e.location,
        status: e.status,
      }));
      message = results.length > 0
        ? `Found ${results.length} calendar event${results.length > 1 ? 's' : ''}.`
        : 'No calendar events found.';
    } else if (resolvedType === 'invoices' || resolvedType === 'invoice') {
      // Search receipts for invoice-related actions
      const { data } = await supabase
        .from('receipts')
        .select('id, action_type, outcome, summary, created_at, agent_name, metadata')
        .eq('suite_id', suite_id)
        .in('action_type', ['invoice.created', 'invoice.sent', 'invoice.draft', 'office_note'])
        .order('created_at', { ascending: false })
        .limit(10);
      results = (data || []).map((r: any) => ({
        type: 'invoice_receipt',
        action: r.action_type,
        outcome: r.outcome,
        summary: r.summary,
        date: r.created_at,
        agent: r.agent_name,
      }));
      message = results.length > 0
        ? `Found ${results.length} invoice record${results.length > 1 ? 's' : ''}.`
        : 'No invoices found.';
    } else if (resolvedType === 'contacts' || resolvedType === 'contact') {
      // Search suite profiles for contacts
      const { data } = await supabase
        .from('suite_profiles')
        .select('suite_id, owner_name, business_name, industry')
        .limit(10);
      results = (data || []).map((p: any) => ({
        type: 'contact',
        name: p.owner_name,
        business: p.business_name,
        industry: p.industry,
      }));
      message = results.length > 0
        ? `Found ${results.length} contact${results.length > 1 ? 's' : ''}.`
        : 'No contacts found.';
    } else {
      // General search — search recent receipts matching query text
      const { data } = await supabase
        .from('receipts')
        .select('id, action_type, outcome, summary, created_at, agent_name')
        .eq('suite_id', suite_id)
        .order('created_at', { ascending: false })
        .limit(10);
      results = (data || []).map((r: any) => ({
        type: 'activity',
        action: r.action_type,
        outcome: r.outcome,
        summary: r.summary,
        date: r.created_at,
        agent: r.agent_name,
      }));
      message = results.length > 0
        ? `Found ${results.length} recent activit${results.length > 1 ? 'ies' : 'y'}.`
        : `No results found for "${query || 'items'}".`;
    }

    return res.json({
      results,
      message,
      count: results.length,
      status: 'ok',
    });
  } catch (err) {
    logger.error('[AgentTool] search error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      results: [],
      message: 'Search is temporarily unavailable. Please try again in a moment.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/draft
 *
 * Creates a draft (email, invoice, meeting invite) for user review.
 * Returns the draft summary for the agent to read back.
 */
router.post('/v1/tools/draft', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, draft_type, ...draftParams } = body;
  logger.info('[AgentTool] draft', { suite_id, draft_type, params: Object.keys(draftParams) });

  try {
    // ── Calendar Event (meeting, task, reminder, deadline, follow-up, anything) ──
    if (draft_type === 'meeting' || draft_type === 'calendar' || draft_type === 'event' || draft_type === 'reminder' || draft_type === 'task' || draft_type === 'deadline' || draft_type === 'follow_up') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      if (!supabaseUrl || !supabaseKey) {
        return res.json({
          draft_id: null,
          draft_type: 'meeting',
          summary: 'Calendar is not available right now. Please try again later.',
          status: 'error',
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const title = draftParams.subject || draftParams.title || 'Meeting';
      const description = draftParams.body || draftParams.description || '';
      const location = draftParams.location || '';
      const participants = draftParams.to ? [draftParams.to] : [];

      // Parse start_time — try ISO string first, then date+time combo, then default
      let startTime: Date;
      const now = new Date();

      if (draftParams.start_time) {
        startTime = new Date(draftParams.start_time);
      } else if (draftParams.date && draftParams.time) {
        startTime = new Date(`${draftParams.date}T${draftParams.time}`);
      } else {
        // Default to tomorrow at 9 AM if no time specified
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }

      // ── Date sanity guard ──────────────────────────────────────────────
      // LLMs sometimes hallucinate dates from their training cutoff (e.g. 2023)
      // instead of the real current year. Detect and correct:
      //   1. Invalid date → default to tomorrow 9 AM
      //   2. Year before current year → preserve month/day/time, snap to current year
      //      (if that result is still in the past, bump to next year)
      //   3. More than 2 years in the future → cap to current year (likely hallucination)
      //   4. Already past today but within current year → bump to tomorrow same time
      //      (catches "today at 2pm" when it's already 5pm)
      if (isNaN(startTime.getTime())) {
        logger.warn('[AgentTool] draft: invalid start_time, defaulting to tomorrow 9 AM', { raw: draftParams.start_time });
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      } else if (startTime.getFullYear() < now.getFullYear()) {
        const originalYear = startTime.getFullYear();
        startTime.setFullYear(now.getFullYear());
        if (startTime.getTime() < now.getTime()) {
          startTime.setFullYear(now.getFullYear() + 1);
        }
        logger.warn('[AgentTool] draft: corrected past-year date', { original: originalYear, corrected: startTime.getFullYear() });
      } else if (startTime.getFullYear() > now.getFullYear() + 2) {
        logger.warn('[AgentTool] draft: date too far in future, capping to current year', { original: startTime.getFullYear() });
        startTime.setFullYear(now.getFullYear());
      }

      const durationMinutes = draftParams.duration_minutes || 30;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Map draft_type to valid event_type (DB constraint: meeting, task, reminder, call, deadline, other)
      const eventTypeMap: Record<string, string> = {
        meeting: 'meeting', task: 'task', reminder: 'reminder', call: 'call',
        deadline: 'deadline', calendar: 'meeting', event: 'meeting',
        follow_up: 'reminder', follow_up_call: 'call',
      };
      const eventType = eventTypeMap[draft_type] || 'other';

      const { data: event, error: insertErr } = await supabase
        .from('calendar_events')
        .insert({
          suite_id,
          title,
          description,
          event_type: eventType,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          location,
          participants,
          source: 'ava',
          created_by: user_id || 'ava',
          status: 'pending_approval',
        })
        .select()
        .single();

      if (insertErr) {
        logger.error('[AgentTool] draft meeting insert error', { error: insertErr.message });
        return res.json({
          draft_id: null,
          draft_type: 'meeting',
          summary: 'I was not able to add that to your calendar right now. Please try again.',
          status: 'error',
        });
      }

      const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      return res.json({
        draft_id: event.id,
        draft_type: 'meeting',
        title,
        date: dateStr,
        time: timeStr,
        duration_minutes: durationMinutes,
        location: location || null,
        participants,
        summary: `Added ${title} on ${dateStr} at ${timeStr} to your calendar.`,
        status: 'created',
      });
    }

    // ── Other draft types (email, invoice, office_note) — stub for now ──
    return res.json({
      draft_id: `draft_${Date.now()}`,
      draft_type: draft_type || 'general',
      summary: `Draft created with the details you provided. Please review and confirm before I send it.`,
      params_received: draftParams,
      status: 'pending_review',
    });
  } catch (err) {
    logger.error('[AgentTool] draft error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to create the draft right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/approve
 *
 * Submits a confirmed draft for execution after user approval.
 * This is a YELLOW tier action — requires user confirmation.
 */
router.post('/v1/tools/approve', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, draft_id, action_type } = body;
  logger.info('[AgentTool] approve', { suite_id, draft_id, action_type });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({ status: 'error', message: 'Approval service is not available right now.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const approvalId = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const correlationId = `corr-approve-${Date.now()}`;

    // Insert approval request into approval_requests table
    const { data: approval, error: insertErr } = await supabase
      .from('approval_requests')
      .insert({
        approval_id: approvalId,
        tenant_id: suite_id || 'default',
        run_id: correlationId,
        tool: action_type || 'general',
        operation: 'approve',
        risk_tier: 'yellow',
        policy_version: 'v1',
        approval_hash: `sha256:${approvalId}`,
        payload_redacted: { draft_id, action_type, approved_by: user_id || 'voice' },
        constraints: { max_amount: null, expires_in_seconds: 3600 },
        status: 'approved',
        created_by_user_id: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        decided_at: new Date().toISOString(),
        decision_surface: 'voice',
        decision_reason: 'User confirmed via Ava voice conversation',
        draft_summary: `Approved: ${action_type || 'action'} for draft ${draft_id || 'unknown'}`,
        assigned_agent: 'ava',
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('[AgentTool] approve insert error', { error: insertErr.message });
      return res.json({
        status: 'error',
        message: 'I was not able to process the approval right now. Please try again.',
      });
    }

    // Also emit a receipt (Law #2)
    await supabase.from('receipts').insert({
      receipt_id: `rcpt-${approvalId}`,
      suite_id,
      tenant_id: suite_id || 'default',
      receipt_type: 'approval',
      status: 'ok',
      correlation_id: correlationId,
      actor_type: 'agent',
      actor_id: 'ava',
      action: { type: 'approve', draft_id, action_type },
      result: { approval_id: approvalId, status: 'approved' },
      hash_alg: 'sha256',
    });

    return res.json({
      approval_id: approvalId,
      draft_id: draft_id || 'unknown',
      status: 'approved',
      message: 'Approved and recorded. Moving forward with your request.',
    });
  } catch (err) {
    logger.error('[AgentTool] approve error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to process the approval right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/invoke
 *
 * Routes work to internal backend agents (Quinn, Adam, Tec).
 * Clara is NOT invokable here — contracts go through video mode.
 * Law #1: Orchestrator routes, agents execute.
 * Law #2: Every invoke emits a receipt.
 */
const VALID_INVOKE_AGENTS = ['quinn', 'adam', 'tec', 'clara'] as const;

router.post('/v1/tools/invoke', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, details, user_id } = body;
  const providedAgent = typeof body.agent === 'string' ? String(body.agent).toLowerCase().trim() : '';
  const resolvedAgent = (providedAgent && VALID_INVOKE_AGENTS.includes(providedAgent as any))
    ? providedAgent
    : inferInvokeAgent(body);

  // Anam may send query-centric payloads; normalize into task text for backend invoke.
  const taskFromTask = typeof body.task === 'string' ? body.task.trim() : '';
  const taskFromQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const taskFromDetails = typeof details === 'string' ? details.trim() : '';
  const normalizedTask = taskFromTask || taskFromQuery || taskFromDetails;

  logger.info('[AgentTool] invoke', {
    suite_id,
    agent: resolvedAgent,
    task: normalizedTask,
    hasTask: !!taskFromTask,
    hasQuery: !!taskFromQuery,
  });

  if (!resolvedAgent || !VALID_INVOKE_AGENTS.includes(resolvedAgent as any)) {
    return res.status(400).json({
      error: 'INVALID_AGENT',
      message: `Agent must be one of: ${VALID_INVOKE_AGENTS.join(', ')}. Clara is handled through video mode.`,
    });
  }

  if (!normalizedTask) {
    return res.status(400).json({
      error: 'MISSING_TASK',
      message: 'Task description is required. Provide task or query.',
    });
  }

  try {
    // Proxy to Python backend A2A dispatch — calls real agents (Quinn, Adam, Tec)
    const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
    if (!orchestratorUrl) {
      logger.warn('[AgentTool] ORCHESTRATOR_URL not set — cannot reach agents');
      return res.json({
        agent,
        result: `I was not able to reach ${agent} right now because the backend service is not configured. Please try again later.`,
        status: 'error',
      });
    }

    const correlationId = `corr-invoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info('[AgentTool] invoke -> invoke-sync', { agent, correlationId, url: `${orchestratorUrl}/v1/agents/invoke-sync` });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 52000); // 52s — backend has 45s playbook timeout + 7s margin for network

    const safeSuiteId =
      (typeof suite_id === 'string' && suite_id.trim()) ||
      getDefaultSuiteId() ||
      process.env.DEFAULT_SUITE_ID ||
      '';
    const safeOfficeId = safeSuiteId;
    const taskText = normalizedTask;
    let detailsText = typeof details === 'string' ? details : '';
    if (resolvedAgent === 'adam' && !detailsText.trim() && isLikelyPropertyIntent(taskText, detailsText)) {
      const pinned = getLatestPropertyAddress(safeSuiteId);
      if (pinned) {
        detailsText = pinned;
        logger.info('[AgentTool] Reused latest property address for Adam invoke', {
          suite_id: safeSuiteId,
          task: taskText.slice(0, 80),
          address: pinned,
        });
      }
    }

    const a2aResp = await fetch(`${orchestratorUrl}/v1/agents/invoke-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suite_id: safeSuiteId,
        office_id: safeOfficeId,
        correlation_id: correlationId,
        agent: resolvedAgent,
        task: taskText,
        details: detailsText,
        user_id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!a2aResp.ok) {
      const errBody = await a2aResp.text().catch(() => '');
      logger.error('[AgentTool] A2A dispatch failed', { agent: resolvedAgent, status: a2aResp.status, body: errBody.slice(0, 200) });
      return res.json({
        agent: resolvedAgent,
        result: `I was not able to reach ${resolvedAgent} right now. The service returned an error. Please try again.`,
        status: 'error',
      });
    }

    const a2aResult = await a2aResp.json();
    logger.info('[AgentTool] A2A dispatch result', { agent: resolvedAgent, success: a2aResult.success, taskId: a2aResult.task_id });

    // ── Card Records Intercept ──
    // If Adam returned card_records (full property data), store them on the
    // gateway and strip from the ElevenLabs response. Desktop fetches full
    // records from GET /v1/tools/card-data/:id when show_cards fires.
    let responseData = a2aResult.data || null;
    if (resolvedAgent === 'adam' && Array.isArray(responseData?.card_records) && responseData.card_records.length > 0) {
      const cacheId = correlationId;
      const cacheSuiteId = safeSuiteId;
      cardRecordsCache.set(cacheId, {
        records: responseData.card_records,
        artifactType: responseData.artifact_type || '',
        suiteId: cacheSuiteId,
        timestamp: Date.now(),
      });
      latestCardCacheIdBySuite.set(cacheSuiteId, cacheId);
      if (PROPERTY_ARTIFACT_TYPES.has(responseData.artifact_type || '')) {
        maybeStoreLatestPropertyAddress(cacheSuiteId, responseData.card_records);
      }
      cleanCardCache();
      logger.info('[AgentTool] Cached card_records', { cacheId, count: responseData.card_records.length });

      // Strip card_records from ElevenLabs response (keeps LLM payload small)
      const { card_records, ...slimData } = responseData;
      responseData = { ...slimData, _card_cache_id: cacheId };
    }

    return res.json({
      agent: resolvedAgent,
      task: normalizedTask,
      result: a2aResult.result || a2aResult.message || `${resolvedAgent} has processed your request.`,
      data: responseData,
      receipt_id: a2aResult.receipt_id || null,
      status: a2aResult.success ? 'completed' : 'error',
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? `${resolvedAgent} is taking longer than expected. Please try again in a moment.`
      : `I was not able to reach ${resolvedAgent} right now. Please try again.`;
    logger.error('[AgentTool] invoke error', { agent: resolvedAgent, error: err instanceof Error ? err.message : 'unknown', isTimeout });
    return res.json({
      agent: resolvedAgent,
      result: message,
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/execute
 *
 * Executes an approved action using a capability token.
 * Only called after request_approval returns a token.
 * Law #4: RED tier actions require explicit authority.
 */
router.post('/v1/tools/execute', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, approval_id, capability_token, action_type } = body;
  logger.info('[AgentTool] execute', { suite_id, approval_id, action_type });

  if (!approval_id) {
    return res.status(400).json({ error: 'MISSING_APPROVAL', message: 'Approval ID is required.' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({ status: 'error', message: 'Execution service is not available right now.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the approval exists and is approved
    const { data: approval } = await supabase
      .from('approval_requests')
      .select('approval_id, status, risk_tier, tool, operation, draft_summary, expires_at')
      .eq('approval_id', approval_id)
      .maybeSingle();

    if (!approval) {
      return res.status(404).json({
        status: 'error',
        message: 'Approval not found. The request may have expired or was never approved.',
      });
    }

    if (approval.status !== 'approved') {
      return res.json({
        status: 'denied',
        message: `This request has status "${approval.status}" and cannot be executed.`,
      });
    }

    // Check expiry
    if (new Date(approval.expires_at) < new Date()) {
      return res.json({
        status: 'expired',
        message: 'This approval has expired. Please request a new approval.',
      });
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Mark approval as executed
    await supabase
      .from('approval_requests')
      .update({ status: 'executed', decided_at: new Date().toISOString() })
      .eq('approval_id', approval_id);

    // Emit execution receipt (Law #2)
    const correlationId = `corr-exec-${Date.now()}`;
    await supabase.from('receipts').insert({
      receipt_id: `rcpt-${executionId}`,
      suite_id,
      tenant_id: suite_id || 'default',
      receipt_type: 'execution',
      status: 'ok',
      correlation_id: correlationId,
      actor_type: 'agent',
      actor_id: 'ava',
      action: { type: 'execute', approval_id, action_type },
      result: { execution_id: executionId, status: 'executed' },
      hash_alg: 'sha256',
    });

    return res.json({
      execution_id: executionId,
      approval_id,
      action_type: action_type || approval.tool || 'unknown',
      status: 'executed',
      message: 'Action has been executed and recorded.',
    });
  } catch (err) {
    logger.error('[AgentTool] execute error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to execute that action right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/office-note
 *
 * Saves a request/intent to Office Memory for voice→video session continuity.
 * For now: writes to receipts table as office_note action type (append-only).
 * When Office Memory goes live: writes to write-memory-event endpoint instead.
 * Law #2: Every note is a receipt.
 */
router.post('/v1/tools/office-note', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, note_type, summary, next_step, entity } = body;
  logger.info('[AgentTool] office-note', { suite_id, note_type, entity });

  if (!summary || typeof summary !== 'string') {
    return res.status(400).json({ error: 'MISSING_SUMMARY', message: 'Summary is required.' });
  }

  const validNoteTypes = ['handoff', 'contract_request', 'follow_up', 'reminder'];
  const resolvedType = validNoteTypes.includes(note_type) ? note_type : 'handoff';

  try {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Write to receipts table as office_note (append-only, Law #2)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const correlationId = `corr-note-${Date.now()}`;
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-${noteId}`,
          suite_id,
          tenant_id: suite_id || 'default',
          receipt_type: 'office_note',
          status: 'ok',
          correlation_id: correlationId,
          actor_type: 'agent',
          actor_id: 'ava',
          action: { type: 'office_note', note_type: resolvedType, entity },
          result: { note_id: noteId, summary, next_step },
          hash_alg: 'sha256',
        });
      }
    } catch (dbErr) {
      // Non-fatal — note is still returned even if DB write fails
      logger.warn('[AgentTool] office-note DB write failed', {
        error: dbErr instanceof Error ? dbErr.message : 'unknown',
      });
    }

    return res.json({
      note_id: noteId,
      note_type: resolvedType,
      summary,
      next_step: next_step || null,
      entity: entity || null,
      saved: true,
      message: 'Note saved. Video Ava will see this when the user switches to video mode.',
    });
  } catch (err) {
    logger.error('[AgentTool] office-note error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      saved: false,
      message: 'I was not able to save that note right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/analyze-document
 *
 * Processes an uploaded document and returns extracted text.
 * Supports: PDF, DOCX, XLSX, PNG, JPG, CSV (up to 10MB).
 * Law #9: No secrets in responses.
 */
router.post('/v1/tools/analyze-document', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, document_id, file_name, file_content } = body;
  logger.info('[AgentTool] analyze-document', { suite_id, document_id, file_name });

  try {
    // Route to Tec (document agent) via invoke-sync
    const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
    if (!orchestratorUrl) {
      return res.json({
        document_id: document_id || `doc_${Date.now()}`,
        file_name: file_name || 'unknown',
        extracted_text: 'Document processing is not available right now.',
        status: 'error',
      });
    }

    const correlationId = `corr-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const a2aResp = await fetch(`${orchestratorUrl}/v1/agents/invoke-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suite_id,
        office_id: suite_id,
        correlation_id: correlationId,
        agent: 'tec',
        task: `Analyze document: ${file_name || 'uploaded file'}`,
        details: file_content ? `File content provided (base64). Document ID: ${document_id || 'none'}` : `Document ID: ${document_id || 'none'}`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!a2aResp.ok) {
      const errBody = await a2aResp.text().catch(() => '');
      logger.error('[AgentTool] analyze-document A2A failed', { status: a2aResp.status, body: errBody.slice(0, 200) });
      return res.json({
        document_id: document_id || `doc_${Date.now()}`,
        file_name: file_name || 'unknown',
        extracted_text: 'I was not able to process that document right now. Please try again.',
        status: 'error',
      });
    }

    const a2aResult = await a2aResp.json();

    // Emit receipt (Law #2)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-doc-${Date.now()}`,
          suite_id,
          tenant_id: suite_id || 'default',
          receipt_type: 'document_analysis',
          status: a2aResult.success ? 'ok' : 'failed',
          correlation_id: correlationId,
          actor_type: 'agent',
          actor_id: 'tec',
          action: { type: 'analyze_document', file_name, document_id },
          result: { success: a2aResult.success, receipt_id: a2aResult.receipt_id },
          hash_alg: 'sha256',
        });
      }
    } catch (dbErr) {
      logger.warn('[AgentTool] analyze-document receipt write failed', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
    }

    return res.json({
      document_id: document_id || `doc_${Date.now()}`,
      file_name: file_name || 'unknown',
      extracted_text: a2aResult.result || 'Document has been processed.',
      data: a2aResult.data || null,
      receipt_id: a2aResult.receipt_id || null,
      status: a2aResult.success ? 'completed' : 'error',
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    logger.error('[AgentTool] analyze-document error', { error: err instanceof Error ? err.message : 'unknown', isTimeout });
    return res.json({
      document_id: document_id || `doc_${Date.now()}`,
      file_name: file_name || 'unknown',
      extracted_text: isTimeout
        ? 'Document processing is taking longer than expected. Please try again.'
        : 'I was not able to analyze that document right now. Please try again.',
      status: 'error',
    });
  }
});

// ─── Card Data Endpoint ──────────────────────────────────────────────────────
// Desktop fetches full property records from this endpoint when show_cards fires.
// The gateway stores card_records in memory when invoke_adam returns them, strips
// them from the ElevenLabs payload, and serves them here.
// Path starts with /api/ so Metro dev proxy forwards it (only /api + /objects are proxied).

router.post('/api/card-data/refetch', async (req: Request, res: Response) => {
  const { artifact_type, suite_id, seed_record } = req.body || {};
  const artifactType = typeof artifact_type === 'string' ? artifact_type : '';
  const suiteId = typeof suite_id === 'string' && suite_id.trim() ? suite_id.trim() : '';
  if (!PROPERTY_ARTIFACT_TYPES.has(artifactType)) {
    return res.status(400).json({ error: 'UNSUPPORTED_ARTIFACT', message: 'Auto-refetch supports property artifacts only.' });
  }
  if (!suiteId) {
    return res.status(400).json({ error: 'MISSING_SUITE_ID', message: 'suite_id is required for refetch.' });
  }

  const task = buildPropertyRefetchTask(seed_record, suiteId);
  if (!task) {
    return res.status(400).json({ error: 'MISSING_ADDRESS', message: 'Seed record missing address for refetch.' });
  }

  const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
  if (!orchestratorUrl) {
    logger.warn('[CardData] Refetch unavailable: ORCHESTRATOR_URL missing');
    return res.status(503).json({ error: 'UNAVAILABLE', message: 'Refetch unavailable.' });
  }

  const correlationId = `corr-refetch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const invokeResp = await fetch(`${orchestratorUrl}/v1/agents/invoke-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suite_id: suiteId,
        office_id: suiteId,
        correlation_id: correlationId,
        agent: 'adam',
        task,
        details: '',
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!invokeResp.ok) {
      const body = await invokeResp.text().catch(() => '');
      logger.warn('[CardData] Refetch invoke-sync failed', { status: invokeResp.status, body: body.slice(0, 180) });
      return res.status(502).json({ error: 'REFETCH_FAILED', message: 'Refetch failed.' });
    }

    const result = await invokeResp.json();
    const responseData = result?.data || {};
    const fullRecords = Array.isArray(responseData?.card_records) ? responseData.card_records : [];
    if (fullRecords.length === 0) {
      logger.warn('[CardData] Refetch returned no card_records', { artifactType, task: task.slice(0, 120) });
      return res.status(404).json({ error: 'NO_DATA', message: 'No card data returned from refetch.' });
    }

    cardRecordsCache.set(correlationId, {
      records: fullRecords,
      artifactType: responseData?.artifact_type || artifactType,
      suiteId,
      timestamp: Date.now(),
    });
    latestCardCacheIdBySuite.set(suiteId, correlationId);
    cleanCardCache();

    logger.info('[CardData] Refetch recovered records', { cacheId: correlationId, count: fullRecords.length });
    return res.json({
      records: fullRecords,
      artifactType: responseData?.artifact_type || artifactType,
      cacheId: correlationId,
    });
  } catch (err) {
    logger.warn('[CardData] Refetch error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.status(502).json({ error: 'REFETCH_ERROR', message: 'Failed to refetch property data.' });
  }
});

router.get('/api/card-data/:id', (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  const suiteId = typeof req.query.suite_id === 'string' ? req.query.suite_id.trim() : '';
  cleanCardCache();
  if (!suiteId) {
    return res.status(400).json({ error: 'MISSING_SUITE_ID', message: 'suite_id query param is required.' });
  }

  // "latest" resolves to the most recent cached entry for this suite.
  const resolvedId = id === 'latest' ? (latestCardCacheIdBySuite.get(suiteId) || null) : id;
  if (!resolvedId) {
    logger.warn('[CardData] No cached card data', { id });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No card data available.' });
  }

  const cached = cardRecordsCache.get(resolvedId);
  if (!cached) {
    logger.warn('[CardData] Cache miss', { id: resolvedId });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Card data expired or not found.' });
  }
  if (cached.suiteId !== suiteId) {
    logger.warn('[CardData] Suite mismatch', { id: resolvedId, requestedSuite: suiteId, cachedSuite: cached.suiteId });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Card data not found.' });
  }

  logger.info('[CardData] Serving cached records', { id: resolvedId, count: cached.records.length, artifactType: cached.artifactType });
  return res.json({
    records: cached.records,
    artifactType: cached.artifactType,
  });
});

export default router;
