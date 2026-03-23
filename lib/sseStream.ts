/**
 * Shared SSE stream reader — single source of truth for all chat surfaces.
 *
 * Canonical pattern (from Finn): split by \n, filter `data: ` prefix,
 * parse JSON, skip heartbeats. All surfaces use this instead of inline parsers.
 */

export interface SSEEvent {
  type: string;
  data?: { text?: string; media?: any[] } & Record<string, any>;
  message?: string;
  response?: string;
  text?: string;
  icon?: string;
  label?: string;
  status?: string;
  timestamp?: number;
  [key: string]: any;
}

/**
 * Extract the response text from an SSE `response` event.
 * Backend may nest it in different fields — this checks all known locations.
 */
export function extractResponseText(event: SSEEvent, fallback = ''): string {
  return event.data?.text || event.message || event.response || event.text || fallback;
}

/**
 * Extract media items from an SSE `response` event.
 */
export function extractMediaItems(event: SSEEvent): any[] {
  return Array.isArray(event.data?.media) ? event.data!.media : [];
}

/**
 * Read an SSE stream from a ReadableStream body.
 * Calls `onEvent` for each parsed event (heartbeats are filtered out).
 *
 * Usage:
 * ```ts
 * const resp = await fetch('/api/orchestrator/intent?stream=true', { ... });
 * if (!resp.ok || !resp.body) { /* handle error */ }
 * await readSSEStream(resp.body, (event) => {
 *   if (event.type === 'response') { ... }
 *   else { /* reasoning step */ }
 * });
 * ```
 */
export async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedResponse = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: SSEEvent = JSON.parse(line.slice(6));
          if (event.type === 'heartbeat') continue;
          if (event.type === 'response') receivedResponse = true;
          onEvent(event);
        } catch { /* skip malformed SSE lines */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return receivedResponse;
}
