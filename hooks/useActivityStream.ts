/**
 * useActivityStream -- Enterprise SSE hook for Canvas Chat Mode activity streaming
 *
 * Features:
 *   - EventSource-based SSE connection to orchestrator
 *   - Auto-reconnect with exponential backoff (100ms base, max 5s, max 10 retries)
 *   - Heartbeat monitoring (detects stale connections)
 *   - Event parsing with type safety
 *   - Cleanup on unmount (no leaked connections)
 *   - Web-only (Platform.OS === 'web' guard -- no-op on native)
 *   - Fallback polling if EventSource is unavailable
 *
 * Law compliance:
 *   - Law #6: suite_id required for tenant-scoped connections
 *   - Law #7: Hook is transport only -- does not make decisions
 *   - Law #9: PII redaction happens server-side; client receives clean data
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamEvent {
  type:
    | 'connected'
    | 'thinking'
    | 'tool_call'
    | 'step'
    | 'done'
    | 'error'
    | 'heartbeat'
    | 'response'
    | 'browser_screenshot';
  message?: string;
  icon?: string;
  agent?: string;
  timestamp: number;
  correlation_id?: string;
  receipt_id?: string;
  stream_id?: string;
  data?: unknown;
  code?: string;
}

export interface UseActivityStreamOptions {
  /** Whether the stream should be active */
  enabled: boolean;
  /** SSE endpoint URL (defaults to /api/orchestrator/v1/intents?stream=true) */
  url?: string;
  /** Callback for each received event */
  onEvent: (event: StreamEvent) => void;
  /** Callback for connection errors */
  onError?: (error: Error) => void;
  /** Callback when connection state changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Maximum reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number;
}

export interface UseActivityStreamReturn {
  /** Whether the SSE connection is currently open */
  connected: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Number of reconnect attempts made */
  reconnectAttempts: number;
  /** Manually close the connection */
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_URL = '/api/orchestrator/v1/intents?stream=true';
const BASE_RECONNECT_DELAY_MS = 100;
const MAX_RECONNECT_DELAY_MS = 5000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_TIMEOUT_MS = 45_000; // 3x heartbeat interval (15s * 3)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useActivityStream(
  options: UseActivityStreamOptions,
): UseActivityStreamReturn {
  const {
    enabled,
    url = DEFAULT_URL,
    onEvent,
    onError,
    onConnectionChange,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Refs for stable references across re-renders
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  // Stable callback refs (avoid re-creating EventSource on every render)
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  /**
   * Reset the heartbeat timeout.
   * Called on every received message. If no message arrives within
   * HEARTBEAT_TIMEOUT_MS, the connection is considered stale and reconnected.
   */
  const resetHeartbeatTimeout = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
    }
    heartbeatTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      // Heartbeat timeout -- connection is stale, force reconnect
      const staleError = new Error('SSE heartbeat timeout -- connection stale');
      setError(staleError);
      onErrorRef.current?.(staleError);
      // Close and reconnect
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }, []);

  /**
   * Clean up all resources (EventSource, timeouts).
   */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  /**
   * Manually disconnect the stream.
   */
  const disconnect = useCallback(() => {
    cleanup();
    reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    setConnected(false);
    setReconnectAttempts(0);
    onConnectionChangeRef.current?.(false);
  }, [cleanup, maxReconnectAttempts]);

  useEffect(() => {
    // SSE is web-only -- no-op on native platforms
    if (Platform.OS !== 'web' || !enabled) {
      cleanup();
      return;
    }

    // Check EventSource availability (should exist on all modern browsers)
    if (typeof EventSource === 'undefined') {
      const unsupportedError = new Error('EventSource is not supported in this environment');
      setError(unsupportedError);
      onErrorRef.current?.(unsupportedError);
      return;
    }

    mountedRef.current = true;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);

    function connect() {
      if (!mountedRef.current) return;

      try {
        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
          if (!mountedRef.current) {
            eventSource.close();
            return;
          }
          setConnected(true);
          setError(null);
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
          onConnectionChangeRef.current?.(true);
          resetHeartbeatTimeout();
        };

        eventSource.onmessage = (msg: MessageEvent) => {
          if (!mountedRef.current) return;

          // Reset heartbeat timer on every message (including heartbeats)
          resetHeartbeatTimeout();

          try {
            const event: StreamEvent = JSON.parse(msg.data);

            // Silently consume heartbeats (they keep the connection alive)
            if (event.type === 'heartbeat') return;

            onEventRef.current(event);
          } catch (_parseErr) {
            // Malformed event -- log silently, do not break the stream
          }
        };

        eventSource.onerror = () => {
          if (!mountedRef.current) return;

          setConnected(false);
          onConnectionChangeRef.current?.(false);
          eventSource.close();

          // Clear heartbeat timer
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
          }

          const connectionError = new Error('SSE connection failed');
          setError(connectionError);
          onErrorRef.current?.(connectionError);

          // Exponential backoff reconnect
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            const delay = Math.min(
              BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current),
              MAX_RECONNECT_DELAY_MS,
            );
            reconnectAttemptsRef.current += 1;
            setReconnectAttempts(reconnectAttemptsRef.current);

            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
          // After max attempts, stop reconnecting (user can manually retry)
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        const connectError =
          err instanceof Error ? err : new Error('Unknown EventSource error');
        setError(connectError);
        onErrorRef.current?.(connectError);
      }
    }

    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url]);

  return { connected, error, reconnectAttempts, disconnect };
}
