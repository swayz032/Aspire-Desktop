/**
 * useAvaChat — Aspire's canonical chat hook wrapping Vercel AI SDK useChat.
 *
 * This is the source of truth for all Aspire agent chat surfaces.
 * AvaDeskPanel consumes this directly; other panels adapt it.
 *
 * Features:
 * - Tenant-isolated headers (Law #6)
 * - Auth token injection
 * - User profile context for personalization
 * - Error mapping to conversational messages
 * - Anam TTS callback
 */

import { useCallback, useMemo, useRef } from 'react';
import { useChat, type UseChatOptions } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { AspireChatTransport } from '@/lib/aspire-chat-transport';
import { useSupabase, useTenant } from '@/providers';

// ---------------------------------------------------------------------------
// Error mapping — conversational, not generic (Law #3)
// ---------------------------------------------------------------------------

function mapOrchestratorError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();

  if (/401|auth_required|expired|unauthorized/.test(lower))
    return 'My session expired. Please sign in again so I can help you.';
  if (/model_unavailable/.test(lower))
    return "I'm having trouble reaching my AI service right now. Give me a moment and try again.";
  if (/checkpointer_unavailable/.test(lower))
    return "My memory service is temporarily down. I'll still try to help — just might not remember earlier context.";
  if (/provider_auth_missing|auth_invalid_key|invalid_key/.test(lower))
    return 'A required provider connection is missing or expired. Check your connected services in settings.';
  if (/provider_all_failed/.test(lower))
    return "All my research providers failed on this one. Try a narrower query or give me a moment.";
  if (/param_extraction_failed/.test(lower))
    return rawMessage.replace(/^param_extraction_failed:\s*/i, '');
  if (/routing_denied/.test(lower))
    return "I couldn't route that to any of my specialists. Could you rephrase what you need?";
  if (/upstream_timeout|orchestrator_timeout|timeout|abort/.test(lower))
    return "That's taking longer than expected. Let me try again — sometimes the AI service needs a moment.";
  if (/orchestrator_unavailable|circuit_open|503|unavailable|circuit/.test(lower))
    return "I'm temporarily unavailable. Give me a moment and try again.";

  // Truncate unknown errors
  const clean = rawMessage.length > 140 ? `${rawMessage.slice(0, 140)}...` : rawMessage;
  return `Something went wrong on my end: ${clean}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseAvaChatOptions {
  /** Active voice session — passed to avoid double-hook overhead. */
  avaVoice?: unknown;
  /** Called when response text arrives — pipe to Anam TTS. */
  onResponseText?: (text: string, media: unknown[]) => void;
  /** Called when response contains structured_results (Adam research data).
   *  Fallback for when ElevenLabs show_cards client tool isn't called. */
  onStructuredResults?: (data: {
    artifact_type: string;
    records: Record<string, unknown>[];
    summary: string;
    confidence?: { status: string; score: number } | null;
  }) => void;
  /** Additional body fields to merge (e.g. userProfile, pending approvals). */
  extraBody?: Record<string, unknown>;
}

export function useAvaChat(options: UseAvaChatOptions = {}) {
  const { suiteId, session } = useSupabase();
  const { tenant } = useTenant();
  const onResponseTextRef = useRef(options.onResponseText);
  onResponseTextRef.current = options.onResponseText;

  const onStructuredResultsRef = useRef(options.onStructuredResults);
  onStructuredResultsRef.current = options.onStructuredResults;

  const extraBodyRef = useRef(options.extraBody);
  extraBodyRef.current = options.extraBody;

  // Build transport with dynamic headers
  const transport = useMemo(() => {
    return new AspireChatTransport({
      api: '/api/orchestrator/intent?stream=true',
      headers: () => {
        const h: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (suiteId) h['X-Suite-Id'] = suiteId;
        if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
        return h;
      },
      body: () => {
        const userProfile = tenant
          ? {
              ownerName: tenant.ownerName || undefined,
              businessName: tenant.businessName || undefined,
              industry: tenant.industry || undefined,
              teamSize: tenant.teamSize || undefined,
              industrySpecialty: tenant.industrySpecialty || undefined,
              businessGoals: tenant.businessGoals || undefined,
              painPoint: tenant.painPoint || undefined,
              preferredChannel: tenant.preferredChannel || undefined,
            }
          : undefined;

        return {
          userProfile,
          ...(extraBodyRef.current || {}),
        };
      },
      onResponseText: (text, media) => {
        onResponseTextRef.current?.(text, media);
      },
      onStructuredResults: (data) => {
        onStructuredResultsRef.current?.(data);
      },
      mapError: mapOrchestratorError,
    });
  }, [suiteId, session?.access_token, tenant]);

  const chatResult = useChat<UIMessage>({
    transport,
    onError: (error: Error) => {
      console.error('Ava chat error:', error);
    },
  });

  return chatResult;
}
