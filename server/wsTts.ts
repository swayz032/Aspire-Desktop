/**
 * WebSocket TTS Proxy — Multi-Context ElevenLabs Streaming
 *
 * Proxies client WebSocket connections to ElevenLabs multi-context
 * TTS API. API key stays server-side (Law #9: never expose secrets).
 *
 * Each client connection gets its own upstream ElevenLabs WebSocket.
 * Supports up to 5 concurrent contexts per connection for barge-in
 * and overlapping speech generation.
 *
 * Client → /ws/tts?voice_id=X&model=Y → Server → ElevenLabs multi-stream-input
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { logger } from './logger';

export function setupTtsWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/tts',
    maxPayload: 16 * 1024 * 1024,
  });

  wss.on('connection', (clientWs, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const voiceId = url.searchParams.get('voice_id');
    const model = url.searchParams.get('model') || 'eleven_flash_v2_5';
    const inactivityTimeout = url.searchParams.get('inactivity_timeout') || '180';

    if (!voiceId) {
      clientWs.close(4000, 'voice_id query parameter required');
      return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      clientWs.close(4001, 'TTS service not configured');
      return;
    }

    const elevenLabsUrl =
      `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/multi-stream-input` +
      `?model_id=${model}&inactivity_timeout=${inactivityTimeout}`;

    logger.info('[WS-TTS] Opening upstream connection', { voice_id: voiceId, model });

    const upstreamWs = new WebSocket(elevenLabsUrl, {
      headers: { 'xi-api-key': apiKey },
      maxPayload: 16 * 1024 * 1024,
    });

    let upstreamReady = false;
    // Buffer client messages sent before upstream connects
    const pendingMessages: string[] = [];

    upstreamWs.on('open', () => {
      upstreamReady = true;
      logger.info('[WS-TTS] Upstream connected', { voice_id: voiceId });

      // Signal client that connection is live
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'connected' }));
      }

      // Flush any buffered messages
      for (const msg of pendingMessages) {
        upstreamWs.send(msg);
      }
      pendingMessages.length = 0;
    });

    // Client → ElevenLabs
    clientWs.on('message', (data) => {
      const msg = data.toString();
      if (upstreamReady && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(msg);
      } else {
        // Buffer until upstream connects
        pendingMessages.push(msg);
      }
    });

    // ElevenLabs → Client
    upstreamWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data.toString());
      }
    });

    // Cleanup: client disconnects → close upstream
    clientWs.on('close', (code, reason) => {
      logger.info('[WS-TTS] Client disconnected', { code });
      if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
        upstreamWs.close();
      }
    });

    // Cleanup: upstream disconnects → close client
    upstreamWs.on('close', (code, reason) => {
      logger.info('[WS-TTS] Upstream disconnected', { code, reason: reason?.toString() });
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code || 1000, reason?.toString() || 'Upstream closed');
      }
    });

    // Error handling
    clientWs.on('error', (err) => {
      logger.error('[WS-TTS] Client error', { error: err.message });
      if (upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.close();
      }
    });

    upstreamWs.on('error', (err) => {
      logger.error('[WS-TTS] Upstream error', { error: err.message });
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'error',
          message: 'Voice service connection error',
        }));
        clientWs.close(4002, 'Upstream connection error');
      }
    });
  });

  logger.info('[WS-TTS] Multi-context TTS proxy ready', { path: '/ws/tts' });
}
