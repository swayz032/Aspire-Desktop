/**
 * AspireChatTransport — Custom Vercel AI SDK transport for the Aspire orchestrator.
 *
 * Maps our SSE protocol (activity/response/done/error events) to the AI SDK
 * UIMessageChunk stream format (reasoning/text/finish chunks).
 *
 * This is the canonical transport for ALL Aspire chat surfaces.
 * AvaDeskPanel is the reference consumer; Finn/Eli/etc. use the same transport.
 */

import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { readSSEStream, extractResponseText, extractMediaItems, type SSEEvent } from './sseStream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Resolvable<T> = T | (() => T) | (() => Promise<T>);

export interface AspireChatTransportOptions {
  /** API endpoint (default: /api/orchestrator/intent?stream=true). */
  api?: string;
  /** Dynamic headers (e.g. auth token, suite ID). */
  headers?: Resolvable<Record<string, string>>;
  /** Extra body fields merged into each request. */
  body?: Resolvable<Record<string, unknown>>;
  /** Custom fetch (e.g. expo/fetch for React Native). */
  fetch?: typeof globalThis.fetch;
  /** Called when response text arrives — use for Anam TTS piping. */
  onResponseText?: (text: string, media: unknown[]) => void;
  /** Called on orchestrator error with the raw message — return user-friendly text. */
  mapError?: (rawMessage: string) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolve<T>(value: Resolvable<T>): Promise<T> {
  return typeof value === 'function' ? await (value as () => T | Promise<T>)() : value;
}

let _reasoningIdCounter = 0;
function nextReasoningId(): string {
  return `reasoning_${Date.now()}_${++_reasoningIdCounter}`;
}

let _textIdCounter = 0;
function nextTextId(): string {
  return `text_${Date.now()}_${++_textIdCounter}`;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export class AspireChatTransport implements ChatTransport<UIMessage> {
  private api: string;
  private headersResolver: Resolvable<Record<string, string>>;
  private bodyResolver: Resolvable<Record<string, unknown>>;
  private fetchFn: typeof globalThis.fetch;
  private onResponseText?: (text: string, media: unknown[]) => void;
  private mapError?: (rawMessage: string) => string;

  constructor(options: AspireChatTransportOptions = {}) {
    this.api = options.api ?? '/api/orchestrator/intent?stream=true';
    this.headersResolver = options.headers ?? {};
    this.bodyResolver = options.body ?? {};
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.onResponseText = options.onResponseText;
    this.mapError = options.mapError;
  }

  async sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;

    // Extract the last user message text
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const userText = lastUserMsg?.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n') || '';

    // Build conversation history from recent messages (for orchestrator context)
    const conversationHistory = messages.slice(-10).map((m) => ({
      from: m.role === 'user' ? 'user' : 'ava',
      text: m.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join(' '),
    }));

    // Resolve dynamic headers and body
    const [resolvedHeaders, resolvedBody] = await Promise.all([
      resolve(this.headersResolver),
      resolve(this.bodyResolver),
    ]);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...resolvedHeaders,
    };

    const body = JSON.stringify({
      agent: 'ava',
      text: userText,
      channel: 'text',
      context: {
        conversationHistory,
      },
      ...resolvedBody,
    });

    // Make the request
    const response = await this.fetchFn(this.api, {
      method: 'POST',
      headers,
      body,
      signal: abortSignal,
    });

    if (!response.ok || !response.body) {
      let errorText = `Orchestrator returned ${response.status}`;
      try {
        const errorBody = await response.json();
        errorText =
          errorBody?.response ||
          errorBody?.text ||
          errorBody?.message ||
          errorText;
        if (errorBody?.error_code || errorBody?.error) {
          errorText = `${errorBody.error_code || errorBody.error}: ${errorText}`;
        }
      } catch {
        // ignore JSON parse failure
      }

      const userMessage = this.mapError
        ? this.mapError(errorText)
        : errorText;

      // Return a stream with an error-as-text (Ava says the error message)
      return this._createErrorAsTextStream(userMessage);
    }

    // Convert SSE stream to UIMessageChunk stream
    return this._createUIMessageStream(response.body);
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null; // Aspire doesn't support stream reconnection
  }

  // ---------------------------------------------------------------------------
  // SSE → UIMessageChunk stream conversion
  // ---------------------------------------------------------------------------

  private _createUIMessageStream(
    sseBody: ReadableStream<Uint8Array>,
  ): ReadableStream<UIMessageChunk> {
    const onResponseText = this.onResponseText;
    const mapError = this.mapError;

    return new ReadableStream<UIMessageChunk>({
      async start(controller) {
        // Emit stream start
        controller.enqueue({ type: 'start' });

        let hasEmittedText = false;

        const handleEvent = (event: SSEEvent) => {
          if (event.type === 'response') {
            // Response → text part
            const responseText = extractResponseText(event, '');
            const mediaItems = extractMediaItems(event);

            if (responseText) {
              const textId = nextTextId();
              controller.enqueue({ type: 'text-start', id: textId });
              controller.enqueue({
                type: 'text-delta',
                id: textId,
                delta: responseText,
              });
              controller.enqueue({ type: 'text-end', id: textId });
              hasEmittedText = true;

              // Pipe to Anam TTS if configured
              onResponseText?.(responseText, mediaItems);
            }
          } else if (event.type === 'error') {
            // Error event → emit as text (Ava says the error message)
            const rawMessage = event.message || event.text || 'Something went wrong';
            const userMessage = mapError ? mapError(rawMessage) : rawMessage;
            const textId = nextTextId();
            controller.enqueue({ type: 'text-start', id: textId });
            controller.enqueue({
              type: 'text-delta',
              id: textId,
              delta: userMessage,
            });
            controller.enqueue({ type: 'text-end', id: textId });
            hasEmittedText = true;
          } else if (event.type === 'done') {
            // Done event — no action needed, finish is emitted after stream ends
          } else {
            // Activity/step/thinking/tool_call events → reasoning parts
            const label =
              event.message || event.label || event.type || 'Processing...';
            const reasoningId = nextReasoningId();
            controller.enqueue({ type: 'reasoning-start', id: reasoningId });
            controller.enqueue({
              type: 'reasoning-delta',
              id: reasoningId,
              delta: label,
            });
            controller.enqueue({ type: 'reasoning-end', id: reasoningId });
          }
        };

        try {
          await readSSEStream(sseBody, handleEvent);
        } catch (err) {
          const rawMessage =
            err instanceof Error ? err.message : String(err);
          const userMessage = mapError ? mapError(rawMessage) : rawMessage;

          if (!hasEmittedText) {
            const textId = nextTextId();
            controller.enqueue({ type: 'text-start', id: textId });
            controller.enqueue({
              type: 'text-delta',
              id: textId,
              delta: userMessage,
            });
            controller.enqueue({ type: 'text-end', id: textId });
          }
        }

        // Emit finish
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });
  }

  private _createErrorAsTextStream(
    message: string,
  ): ReadableStream<UIMessageChunk> {
    return new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: 'start' });
        const textId = nextTextId();
        controller.enqueue({ type: 'text-start', id: textId });
        controller.enqueue({ type: 'text-delta', id: textId, delta: message });
        controller.enqueue({ type: 'text-end', id: textId });
        controller.enqueue({ type: 'finish', finishReason: 'stop' });
        controller.close();
      },
    });
  }
}
