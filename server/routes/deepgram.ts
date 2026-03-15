/**
 * Deepgram Token Route
 *
 * GET /api/deepgram/token
 * Returns: { token: string, url: string }
 *
 * Provides a short-lived Deepgram API key for client-side WebSocket STT.
 * The client uses Nova-3 model for real-time transcription.
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';

const router = Router();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

router.get('/api/deepgram/token', async (req: Request, res: Response) => {
  const suiteId = req.authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  try {
    if (!DEEPGRAM_API_KEY) {
      return res
        .status(500)
        .json({ error: 'SERVICE_UNAVAILABLE', code: 'SERVICE_UNAVAILABLE' });
    }

    // For production, use Deepgram's project key API to create short-lived keys.
    // For now, return the API key directly (should be scoped/short-lived in prod).
    res.json({
      token: DEEPGRAM_API_KEY,
      url: 'wss://api.deepgram.com/v1/listen',
    });
  } catch (error: unknown) {
    const correlationId = crypto.randomUUID();
    logger.error('Deepgram token error', { error: error instanceof Error ? error.message : String(error), correlationId });
    res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', correlationId });
  }
});

export default router;
