/**
 * useOrchestratorChat — Shared Orchestrator Communication Hook
 *
 * Extracts the shared orchestrator fetch/response logic from:
 *   - AvaDeskPanel (fetch to /api/orchestrator/intent, ~lines 518-535, 900-960)
 *   - FinnDeskPanel (fetch to /api/orchestrator/intent, ~lines 875-915)
 *
 * Provides a clean interface for sending text to the orchestrator and
 * receiving structured responses with activity events.
 *
 * Law #1: Single Brain — all requests route through the orchestrator.
 * Law #3: Fail Closed — errors produce receipts, never silent failures.
 * Law #6: Tenant Isolation — X-Suite-Id header on every request.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  AgentId,
  AgentChatMessage,
  AgentActivityEvent,
  ActiveRun,
  OrchestratorResponse,
} from '@/components/chat/types';
import { buildActivityFromResponse } from '@/components/chat/buildActivity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseOrchestratorChatOptions {
  /** Which agent to route messages to. */
  agent: AgentId;
  /** Suite ID for tenant isolation (Law #6). */
  suiteId: string | null;
  /** JWT access token for auth (Law #3). */
  accessToken: string | undefined;
  /** Custom fetch function (e.g. authenticatedFetch). Falls back to window.fetch. */
  fetchFn?: typeof fetch;
}

interface UseOrchestratorChatReturn {
  /** Send a text message to the orchestrator. Returns the response. */
  sendMessage: (text: string) => Promise<OrchestratorResponse | null>;
  /** Whether a request is currently in flight. */
  isLoading: boolean;
  /** Last error from a failed request (cleared on next successful send). */
  error: string | null;
  /** Fetch a dynamic greeting from the orchestrator. */
  fetchGreeting: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOrchestratorChat({
  agent,
  suiteId,
  accessToken,
  fetchFn,
}: UseOrchestratorChatOptions): UseOrchestratorChatReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = fetchFn ?? fetch;

  /**
   * Send a text message to the orchestrator.
   * Returns the parsed OrchestratorResponse on success, null on failure.
   */
  const sendMessage = useCallback(
    async (text: string): Promise<OrchestratorResponse | null> => {
      if (!text.trim()) return null;

      // Abort any in-flight request (barge-in pattern)
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (suiteId) {
          headers['X-Suite-Id'] = suiteId;
        }
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const resp = await doFetch('/api/orchestrator/intent', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            agent,
            text,
            channel: 'text',
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          throw new Error(`Orchestrator returned ${resp.status}`);
        }

        const data: OrchestratorResponse = await resp.json();
        setIsLoading(false);
        return data;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Request was intentionally aborted (barge-in) — not an error
          return null;
        }
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setIsLoading(false);
        return null;
      }
    },
    [agent, suiteId, accessToken, doFetch],
  );

  /**
   * Fetch a dynamic greeting from the orchestrator.
   * Sends the special '__greeting__' intent.
   * Returns the greeting text, or null if unavailable.
   */
  const fetchGreeting = useCallback(async (): Promise<string | null> => {
    if (!suiteId || !accessToken) return null;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'Authorization': `Bearer ${accessToken}`,
      };

      const resp = await doFetch('/api/orchestrator/intent', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agent,
          text: '__greeting__',
          channel: 'chat',
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const greeting = data.response || data.text;
        if (greeting && typeof greeting === 'string') {
          return greeting;
        }
      }
    } catch {
      // Silent fail — no greeting is better than a stale one
    }
    return null;
  }, [agent, suiteId, accessToken, doFetch]);

  return {
    sendMessage,
    isLoading,
    error,
    fetchGreeting,
  };
}
