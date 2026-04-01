/**
 * useRealtimeCalendarEvents
 *
 * Dual-path notification system for calendar events:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes on calendar_events
 * 2. Polling fallback (secondary) — catches missed events every 30 seconds
 *
 * Returns { events, loading } for consumption by the calendar page.
 * Handles INSERT, UPDATE, DELETE events in real time.
 *
 * Law #6: Tenant Isolation — filters by suite_id via RLS + explicit filter.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import { devLog, devWarn, devError } from '@/lib/devLog';
import { getCalendarEvents } from '@/lib/api';

const LOG_PREFIX = '[CalendarEvents]';
const POLL_INTERVAL_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 3_000;

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  type: 'meeting' | 'task' | 'reminder' | 'call' | 'deadline' | 'other';
  duration?: string;
  location?: string;
  participants?: string[];
  isAllDay?: boolean;
  status?: string;
}

/** Map a raw DB/API row to a CalendarEvent */
function rowToCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  const startTime = (row.start_time as string) || (row.scheduled_at as string) || '';
  const startDate = startTime ? new Date(startTime) : new Date();
  const eventType = (row.event_type as string) || (row.type as string) || 'meeting';

  return {
    id: (row.id as string) || (row.booking_id as string) || '',
    date: startTime ? startDate.toISOString().split('T')[0] : '',
    time: startTime
      ? startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '',
    title: (row.title as string) || (row.service_name as string) || 'Event',
    type: (['meeting', 'task', 'reminder', 'call', 'deadline', 'other'].includes(eventType)
      ? eventType
      : 'meeting') as CalendarEvent['type'],
    duration: row.duration_minutes ? `${row.duration_minutes} min` : undefined,
    location: (row.location as string) || undefined,
    participants: (row.participants as string[]) || [],
    isAllDay: (row.is_all_day as boolean) || false,
    status: (row.status as string) || 'pending',
  };
}

export function useRealtimeCalendarEvents(): { events: CalendarEvent[]; loading: boolean } {
  const { session, suiteId } = useSupabase();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateFromApi = useCallback(async () => {
    try {
      const rows = await getCalendarEvents();
      const mapped = (rows as Record<string, unknown>[]).map(rowToCalendarEvent);
      setEvents(mapped);
      setLoading(false);
    } catch (err) {
      devWarn(`${LOG_PREFIX} Poll error:`, err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLocalSyntheticAuthBypass()) return;
    if (!session?.user?.id) return;
    if (!suiteId) return;

    const userId = session.user.id;
    let disposed = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    devLog(`${LOG_PREFIX} Initializing for user ${userId.slice(0, 8)}...`);

    // ── 1. Supabase Realtime subscription (primary — instant) ──────────

    const createSubscription = () => {
      if (disposed) return;

      const filter = `suite_id=eq.${suiteId}`;
      const channelName = `calendar-events-${userId.slice(0, 8)}-${Date.now()}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'calendar_events',
            filter,
          },
          (payload) => {
            if (disposed) return;
            const row = payload.new as Record<string, unknown>;
            devLog(`${LOG_PREFIX} Realtime INSERT:`, { id: row.id, title: row.title });
            const newEvent = rowToCalendarEvent(row);
            setEvents((prev) => {
              if (prev.some((e) => e.id === newEvent.id)) return prev;
              return [...prev, newEvent].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
              );
            });
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'calendar_events',
            filter,
          },
          (payload) => {
            if (disposed) return;
            const row = payload.new as Record<string, unknown>;
            devLog(`${LOG_PREFIX} Realtime UPDATE:`, { id: row.id, status: row.status });
            const updated = rowToCalendarEvent(row);
            setEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e)),
            );
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'calendar_events',
            filter,
          },
          (payload) => {
            if (disposed) return;
            const old = payload.old as Record<string, unknown>;
            const id = old.id as string;
            devLog(`${LOG_PREFIX} Realtime DELETE:`, { id });
            if (id) {
              setEvents((prev) => prev.filter((e) => e.id !== id));
            }
          },
        )
        .subscribe((status, err) => {
          devLog(`${LOG_PREFIX} Subscription status: ${status}`, err || '');
          if (status === 'SUBSCRIBED') {
            realtimeConnected.current = true;
            retryCountRef.current = 0;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            realtimeConnected.current = false;
            if (retryCountRef.current < MAX_RETRIES) {
              const delay = RETRY_BASE_MS * Math.pow(2, retryCountRef.current);
              retryCountRef.current++;
              devWarn(`${LOG_PREFIX} Retry ${retryCountRef.current}/${MAX_RETRIES} in ${delay}ms...`);
              retryTimerRef.current = setTimeout(() => {
                supabase.removeChannel(channel);
                createSubscription();
              }, delay);
            } else {
              devError(`${LOG_PREFIX} Max retries (${MAX_RETRIES}) reached. Falling back to polling only.`);
            }
          }
        });

      channels.push(channel);
    };

    createSubscription();

    // ── 2. Polling fallback (secondary — catches missed events) ────────
    hydrateFromApi();
    const pollTimer = setInterval(hydrateFromApi, POLL_INTERVAL_MS);

    // ── Cleanup ────────────────────────────────────────────────────────
    return () => {
      devLog(`${LOG_PREFIX} Cleaning up subscriptions`);
      disposed = true;
      realtimeConnected.current = false;
      channels.forEach((ch) => supabase.removeChannel(ch));
      clearInterval(pollTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [session?.user?.id, suiteId, hydrateFromApi]);

  return { events, loading };
}
