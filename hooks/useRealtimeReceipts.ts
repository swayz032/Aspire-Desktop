/**
 * useRealtimeReceipts
 *
 * Dual-path notification system for receipts:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes on receipts
 * 2. Polling fallback (secondary) — catches missed events every 30 seconds
 *
 * Law #6: Tenant Isolation — filters by suite_id via RLS + explicit filter.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getReceipts } from '@/lib/api';
import { useSupabase } from '@/providers';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';

const LOG_PREFIX = '[Receipts]';
const POLL_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 3000;

export function useRealtimeReceipts(limit = 50) {
  const { session, suiteId } = useSupabase();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!suiteId) return;
    try {
      setError(null);
      const data = await getReceipts(limit);
      if (mountedRef.current) {
        setReceipts(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load receipts');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, suiteId]);

  useEffect(() => {
    mountedRef.current = true;

    if (isLocalSyntheticAuthBypass()) {
      refresh();
      return;
    }
    if (!session?.user?.id || !suiteId) {
      refresh();
      return;
    }

    const userId = session.user.id;
    let disposed = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    console.log(`${LOG_PREFIX} Initializing for user ${userId.slice(0, 8)}...`);

    // -- 1. Supabase Realtime subscription (primary -- instant) --

    const createSubscription = () => {
      if (disposed) return;

      const filter = `suite_id=eq.${suiteId}`;
      const channelName = `receipts-${userId.slice(0, 8)}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'receipts',
            filter,
          },
          (payload) => {
            console.log(`${LOG_PREFIX} Realtime INSERT:`, { id: (payload.new as Record<string, unknown>).id });
            if (mountedRef.current) {
              setReceipts((prev) => [payload.new as any, ...prev].slice(0, limit));
            }
          },
        )
        .subscribe((status, err) => {
          console.log(`${LOG_PREFIX} Subscription status: ${status}`, err || '');
          if (status === 'SUBSCRIBED') {
            realtimeConnected.current = true;
            retryCountRef.current = 0;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeConnected.current = false;
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current);
              retryCountRef.current++;
              console.warn(`${LOG_PREFIX} Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms...`);
              retryTimerRef.current = setTimeout(() => {
                supabase.removeChannel(channel);
                createSubscription();
              }, delay);
            } else {
              console.error(`${LOG_PREFIX} Max retries (${MAX_RETRIES}) reached. Falling back to polling only.`);
            }
          }
        });

      channels.push(channel);
    };

    createSubscription();

    // -- 2. Polling fallback (secondary -- catches missed events) --
    refresh();
    const pollTimer = setInterval(refresh, POLL_INTERVAL_MS);

    // -- Cleanup --
    return () => {
      console.log(`${LOG_PREFIX} Cleaning up subscriptions`);
      disposed = true;
      mountedRef.current = false;
      realtimeConnected.current = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [limit, refresh, session?.user?.id, suiteId]);

  return { receipts, loading, error, refresh };
}
