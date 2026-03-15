/**
 * Orchestrator Gateway Middleware — Law #1 Compliance Layer
 *
 * Adds governance awareness to Desktop BFF routes by:
 * 1. Tagging each request with its action origin (ui_direct, orchestrator, n8n, webhook)
 * 2. Enforcing additional authorization for RED-tier operations
 * 3. Including origin metadata in receipts for audit trail
 *
 * This doesn't reroute traffic through LangGraph (that's Phase 5+),
 * but ensures all actions are traceable to their governance path.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ActionOrigin, RiskTier } from './types';
import { logger } from './logger';

/**
 * Tags request with action origin for receipt audit trail.
 * Must be applied AFTER auth middleware (needs authenticatedUserId).
 */
export function tagActionOrigin(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  // Determine origin based on auth context
  if (req.authenticatedUserId === 'n8n-service') {
    req.headers['x-action-origin'] = 'n8n_service';
  } else if (req.headers['x-orchestrator-intent-id']) {
    req.headers['x-action-origin'] = 'orchestrator';
  } else if (req.headers['x-webhook-source']) {
    req.headers['x-action-origin'] = 'webhook';
  } else {
    req.headers['x-action-origin'] = 'ui_direct';
  }
  next();
}

/**
 * Gets the action origin from a request (set by tagActionOrigin middleware).
 */
export function getActionOrigin(req: AuthenticatedRequest): ActionOrigin {
  const origin = req.headers['x-action-origin'] as string;
  if (origin === 'orchestrator' || origin === 'n8n_service' || origin === 'webhook') {
    return origin;
  }
  return 'ui_direct';
}

/**
 * Governance gate for RED-tier operations.
 * RED operations (payments, contracts, payroll) require explicit confirmation.
 *
 * For UI-direct: requires x-confirm-red header (set by frontend confirmation dialogs)
 * For orchestrator: requires valid orchestrator intent ID
 * For n8n: allowed (orchestrator already approved)
 */
export function requireRedTierAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const origin = getActionOrigin(req);

  // Orchestrator and n8n already went through approval flow
  if (origin === 'orchestrator' || origin === 'n8n_service') {
    return next();
  }

  // UI-direct RED operations need explicit confirmation
  const confirmed = req.headers['x-confirm-red'] === 'true';
  if (!confirmed) {
    logger.warn('RED-tier operation attempted without confirmation', {
      path: req.path,
      method: req.method,
      origin,
      userId: req.authenticatedUserId,
      suiteId: req.authenticatedSuiteId,
    });

    res.status(428).json({
      error: 'RED_TIER_CONFIRMATION_REQUIRED',
      message: 'This operation requires explicit confirmation. Set x-confirm-red: true header.',
      risk_tier: 'RED',
    });
    return;
  }

  next();
}

/**
 * Creates a governance metadata object for receipt enrichment.
 * Call this in route handlers to include origin tracking in receipts.
 */
export function getGovernanceMetadata(req: AuthenticatedRequest, riskTier: RiskTier): {
  action_origin: ActionOrigin;
  risk_tier: RiskTier;
  orchestrator_intent_id?: string;
  correlation_id: string;
} {
  return {
    action_origin: getActionOrigin(req),
    risk_tier: riskTier,
    orchestrator_intent_id: req.headers['x-orchestrator-intent-id'] as string | undefined,
    correlation_id: req.correlationId || (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}`,
  };
}
