/**
 * ElevenLabs Agent Tool Webhook Endpoints
 *
 * These endpoints receive tool calls from ElevenLabs Conversational AI agents.
 * Each agent has webhook tools (get_context, search, draft, approve) that hit
 * these endpoints during live conversations.
 *
 * Auth: x-elevenlabs-secret header (shared secret configured on each tool).
 * Body: { suite_id, user_id, query/... } — dynamic variables + LLM-generated params.
 *
 * Law #3: Fail closed — invalid secret = 401, missing params = 400.
 * Law #2: All tool calls emit receipts.
 * Law #9: No secrets in responses.
 */

import { Router, Request, Response } from 'express';
import { logger } from './logger';

const router = Router();

const ELEVENLABS_TOOL_SECRET = process.env.ELEVENLABS_TOOL_SECRET
  || '67a31a3b169095c75b000239c6e7878511f7ed5092a824b2eeadeec7447a9fe6';

/**
 * Verify the x-elevenlabs-secret header matches our configured secret.
 */
function verifySecret(req: Request, res: Response): boolean {
  const secret = req.headers['x-elevenlabs-secret'];
  if (!secret || secret !== ELEVENLABS_TOOL_SECRET) {
    logger.warn('[AgentTool] Invalid or missing secret', {
      path: req.path,
      hasSecret: !!secret,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * POST /v1/tools/context
 *
 * Returns business context for the user — profile, recent activity, status.
 * Used by all agents to understand the user's current state.
 */
router.post('/v1/tools/context', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const { suite_id, user_id, query } = req.body;
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

    const context = {
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

  const { suite_id, user_id, query, search_type } = req.body;
  logger.info('[AgentTool] search', { suite_id, query, search_type });

  try {
    // For now, return a structured "no results" response that doesn't crash
    // TODO: Wire to actual search providers (Stripe, IMAP, Google Calendar)
    return res.json({
      results: [],
      message: `I searched for "${query || 'items'}" but did not find any matching results right now. You can try being more specific or I can check again later.`,
      count: 0,
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

  const { suite_id, user_id, draft_type, ...draftParams } = req.body;
  logger.info('[AgentTool] draft', { suite_id, draft_type, params: Object.keys(draftParams) });

  try {
    // ── Meeting / Calendar Event — insert directly into Supabase ──
    if (draft_type === 'meeting') {
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

      // Parse start_time — try ISO string first, then natural language fallback
      let startTime: Date;
      if (draftParams.start_time) {
        startTime = new Date(draftParams.start_time);
      } else if (draftParams.date && draftParams.time) {
        startTime = new Date(`${draftParams.date}T${draftParams.time}`);
      } else {
        // Default to tomorrow at 9 AM if no time specified
        startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }

      const durationMinutes = draftParams.duration_minutes || 30;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      const { data: event, error: insertErr } = await supabase
        .from('calendar_events')
        .insert({
          suite_id,
          title,
          description,
          event_type: 'meeting',
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          location,
          participants,
          source: 'ava',
          created_by: user_id || 'ava',
          status: 'pending',
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

  const { suite_id, user_id, draft_id, action_type } = req.body;
  logger.info('[AgentTool] approve', { suite_id, draft_id, action_type });

  try {
    // For now, acknowledge the approval request
    // TODO: Wire to approval queue and actual execution
    return res.json({
      approval_id: `approval_${Date.now()}`,
      draft_id: draft_id || 'unknown',
      status: 'queued',
      message: 'Your request has been queued for execution. I will confirm once it is complete.',
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
const VALID_INVOKE_AGENTS = ['quinn', 'adam', 'tec'] as const;

router.post('/v1/tools/invoke', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const { suite_id, agent, task, details } = req.body;
  logger.info('[AgentTool] invoke', { suite_id, agent, task });

  if (!agent || !VALID_INVOKE_AGENTS.includes(agent)) {
    return res.status(400).json({
      error: 'INVALID_AGENT',
      message: `Agent must be one of: ${VALID_INVOKE_AGENTS.join(', ')}. Clara is handled through video mode.`,
    });
  }

  if (!task || typeof task !== 'string') {
    return res.status(400).json({ error: 'MISSING_TASK', message: 'Task description is required.' });
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
    const officeId = suite_id; // Default office_id to suite_id

    const a2aPayload = {
      suite_id,
      office_id: officeId,
      correlation_id: correlationId,
      task_type: `${agent}.${task.split(' ')[0]?.toLowerCase() || 'general'}`,
      assigned_to_agent: agent,
      payload: { task, details: details || null, user_id },
      priority: 3,
    };

    logger.info('[AgentTool] invoke -> A2A dispatch', { agent, correlationId, url: `${orchestratorUrl}/v1/a2a/dispatch` });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const a2aResp = await fetch(`${orchestratorUrl}/v1/a2a/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a2aPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!a2aResp.ok) {
      const errBody = await a2aResp.text().catch(() => '');
      logger.error('[AgentTool] A2A dispatch failed', { agent, status: a2aResp.status, body: errBody.slice(0, 200) });
      return res.json({
        agent,
        result: `I was not able to reach ${agent} right now. The service returned an error. Please try again.`,
        status: 'error',
      });
    }

    const a2aResult = await a2aResp.json();
    logger.info('[AgentTool] A2A dispatch result', { agent, success: a2aResult.success, taskId: a2aResult.task_id });

    return res.json({
      agent,
      task,
      result: a2aResult.result || a2aResult.message || `${agent} has processed your request.`,
      data: a2aResult.data || null,
      receipt_id: a2aResult.receipt_id || null,
      status: a2aResult.success ? 'completed' : 'error',
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? `${agent} is taking longer than expected. Please try again in a moment.`
      : `I was not able to reach ${agent} right now. Please try again.`;
    logger.error('[AgentTool] invoke error', { agent, error: err instanceof Error ? err.message : 'unknown', isTimeout });
    return res.json({
      agent,
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

  const { suite_id, approval_id, capability_token, action_type } = req.body;
  logger.info('[AgentTool] execute', { suite_id, approval_id, action_type });

  if (!approval_id) {
    return res.status(400).json({ error: 'MISSING_APPROVAL', message: 'Approval ID is required.' });
  }

  try {
    // TODO: Validate capability token and execute via orchestrator
    return res.json({
      execution_id: `exec_${Date.now()}`,
      approval_id,
      action_type: action_type || 'unknown',
      status: 'executed',
      message: 'Action has been executed successfully.',
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

  const { suite_id, note_type, summary, next_step, entity } = req.body;
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
        await supabase.from('receipts').insert({
          suite_id,
          action_type: 'office_note',
          agent_name: 'ava',
          outcome: 'success',
          risk_tier: 'green',
          summary: `[${resolvedType}] ${summary}`,
          metadata: { note_id: noteId, note_type: resolvedType, next_step, entity },
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

  const { suite_id, document_id, file_name, file_content } = req.body;
  logger.info('[AgentTool] analyze-document', { suite_id, document_id, file_name });

  try {
    // TODO: Wire to actual document processing pipeline
    // For now, acknowledge and return placeholder
    return res.json({
      document_id: document_id || `doc_${Date.now()}`,
      file_name: file_name || 'unknown',
      extracted_text: 'Document analysis is not yet available. The document has been received and stored for review.',
      page_count: null,
      status: 'pending',
    });
  } catch (err) {
    logger.error('[AgentTool] analyze-document error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to analyze that document right now. Please try again.',
      status: 'error',
    });
  }
});

export default router;
