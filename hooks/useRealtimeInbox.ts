/**
 * useRealtimeInbox
 *
 * Dual-path notification system for inbox items:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes on inbox_items
 * 2. Polling fallback (secondary) — catches missed events every 30 seconds
 *
 * Law #6: Tenant Isolation — filters by suite_id via RLS + explicit filter.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getInboxItems } from '@/lib/api';
import { useSupabase } from '@/providers';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';

const LOG_PREFIX = '[Inbox]';
const POLL_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 3000;

export function useRealtimeInbox(limit = 50) {
  const { session, suiteId } = useSupabase();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await getInboxItems(limit);
      if (mountedRef.current) {
        setItems(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load inbox items');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit]);

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
      const channelName = `inbox-${userId.slice(0, 8)}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inbox_items',
            filter,
          },
          () => {
            if (mountedRef.current) {
              refresh();
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

  return { items, loading, error, refresh };
}
