/**
 * useRealtimeConferenceInvitations
 *
 * Dual-path notification system for conference invitations:
 * 1. Supabase Realtime (primary) — instant push via postgres_changes
 * 2. Polling fallback (secondary) — catches missed events every 5 seconds
 *
 * When a new pending invitation arrives, triggers the incoming video call
 * overlay + bell notification. When accepted/declined/expired, dismisses.
 *
 * Mount this hook once at the app layout level (_layout.tsx).
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import { isLocalSyntheticAuthBypass } from '@/lib/supabaseRuntime';
import {
  showIncomingVideoCall,
  dismissIncomingVideoCall,
  getIncomingVideoCallState,
} from '@/lib/incomingVideoCallStore';

const LOG_PREFIX = '[ConferenceInvitations]';
const POLL_INTERVAL_MS = 5000;

/** Map a Supabase row to a VideoCallInvitation for the store */
function rowToInvitation(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    inviterName: row.inviter_name as string,
    inviterAvatarUrl: (row.inviter_avatar_url as string) || null,
    inviterSuiteDisplayId: row.inviter_suite_display_id as string,
    inviterOfficeDisplayId: row.inviter_office_display_id as string,
    inviterBusinessName: (row.inviter_business_name as string) || null,
    inviterRole: (row.inviter_role as string) || null,
    roomName: row.room_name as string,
    serverUrl: row.livekit_server_url as string,
    expiresAt: row.expires_at as string,
    status: 'pending' as const,
  };
}

export function useRealtimeConferenceInvitations(): void {
  const { session } = useSupabase();
  const realtimeConnected = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RETRIES = 3;
  const RETRY_BASE_MS = 3000;

  useEffect(() => {
    if (isLocalSyntheticAuthBypass()) return;
    if (!session?.user?.id) return;

    const userId = session.user.id;
    let disposed = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    console.log(`${LOG_PREFIX} Initializing for user ${userId.slice(0, 8)}...`);

    // ── 1. Supabase Realtime subscription (primary — instant) ──────────

    const createSubscription = () => {
      if (disposed) return;

      const channelName = `conference-invitations-${userId.slice(0, 8)}-${Date.now()}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conference_invitations',
            filter: `invitee_user_id=eq.${userId}`,
          },
          (payload) => {
            console.log(`${LOG_PREFIX} Realtime INSERT received:`, payload.new);
            const row = payload.new as Record<string, unknown>;
            if (row.status === 'pending') {
              showIncomingVideoCall(rowToInvitation(row));
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conference_invitations',
            filter: `invitee_user_id=eq.${userId}`,
          },
          (payload) => {
            console.log(`${LOG_PREFIX} Realtime UPDATE received:`, payload.new);
            const row = payload.new as Record<string, unknown>;
            if (row.status !== 'pending') {
              dismissIncomingVideoCall();
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

    // ── 2. Polling fallback (secondary — catches missed events) ────────
    // Runs every 5s. If Realtime is working, polling typically finds nothing.
    // If Realtime is down, polling is the safety net.

    const checkPendingInvitations = async () => {
      try {
        const { data, error } = await supabase
          .from('conference_invitations')
          .select('*')
          .eq('invitee_user_id', userId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.warn(`${LOG_PREFIX} Poll error:`, error.message);
          return;
        }

        if (data && data.length > 0) {
          const row = data[0];
          const currentState = getIncomingVideoCallState();
          // Only show if not already displaying this invitation
          if (!currentState.visible || currentState.invitation?.id !== row.id) {
            console.log(`${LOG_PREFIX} Poll found pending invitation:`, row.id);
            showIncomingVideoCall(rowToInvitation(row));
          }
        }
      } catch (err) {
        console.warn(`${LOG_PREFIX} Poll exception:`, err);
      }
    };

    // Initial check + periodic polling
    checkPendingInvitations();
    const pollTimer = setInterval(checkPendingInvitations, POLL_INTERVAL_MS);

    // ── Cleanup ────────────────────────────────────────────────────────

    return () => {
      console.log(`${LOG_PREFIX} Cleaning up subscriptions`);
      disposed = true;
      realtimeConnected.current = false;
      channels.forEach(ch => supabase.removeChannel(ch));
      clearInterval(pollTimer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [session?.user?.id]);
}
