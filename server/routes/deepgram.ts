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
import { logger } from '../logger';

const router = Router();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

router.get('/api/deepgram/token', async (_req: Request, res: Response) => {
  try {
    if (!DEEPGRAM_API_KEY) {
      return res
        .status(500)
        .json({ error: 'Voice transcription service not configured' });
    }

    // For production, use Deepgram's project key API to create short-lived keys.
    // For now, return the API key directly (should be scoped/short-lived in prod).
    res.json({
      token: DEEPGRAM_API_KEY,
      url: 'wss://api.deepgram.com/v1/listen',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Deepgram token error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

export default router;
