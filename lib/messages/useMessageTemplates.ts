/**
 * useMessageTemplates — Lane E6 (plan §3.9.9).
 *
 * Fetches the V1 message templates from `GET /api/messages/templates`.
 * Templates are static V1 (5 rows from plan §3.9.7) so the staleness window
 * is very long — effectively read-once per session.
 *
 * Capability scope `telephony:sms_read` (server-minted).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';
import { fetchTemplates } from '@/lib/api/messages';
import type { MessageTemplate } from '@/components/messages/MessageTemplatePicker';

// 1 hour — templates don't change frequently in V1.
const STALE_MS = 60 * 60 * 1000;

interface CacheEntry {
  templates: MessageTemplate[];
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();

export interface UseMessageTemplatesResult {
  templates: MessageTemplate[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useMessageTemplates(): UseMessageTemplatesResult {
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  const officeId = tenant?.officeId ?? '';
  const key = officeId || '_';

  const cached = cache.get(key);
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    () => cached?.templates ?? [],
  );
  const [isLoading, setIsLoading] = useState<boolean>(() => !cached);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const doFetch = useCallback(async () => {
    if (!officeId) return;
    const existing = cache.get(key);
    const fresh = existing && Date.now() - existing.fetchedAt < STALE_MS;
    if (fresh) {
      if (mountedRef.current) {
        setTemplates(existing!.templates);
        setIsLoading(false);
        setError(null);
      }
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!existing && mountedRef.current) setIsLoading(true);
    try {
      const result = await fetchTemplates({
        authenticatedFetch,
        officeId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      cache.set(key, { templates: result, fetchedAt: Date.now() });
      if (mountedRef.current) {
        setTemplates(result);
        setIsLoading(false);
        setError(null);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const e = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setError(e);
        setIsLoading(false);
      }
    }
  }, [authenticatedFetch, key, officeId]);

  useEffect(() => {
    void doFetch();
  }, [doFetch]);

  return {
    templates,
    isLoading,
    isError: !!error,
    error,
  };
}
