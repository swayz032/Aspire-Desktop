/**
 * useSendMessage — Lane E6 (plan §3.9.9).
 *
 * Yellow-tier mutation. Caller is responsible for the explicit user-confirm
 * UX BEFORE invoking `sendMessage()` (Law #4). On success the hook:
 *
 *   1. Replaces the optimistic temp message in the thread cache with the
 *      server-confirmed row (so delivery_status reflects backend truth).
 *   2. Invalidates the thread-list cache so the next read reflects the new
 *      thread row + bumped activity time.
 *
 * On failure the hook flips the optimistic message's status to 'failed' so
 * the bubble shows "Failed — tap to retry" (the component already renders
 * this state via `DeliveryStatusIcon`).
 *
 * Idempotency: a fresh UUID is generated PER CALL via `crypto.randomUUID()`
 * (or a deterministic fallback on platforms without crypto). The same
 * `idempotencyKey` re-played by the server returns the same response.
 *
 * Pattern: matches the project's custom-hook approach. Returns an object
 * shaped like a React Query mutation (`mutateAsync`, `isPending`, `isError`)
 * so future migration is a one-file refactor.
 */
import { useCallback, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { sendMessage, type SendMessageResponse } from '@/lib/api/messages';
import {
  appendMessageToThread,
  replaceMessageId,
  removeMessageFromThread,
} from './useMessageThread';
import { invalidateMessageThreadsCache } from './useMessageThreads';
import type { ThreadMessage } from '@/components/messages/MessagesThreadView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendMessageInput {
  /** E.164 phone (gateway re-validates server-side). */
  phone: string;
  body: string;
  /** Optional — caller may supply if it already has a thread cached. When
   *  omitted, the server returns the canonical thread_id and we attach the
   *  optimistic message there. */
  threadId?: string;
  /** Optional — caller may pass authoring info for the optimistic bubble. */
  author?: 'owner' | 'sarah' | 'ava';
}

export interface UseSendMessageResult {
  /** Send the message + run the optimistic-update workflow. Throws on error. */
  mutateAsync: (input: SendMessageInput) => Promise<SendMessageResponse>;
  /** True while a send is in flight. */
  isPending: boolean;
  /** Last error if the latest send failed (cleared on next success). */
  error: Error | null;
  isError: boolean;
  /** Reset the error/pending state (typically called by the UI on retry). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Deterministic fallback — server enforces uniqueness as a string anyway.
  return `idem_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 14)}`;
}

function generateTempMessageId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeSegments(body: string): number {
  if (body.length === 0) return 0;
  if (body.length <= 160) return 1;
  return Math.ceil(body.length / 153);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSendMessage(): UseSendMessageResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const reset = useCallback(() => {
    if (!mountedRef.current) return;
    setError(null);
    setIsPending(false);
  }, []);

  const mutateAsync = useCallback(
    async (input: SendMessageInput): Promise<SendMessageResponse> => {
      mountedRef.current = true;
      setIsPending(true);
      setError(null);

      const idempotencyKey = generateIdempotencyKey();
      const tempId = generateTempMessageId();
      const sentAt = new Date().toISOString();
      const segs = computeSegments(input.body);

      // Optimistic append — only if we have a thread cache to attach to.
      // (When we don't have one yet, e.g. brand-new conversation from
      // NewMessageSheet, we'll attach after the server returns the canonical
      // thread_id below.)
      const targetThreadId = input.threadId ?? null;
      const optimistic: ThreadMessage = {
        message_id: tempId,
        thread_id: targetThreadId ?? '',
        direction: 'outbound',
        author: input.author ?? 'owner',
        body: input.body,
        sent_at: sentAt,
        delivery_status: 'sending',
        num_segments: segs,
      };
      if (targetThreadId) {
        appendMessageToThread(officeId, targetThreadId, optimistic);
      }

      try {
        const result = await sendMessage({
          authenticatedFetch,
          officeId,
          phone: input.phone,
          body: input.body,
          idempotencyKey,
        });

        // Replace the temp id with the server-confirmed row.
        const confirmed: ThreadMessage = {
          ...optimistic,
          thread_id: result.thread_id,
          message_id: result.message_id,
          delivery_status:
            result.status === 'sent'
              ? 'sent'
              : result.status === 'queued'
                ? 'sending'
                : 'failed',
        };

        if (targetThreadId && targetThreadId === result.thread_id) {
          // Same thread — replace in place.
          replaceMessageId(officeId, result.thread_id, tempId, confirmed);
        } else {
          // Different / unknown thread — if we attached to a temp thread cache,
          // remove it; then append to the canonical thread.
          if (targetThreadId) {
            removeMessageFromThread(officeId, targetThreadId, tempId);
          }
          appendMessageToThread(officeId, result.thread_id, confirmed);
        }

        // Invalidate thread-list cache so next read shows the new last_activity.
        invalidateMessageThreadsCache(officeId);

        if (mountedRef.current) {
          setIsPending(false);
          setError(null);
        }
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        // Flip optimistic to 'failed' so the bubble shows the retry CTA.
        if (targetThreadId) {
          appendMessageToThread(officeId, targetThreadId, {
            ...optimistic,
            delivery_status: 'failed',
          });
        }
        if (mountedRef.current) {
          setError(e);
          setIsPending(false);
        }
        throw e;
      }
    },
    [authenticatedFetch, officeId],
  );

  return {
    mutateAsync,
    isPending,
    isError: !!error,
    error,
    reset,
  };
}
