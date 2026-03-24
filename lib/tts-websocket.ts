/**
 * TtsWebSocket — Client-side multi-context WebSocket TTS manager
 *
 * Maintains a persistent WebSocket connection to the server's TTS proxy
 * for the duration of a voice session. Supports:
 *
 * - Multiple contexts for concurrent/sequential speech generation
 * - Barge-in via context close + new context creation
 * - Sentence-level flush for responsive audio
 * - Automatic audio chunk accumulation and playback
 *
 * Connection lifecycle matches voice session:
 *   startSession() → connect()
 *   sendText() → speak() + flush()
 *   user interrupts → interrupt() (close old ctx, start new)
 *   endSession() → close()
 */

import { Sentry } from '@/lib/sentry';

export interface TtsWsOptions {
  voiceId: string;
  model?: string;
  outputFormat?: string;
  /** JWT used for WS auth validation at the server edge. */
  accessToken?: string;
  /** Suite context for per-tenant WS limits and tracing. */
  suiteId?: string;
  /** Upstream voice trace id for correlation. */
  traceId?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
    speed?: number;
  };
  onAudio: (contextId: string, audioChunk: Uint8Array) => void;
  onContextDone: (contextId: string) => void;
  onConnected: () => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class TtsWebSocket {
  private ws: WebSocket | null = null;
  private voiceId: string;
  private model: string;
  private outputFormat: string;
  private accessToken?: string;
  private suiteId?: string;
  private traceId?: string;
  private voiceSettings: TtsWsOptions['voiceSettings'];
  private callbacks: TtsWsOptions;
  private contextCounter = 0;

  constructor(options: TtsWsOptions) {
    this.voiceId = options.voiceId;
    this.model = options.model || 'eleven_flash_v2_5';
    this.outputFormat = options.outputFormat || 'mp3_44100_128';
    this.accessToken = options.accessToken;
    this.suiteId = options.suiteId;
    this.traceId = options.traceId;
    this.voiceSettings = options.voiceSettings;
    this.callbacks = options;
  }

  /**
   * Connect to the TTS WebSocket proxy.
   * Resolves when the upstream ElevenLabs connection is established.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Determine the base WebSocket URL.
      // EXPO_PUBLIC_SERVER_URL is the custom server (APIs + WebSocket TTS).
      // In production: same origin (custom server serves everything on one port).
      // In dev: Metro on :5000, custom server on :5001 — must target :5001 for WS.
      let host = "";
      let protocol = "ws:";

      const serverUrl =
        process.env.EXPO_PUBLIC_SERVER_URL ||
        process.env.EXPO_PUBLIC_ORCHESTRATOR_URL ||
        process.env.ORCHESTRATOR_URL;

      if (serverUrl) {
        try {
          const parsed = new URL(serverUrl);
          host = parsed.host;
          protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
        } catch (e) {
          host = typeof window !== "undefined" ? window.location.host : "localhost:5001";
          protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
        }
      } else if (typeof window !== "undefined") {
        // Production: same origin. Dev: fallback to window.location works if
        // custom server runs on the same port (production build mode).
        host = window.location.host;
        protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      } else {
        host = "localhost:5001";
      }

      const qs = new URLSearchParams({
        voice_id: this.voiceId,
        model: this.model,
        output_format: this.outputFormat,
      });
      // Security: Never send auth token as URL query parameter (Law #9).
      // Tokens in URLs get logged by proxies, CDNs, and browser history.
      // Instead, send auth as the first WebSocket message after connection opens.
      if (this.suiteId) qs.set('suite_id', this.suiteId);
      if (this.traceId) qs.set('trace_id', this.traceId);
      if (typeof this.voiceSettings?.stability === 'number') qs.set('stability', String(this.voiceSettings.stability));
      if (typeof this.voiceSettings?.similarity_boost === 'number') qs.set('similarity_boost', String(this.voiceSettings.similarity_boost));
      if (typeof this.voiceSettings?.style === 'number') qs.set('style', String(this.voiceSettings.style));
      if (typeof this.voiceSettings?.speed === 'number') qs.set('speed', String(this.voiceSettings.speed));
      if (typeof this.voiceSettings?.use_speaker_boost === 'boolean') qs.set('use_speaker_boost', this.voiceSettings.use_speaker_boost ? 'true' : 'false');

      const url = `${protocol}//${host}/ws/tts?${qs.toString()}`;

      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        const err = new Error('TTS WebSocket connection timeout');
        Sentry.captureException(err, {
          tags: { voice_stage: 'tts', voice_code: 'WS_CONNECT_TIMEOUT', provider: 'elevenlabs' },
          extra: { url: url, voiceId: this.voiceId },
        });
        reject(err);
        this.ws?.close();
      }, 10_000);

      // On open, send auth token as first message (not in URL)
      this.ws.onopen = () => {
        if (this.accessToken && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'auth', token: this.accessToken }));
        }
      };

      // Wait for server's "connected" signal before resolving
      const onFirstMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') {
            clearTimeout(connectTimeout);
            this.ws?.removeEventListener('message', onFirstMessage);
            this.ws?.addEventListener('message', this.handleMessage);
            this.callbacks.onConnected();
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(connectTimeout);
            const connErr = new Error(data.message || 'TTS connection failed');
            Sentry.captureException(connErr, {
              tags: { voice_stage: 'tts', voice_code: 'WS_CONNECT_ERROR', provider: 'elevenlabs' },
              extra: { serverMessage: data.message, voiceId: this.voiceId },
            });
            reject(connErr);
          }
        } catch {
          // Not JSON — ignore during handshake
        }
      };

      this.ws.addEventListener('message', onFirstMessage);

      this.ws.onerror = () => {
        clearTimeout(connectTimeout);
        const wsErr = new Error('TTS WebSocket connection failed');
        Sentry.captureException(wsErr, {
          tags: { voice_stage: 'tts', voice_code: 'WS_ONERROR', provider: 'elevenlabs' },
          extra: { voiceId: this.voiceId },
        });
        reject(wsErr);
      };

      this.ws.onclose = () => {
        clearTimeout(connectTimeout);
        this.ws = null;
        this.callbacks.onClose();
      };
    });
  }

  /** Handle incoming messages from ElevenLabs (relayed through server) */
  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      // ElevenLabs may return either context_id (snake_case) or contextId (camelCase).
      const contextId: string = data.context_id || data.contextId || 'default';

      // Audio chunk — decode base64 to binary
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        this.callbacks.onAudio(contextId, bytes);
      }

      // Context generation complete
      if (data.isFinal || data.is_final || data.final) {
        this.callbacks.onContextDone(contextId);
      }

      // Server-side error
      if (data.type === 'error') {
        const streamErr = new Error(data.message || 'TTS streaming error');
        Sentry.captureException(streamErr, {
          tags: { voice_stage: 'tts', voice_code: 'WS_STREAM_ERROR', provider: 'elevenlabs' },
          extra: { contextId, serverMessage: data.message },
        });
        this.callbacks.onError(streamErr);
      }
    } catch {
      // Non-JSON message — ignore
    }
  };

  /** Generate a unique context ID for a new utterance */
  nextContextId(): string {
    return `ctx_${++this.contextCounter}_${Date.now()}`;
  }

  /** Send text to be synthesized in a specific context */
  speak(text: string, contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    // ElevenLabs docs: text "Should always end with a single space"
    // to signal the API that more text may follow in this context.
    const normalizedText = text.endsWith(' ') ? text : text + ' ';
    this.ws.send(JSON.stringify({ text: normalizedText, context_id: contextId }));
  }

  /** Force generation of any buffered text in a context */
  flush(contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ context_id: contextId, flush: true }));
  }

  /** Close a specific context — stops generation for that context */
  closeContext(contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ context_id: contextId, close_context: true }));
  }

  /** Handle barge-in: close the speaking context and start a new one */
  interrupt(oldContextId: string, newContextId: string, newText: string): void {
    this.closeContext(oldContextId);
    this.speak(newText, newContextId);
    this.flush(newContextId);
  }

  /** Keep a context alive during processing delays (resets 20s inactivity timer) */
  keepAlive(contextId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ context_id: contextId, text: '' }));
  }

  /** Close the WebSocket connection and all contexts */
  close(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ close_socket: true }));
        }
        this.ws.close();
      } catch {
        // Already closing
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
