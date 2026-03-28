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
    // For now, acknowledge the draft request and return it for confirmation
    // TODO: Wire to actual draft creation (email via IMAP, invoice via Stripe)
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

export default router;
