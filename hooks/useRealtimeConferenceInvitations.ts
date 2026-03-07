/**
 * useRealtimeConferenceInvitations
 *
 * Subscribes to Supabase Realtime for conference_invitations table changes
 * filtered by the current user's ID. When a new pending invitation arrives,
 * it triggers the incoming video call overlay. When an invitation is updated
 * to non-pending status, it dismisses the overlay.
 *
 * Mount this hook once at the app layout level (e.g., DesktopShell or _layout).
 */
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/providers';
import { showIncomingVideoCall, dismissIncomingVideoCall } from '@/lib/incomingVideoCallStore';

export function useRealtimeConferenceInvitations(): void {
  const { session } = useSupabase();

  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('conference-invitations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conference_invitations',
          filter: `invitee_user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status === 'pending') {
            showIncomingVideoCall({
              id: row.id as string,
              inviterName: row.inviter_name as string,
              inviterAvatarUrl: (row.inviter_avatar_url as string) || null,
              inviterSuiteDisplayId: row.inviter_suite_display_id as string,
              inviterOfficeDisplayId: row.inviter_office_display_id as string,
              inviterBusinessName: (row.inviter_business_name as string) || null,
              roomName: row.room_name as string,
              serverUrl: row.livekit_server_url as string,
              expiresAt: row.expires_at as string,
              status: 'pending',
            });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conference_invitations',
          filter: `invitee_user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status !== 'pending') {
            dismissIncomingVideoCall();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);
}
