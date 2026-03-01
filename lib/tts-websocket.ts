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

export interface TtsWsOptions {
  voiceId: string;
  model?: string;
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
  private callbacks: TtsWsOptions;
  private contextCounter = 0;

  constructor(options: TtsWsOptions) {
    this.voiceId = options.voiceId;
    this.model = options.model || 'eleven_flash_v2_5';
    this.callbacks = options;
  }

  /**
   * Connect to the TTS WebSocket proxy.
   * Resolves when the upstream ElevenLabs connection is established.
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws/tts?voice_id=${encodeURIComponent(this.voiceId)}&model=${encodeURIComponent(this.model)}`;

      this.ws = new WebSocket(url);

      const connectTimeout = setTimeout(() => {
        reject(new Error('TTS WebSocket connection timeout'));
        this.ws?.close();
      }, 10_000);

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
            reject(new Error(data.message || 'TTS connection failed'));
          }
        } catch {
          // Not JSON — ignore during handshake
        }
      };

      this.ws.addEventListener('message', onFirstMessage);

      this.ws.onerror = () => {
        clearTimeout(connectTimeout);
        reject(new Error('TTS WebSocket connection failed'));
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
      const contextId: string = data.contextId || 'default';

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
      if (data.isFinal || data.is_final) {
        this.callbacks.onContextDone(contextId);
      }

      // Server-side error
      if (data.type === 'error') {
        this.callbacks.onError(new Error(data.message || 'TTS streaming error'));
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
