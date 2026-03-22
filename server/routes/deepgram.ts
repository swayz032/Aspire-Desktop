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

router.get('/api/deepgram/token', async (req: Request, res: Response) => {
  const suiteId = (req as any).authenticatedSuiteId;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required' });
  }

  try {
    if (!DEEPGRAM_API_KEY) {
      return res
        .status(500)
        .json({ error: 'Voice transcription service not configured' });
    }

    // Create a short-lived Deepgram API key (Law #9: never expose master key to client).
    // The temporary key has write-only usage scope and expires in 60 seconds.
    const dgResponse = await fetch('https://api.deepgram.com/v1/keys', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: `aspire-stt-${suiteId}-${Date.now()}`,
        scopes: ['usage:write'],
        time_to_live_in_seconds: 60,
      }),
    });

    if (!dgResponse.ok) {
      logger.error('Deepgram temporary key creation failed', { status: dgResponse.status });
      return res.status(502).json({ error: 'Voice transcription token creation failed' });
    }

    const dgData = await dgResponse.json() as { key?: string; api_key_id?: string };
    if (!dgData.key) {
      logger.error('Deepgram temporary key response missing key field');
      return res.status(502).json({ error: 'Voice transcription token creation failed' });
    }

    res.json({
      token: dgData.key,
      url: 'wss://api.deepgram.com/v1/listen',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('Deepgram token error', { error: msg });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
