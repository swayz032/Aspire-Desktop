/**
 * LiveKit Token Route
 *
 * POST /api/livekit/token
 * Body: { roomName: string, participantName: string, suiteId?: string }
 * Returns: { token: string }
 *
 * Generates a short-lived access token for a LiveKit room.
 */
import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { logger } from '../logger';

const router = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

router.post('/api/livekit/token', async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, suiteId } = req.body;

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: 'roomName and participantName are required' });
    }

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res
        .status(500)
        .json({ error: 'Conference service not configured' });
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: '10m',
      metadata: suiteId ? JSON.stringify({ suiteId }) : undefined,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'unknown';
    logger.error('LiveKit token error', { error: msg });
    res.status(500).json({ error: msg });
  }
});

export default router;
