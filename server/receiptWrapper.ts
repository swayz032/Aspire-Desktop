/**
 * Receipt Wrapper — Enterprise Remediation Wave 5 (D-C14).
 *
 * Utility to add receipt generation to Express route handlers that currently
 * lack it. Wraps any handler with automatic receipt creation on success or
 * failure, ensuring Law #2 compliance (No Action Without Receipt).
 *
 * Usage:
 *   import { withReceipt } from './receiptWrapper';
 *
 *   router.post('/api/stripe/invoices', withReceipt('stripe.invoice.create', 'YELLOW', async (req, res) => {
 *     // ... existing handler logic ...
 *     return { success: true, data: invoice }; // receipt auto-generated
 *   }));
 */

import { Request, Response, RequestHandler } from 'express';
import { createTrustSpineReceipt, ReceiptStatus } from './receiptService';
import { logger } from './logger';

type RiskTier = 'GREEN' | 'YELLOW' | 'RED';

interface ReceiptResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  statusCode?: number;
}

type WrappedHandler = (req: Request, res: Response) => Promise<ReceiptResult | void>;

/**
 * Wraps an Express route handler with automatic receipt generation.
 *
 * On success: creates a SUCCEEDED receipt with the handler's return data.
 * On failure: creates a FAILED receipt with the error details.
 * If the handler sends its own response (returns void), receipt is still created.
 */
export function withReceipt(
  receiptType: string,
  riskTier: RiskTier,
  handler: WrappedHandler,
): RequestHandler {
  return async (req: Request, res: Response) => {
    const suiteId = (req.headers['x-suite-id'] as string) || '';
    const officeId = (req.headers['x-office-id'] as string) || undefined;
    const actorId = (req.headers['x-actor-id'] as string) || req.headers['x-user-id'] as string || 'unknown';
    const correlationId = (req.headers['x-correlation-id'] as string) || `corr_${Date.now()}`;

    if (!suiteId) {
      logger.warn('Missing x-suite-id for receipted route', { receiptType, path: req.path });
      // Fail closed (Law #3) — no suite_id means we can't scope the receipt
      try {
        await createTrustSpineReceipt({
          suiteId: 'UNKNOWN',
          receiptType,
          status: 'DENIED',
          correlationId,
          actorType: 'USER',
          actorId,
          action: { method: req.method, path: req.path, risk_tier: riskTier },
          result: { error: 'MISSING_SUITE_ID', message: 'x-suite-id header required' },
        });
      } catch {
        // Receipt creation itself failed — log but don't block the deny
      }
      res.status(403).json({ error: 'MISSING_SUITE_ID', message: 'x-suite-id header required' });
      return;
    }

    let status: ReceiptStatus = 'SUCCEEDED';
    let resultData: Record<string, unknown> = {};
    let statusCode = 200;

    try {
      const result = await handler(req, res);

      if (result) {
        status = result.success ? 'SUCCEEDED' : 'FAILED';
        resultData = result.data || {};
        statusCode = result.statusCode || (result.success ? 200 : 500);
        if (result.error) resultData.error = result.error;

        if (!res.headersSent) {
          res.status(statusCode).json(result.success ? { success: true, ...result.data } : { error: result.error || 'UNKNOWN_ERROR' });
        }
      }
      // If handler returned void, it already sent its own response
    } catch (error: unknown) {
      status = 'FAILED';
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      resultData = { error: errMsg };
      statusCode = 500;
      logger.error(`Handler error: ${receiptType}`, { error: errMsg, path: req.path });

      if (!res.headersSent) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
      }
    }

    // Always generate receipt (Law #2)
    try {
      await createTrustSpineReceipt({
        suiteId,
        officeId,
        receiptType,
        status,
        correlationId,
        actorType: 'USER',
        actorId,
        action: {
          method: req.method,
          path: req.path,
          risk_tier: riskTier,
          // Redact sensitive params — never log full request bodies (Law #9)
          params: req.params,
        },
        result: resultData,
      });
    } catch (receiptError) {
      // Receipt creation failed — this is critical but don't crash the request
      logger.error('Receipt creation failed (Law #2 violation)', {
        receiptType,
        error: receiptError instanceof Error ? receiptError.message : 'unknown',
      });
    }
  };
}
