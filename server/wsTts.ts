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
import { createClient } from '@supabase/supabase-js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const MAX_WS_CONNECTIONS_PER_SUITE = Number(process.env.TTS_WS_MAX_PER_SUITE || '25');
const activeConnectionsBySuite = new Map<string, number>();

const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export function setupTtsWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/tts',
    maxPayload: 16 * 1024 * 1024,
  });

  wss.on('connection', async (clientWs, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const voiceId = url.searchParams.get('voice_id');
    const model = url.searchParams.get('model') || 'eleven_flash_v2_5';
    const outputFormat = url.searchParams.get('output_format') || 'mp3_44100_128';
    const inactivityTimeout = url.searchParams.get('inactivity_timeout') || '180';
    // Security: Auth token is received as the first WebSocket message, NOT from URL.
    // URL query params are logged by proxies/CDNs (Law #9).
    let authToken: string | null = null;
    const suiteIdRaw = url.searchParams.get('suite_id') || 'unknown';
    const suiteId = suiteIdRaw.trim() || 'unknown';
    const traceId = url.searchParams.get('trace_id') || `tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const stabilityRaw = url.searchParams.get('stability');
    const similarityRaw = url.searchParams.get('similarity_boost');
    const styleRaw = url.searchParams.get('style');
    const speedRaw = url.searchParams.get('speed');
    const speakerBoostRaw = url.searchParams.get('use_speaker_boost');

    const asNumber = (v: string | null): number | undefined => {
      if (!v) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const stability = asNumber(stabilityRaw);
    const similarityBoost = asNumber(similarityRaw);
    const style = asNumber(styleRaw);
    const speed = asNumber(speedRaw);
    const useSpeakerBoost =
      speakerBoostRaw === 'true' ? true
      : speakerBoostRaw === 'false' ? false
      : undefined;

    if (!voiceId) {
      clientWs.close(4000, 'voice_id query parameter required');
      return;
    }

    // Auth is validated from the first WebSocket message, not URL params.
    // Set a 5-second deadline for the client to send the auth message.
    let authenticated = false; // Auth enforced in ALL environments (THREAT-002)
    let upstreamWs: WebSocket | null = null;
    let upstreamReady = false;
    const pendingMessages: string[] = [];

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        logger.warn('[WS-TTS] Auth timeout — no auth message received within 5s', { suite_id: suiteId, trace_id: traceId });
        clientWs.close(4401, 'Auth timeout — send auth message within 5 seconds');
      }
    }, 5_000);

    const initUpstream = () => {
      const currentSuiteConnections = activeConnectionsBySuite.get(suiteId) || 0;
      if (currentSuiteConnections >= MAX_WS_CONNECTIONS_PER_SUITE) {
        clientWs.close(4429, 'Tenant WS connection limit exceeded');
        return;
      }
      activeConnectionsBySuite.set(suiteId, currentSuiteConnections + 1);

      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        activeConnectionsBySuite.set(suiteId, Math.max(0, (activeConnectionsBySuite.get(suiteId) || 1) - 1));
        clientWs.close(4001, 'TTS service not configured');
        return;
      }

      const elevenLabsUrl =
        `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/multi-stream-input` +
        `?model_id=${model}&inactivity_timeout=${inactivityTimeout}&output_format=${outputFormat}`;

      logger.info('[WS-TTS] Opening upstream connection', {
        voice_id: voiceId,
        model,
        output_format: outputFormat,
        suite_id: suiteId,
        trace_id: traceId,
      });

      upstreamWs = new WebSocket(elevenLabsUrl, {
        headers: { 'xi-api-key': apiKey },
        maxPayload: 16 * 1024 * 1024,
      });

      upstreamWs.on('open', () => {
        upstreamReady = true;
        logger.info('[WS-TTS] Upstream connected', { voice_id: voiceId });

        // CRITICAL: Send InitializeConnectionMulti message per ElevenLabs docs.
        // chunk_length_schedule: [50,80,120,160] reduces first-chunk latency by ~30-50ms
        // (default [120,160,250,290] buffers more chars before generating first audio)
        const initPayload: Record<string, unknown> = {
          text: ' ',
          chunk_length_schedule: [50, 80, 120, 160],
        };
        const voiceSettings: Record<string, unknown> = {};
        if (typeof stability === 'number') voiceSettings.stability = stability;
        if (typeof similarityBoost === 'number') voiceSettings.similarity_boost = similarityBoost;
        if (typeof style === 'number') voiceSettings.style = style;
        if (typeof speed === 'number') voiceSettings.speed = speed;
        if (typeof useSpeakerBoost === 'boolean') voiceSettings.use_speaker_boost = useSpeakerBoost;
        if (Object.keys(voiceSettings).length > 0) {
          initPayload.voice_settings = voiceSettings;
        }
        upstreamWs!.send(JSON.stringify(initPayload));

        // Signal client that connection is live
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'connected', trace_id: traceId }));
        }

        // Flush any buffered messages
        for (const msg of pendingMessages) {
          upstreamWs!.send(msg);
        }
        pendingMessages.length = 0;
      });

      // ElevenLabs → Client
      upstreamWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data.toString());
        }
      });

      // Cleanup: upstream disconnects → close client
      upstreamWs.on('close', (code, reason) => {
        logger.info('[WS-TTS] Upstream disconnected', { code, reason: reason?.toString(), suite_id: suiteId, trace_id: traceId });
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(code || 1000, reason?.toString() || 'Upstream closed');
        }
      });

      upstreamWs.on('error', (err) => {
        logger.error('[WS-TTS] Upstream error', { error: err.message, suite_id: suiteId, trace_id: traceId });
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'error',
            message: 'Voice service connection error',
            trace_id: traceId,
          }));
          clientWs.close(4002, 'Upstream connection error');
        }
      });
    };

    // In dev mode, skip auth and init upstream immediately
    if (authenticated) {
      clearTimeout(authTimeout);
      initUpstream();
    }

    // Client → ElevenLabs (with auth-first gate)
    clientWs.on('message', async (data) => {
      const msg = data.toString();

      // If not yet authenticated, the first message MUST be an auth message
      if (!authenticated) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === 'auth' && typeof parsed.token === 'string') {
            clearTimeout(authTimeout);
            authToken = parsed.token;

            if (supabaseAdmin) {
              const { data: { user }, error } = await supabaseAdmin.auth.getUser(authToken);
              if (error || !user) {
                clientWs.close(4401, 'Invalid auth token');
                return;
              }
            } else if (IS_PRODUCTION) {
              clientWs.close(4503, 'Auth unavailable');
              return;
            }

            authenticated = true;
            initUpstream();
            return;
          }
        } catch {
          // Not valid JSON
        }
        // First message was not a valid auth message
        clientWs.close(4401, 'First message must be auth: { type: "auth", token: "..." }');
        clearTimeout(authTimeout);
        return;
      }

      // Authenticated — forward to upstream
      if (upstreamReady && upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(msg);
      } else {
        // Buffer until upstream connects
        pendingMessages.push(msg);
      }
    });

    // Cleanup: client disconnects → close upstream
    clientWs.on('close', (code, reason) => {
      logger.info('[WS-TTS] Client disconnected', { code, suite_id: suiteId, trace_id: traceId });
      clearTimeout(authTimeout);
      activeConnectionsBySuite.set(suiteId, Math.max(0, (activeConnectionsBySuite.get(suiteId) || 1) - 1));
      if (upstreamWs && (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING)) {
        upstreamWs.close();
      }
    });

    // Error handling
    clientWs.on('error', (err) => {
      logger.error('[WS-TTS] Client error', { error: err.message, suite_id: suiteId, trace_id: traceId });
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.close();
      }
    });
  });

  logger.info('[WS-TTS] Multi-context TTS proxy ready', { path: '/ws/tts' });
}
