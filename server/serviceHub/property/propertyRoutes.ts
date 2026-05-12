/**
 * Property Routes — Service Hub Phase 3, Pass 3.1.
 *
 * Express router exposing:
 *   POST /api/service-hub/property-data
 *
 * Tenant scope is enforced upstream by the global auth middleware in
 * server/index.ts (it sets req.authenticatedSuiteId / authenticatedOfficeId
 * after JWT validation). This router fails-closed when the suite_id is
 * missing (Law #6).
 */

import { Router, type Request, type Response } from 'express';
import { logger } from '../../logger';
import { aggregatePropertyData } from './propertyAggregator';
import { createReceipt } from '../../receiptService';

const router = Router();

const ADDRESS_MAX_LEN = 200;

/**
 * Truncate user-supplied address for log/receipt safety (Law #9).
 * Mirrors safeAddress() in propertyAggregator.ts.
 */
function safeAddressForLog(address: string): string {
  return address.length > 80 ? address.slice(0, 80) + '…' : address;
}

router.post('/api/service-hub/property-data', async (req: Request, res: Response) => {
  const suiteId = (req as unknown as { authenticatedSuiteId?: string }).authenticatedSuiteId;
  const officeId = (req as unknown as { authenticatedOfficeId?: string }).authenticatedOfficeId;

  if (!suiteId) {
    return res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authenticated tenant context required',
    });
  }

  const body = (req.body ?? {}) as { address?: unknown; forceRefresh?: unknown };
  const rawAddress = typeof body.address === 'string' ? body.address.trim() : '';

  if (!rawAddress) {
    return res.status(400).json({
      error: 'ADDRESS_REQUIRED',
      message: 'address is required (non-empty string)',
    });
  }
  if (rawAddress.length > ADDRESS_MAX_LEN) {
    return res.status(400).json({
      error: 'ADDRESS_TOO_LONG',
      message: `address must be <= ${ADDRESS_MAX_LEN} chars`,
    });
  }

  try {
    const result = await aggregatePropertyData(rawAddress, {
      suiteId,
      officeId,
      forceRefresh: body.forceRefresh === true,
    });

    if (result.kind === 'invalid') {
      return res.status(422).json({
        error: 'ADDRESS_INVALID',
        verdict: result.verdict,
        message:
          result.verdict.reason ??
          "Couldn't verify this address. Check the address or use manual entry.",
      });
    }

    if (result.kind === 'needs_correction') {
      return res.status(200).json(result.payload);
    }

    return res.status(200).json(result.data);
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message.slice(0, 160) : 'unknown';
    logger.error('[propertyRoutes] aggregator threw', {
      reason,
      suite_id: suiteId,
    });

    // Law #2: receipt every state-observation, including unhandled aggregator
    // exceptions. Best-effort — receipt-store failures must never block the
    // user-facing 500. Mirrors the receipt-emission pattern in
    // playbooks/trades.py:_emit_playbook_receipt.
    try {
      await createReceipt({
        suiteId,
        officeId: officeId ?? suiteId,
        actionType: 'compute_snapshot',
        status: 'FAILED',
        inputs: {
          action: 'service_hub.property_data.fetched',
          address: safeAddressForLog(rawAddress),
        },
        outputs: {
          outcome: 'failed',
          error_reason: reason,
        },
        metadata: { source: 'property_routes', risk_tier: 'green' },
      });
    } catch (receiptErr) {
      logger.warn('[propertyRoutes] failure-receipt write failed (non-fatal)', {
        reason: receiptErr instanceof Error ? receiptErr.message.slice(0, 160) : 'unknown',
      });
    }

    return res.status(500).json({
      error: 'AGGREGATOR_FAILED',
      message: 'Property data aggregation failed',
    });
  }
});

export default router;
