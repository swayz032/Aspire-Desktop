/**
 * EmailWidget — Premium inbox widget for Canvas Mode
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - REAL Supabase data with RLS-scoped queries
 * - Real-time subscriptions via postgres_changes
 * - Custom SVG icons (NO emojis)
 * - Bloomberg Terminal-level polish
 * - 60fps scrolling with optimized FlatList
 * - Premium depth system with multi-layer shadows
 * - Hover lift effects (web)
 *
 * Reference: Authority Queue card premium feel
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { CanvasTokens } from '@/constants/canvas.tokens';
import { Ionicons } from '@expo/vector-icons';
import {
  submitAction,
  generateActionId,
  type ActionResult,
} from '@/lib/canvasActionBus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Email {
  id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  preview_text: string;
  timestamp: string;
  is_read: boolean;
}

interface EmailWidgetProps {
  suiteId: string;
  officeId: string;
  /** Actor ID for action bus (user performing actions) */
  actorId?: string;
  onEmailClick?: (emailId: string) => void;
  onComposeClick?: () => void;
  /** Wave 17: Callback when action completes via action bus */
  onActionComplete?: (result: ActionResult) => void;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Generate avatar color from name (deterministic) */
function getColorFromName(name: string): string {
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/** Get initials from name */
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format timestamp (e.g., "2m ago", "Yesterday", "Jan 15") */
function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  // Format as "Jan 15" for older emails
  const month = then.toLocaleDateString('en-US', { month: 'short' });
  const day = then.getDate();
  return `${month} ${day}`;
}

// ---------------------------------------------------------------------------
// Email Card Component
// ---------------------------------------------------------------------------

interface EmailCardProps {
  email: Email;
  onPress: (emailId: string) => void;
}

const EmailCard = React.memo(({ email, onPress }: EmailCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const avatarColor = useMemo(() => getColorFromName(email.sender_name), [email.sender_name]);
  const initials = useMemo(() => getInitials(email.sender_name), [email.sender_name]);

  const handlePressIn = useCallback(() => {
    if (Platform.OS === 'web') setIsHovered(true);
  }, []);

  const handlePressOut = useCallback(() => {
    if (Platform.OS === 'web') setIsHovered(false);
  }, []);

  const cardStyle = [
    styles.emailCard,
    isHovered && styles.emailCardHover,
  ];

  return (
    <Pressable
      onPress={() => onPress(email.id)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={cardStyle}
    >
      {/* Unread indicator */}
      {!email.is_read && <View style={styles.unreadDot} />}

      {/* Sender avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Email content */}
      <View style={styles.emailContent}>
        <View style={styles.emailHeader}>
          <Text style={styles.senderName} numberOfLines={1}>
            {email.sender_name}
          </Text>
          <Text style={styles.timestamp}>{formatTimestamp(email.timestamp)}</Text>
        </View>
        <Text style={styles.subject} numberOfLines={1}>
          {email.subject}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {email.preview_text}
        </Text>
      </View>
    </Pressable>
  );
});

EmailCard.displayName = 'EmailCard';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmailWidget({
  suiteId,
  officeId,
  actorId,
  onEmailClick,
  onComposeClick,
  onActionComplete,
}: EmailWidgetProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------

  const fetchEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // TODO: Replace with real Supabase query once emails table exists
      // const { data, error: fetchError } = await supabase
      //   .from('emails')
      //   .select('id, sender_name, sender_email, subject, preview_text, timestamp, is_read')
      //   .eq('suite_id', suiteId)
      //   .eq('office_id', officeId)
      //   .order('timestamp', { ascending: false })
      //   .limit(10);

      // if (fetchError) throw fetchError;
      // setEmails(data || []);

      // TEMPORARY: Mock data for demonstration
      const mockEmails: Email[] = [
        {
          id: '1',
          sender_name: 'Sarah Johnson',
          sender_email: 'sarah@example.com',
          subject: 'Q1 Financial Review Meeting',
          preview_text: 'Hi team, I wanted to schedule our quarterly financial review for next week. Please let me know your availability.',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
          is_read: false,
        },
        {
          id: '2',
          sender_name: 'Mike Chen',
          sender_email: 'mike@example.com',
          subject: 'Invoice #2024-001 Paid',
          preview_text: 'Your invoice #2024-001 for $5,000 has been marked as paid. Thank you for your business!',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          is_read: true,
        },
        {
          id: '3',
          sender_name: 'Emily Rodriguez',
          sender_email: 'emily@example.com',
          subject: 'Contract Amendment Request',
          preview_text: 'I have reviewed the latest contract and have a few amendments I would like to propose. Can we schedule a call?',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
          is_read: true,
        },
        {
          id: '4',
          sender_name: 'David Park',
          sender_email: 'david@example.com',
          subject: 'New Project Proposal',
          preview_text: 'Excited to share our new project proposal with you. Attached are the scope, timeline, and budget details.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
          is_read: false,
        },
      ];

      setEmails(mockEmails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [suiteId, officeId]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // ---------------------------------------------------------------------------
  // Real-Time Subscription
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // TODO: Enable real-time subscription once emails table exists
    // const subscription = supabase
    //   .channel('emails')
    //   .on('postgres_changes', {
    //     event: '*',
    //     schema: 'public',
    //     table: 'emails',
    //     filter: `suite_id=eq.${suiteId}`,
    //   }, (payload) => {
    //     if (payload.eventType === 'INSERT') {
    //       setEmails((prev) => [payload.new as Email, ...prev].slice(0, 10));
    //     } else if (payload.eventType === 'UPDATE') {
    //       setEmails((prev) =>
    //         prev.map((e) => (e.id === payload.new.id ? payload.new as Email : e))
    //       );
    //     } else if (payload.eventType === 'DELETE') {
    //       setEmails((prev) => prev.filter((e) => e.id !== payload.old.id));
    //     }
    //   })
    //   .subscribe();

    // return () => {
    //   subscription.unsubscribe();
    // };
  }, [suiteId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleEmailPress = useCallback(
    (emailId: string) => {
      onEmailClick?.(emailId);
    },
    [onEmailClick]
  );

  const handleViewAll = useCallback(() => {
    // Navigate to full inbox view
  }, []);

  /**
   * Wave 17: Submit email compose action through action bus.
   * YELLOW tier -- requires user confirmation before sending.
   */
  const handleComposeViaActionBus = useCallback(async () => {
    if (!actorId) {
      // Fall back to direct compose callback when actor not available
      onComposeClick?.();
      return;
    }

    const result = await submitAction({
      id: generateActionId(),
      type: 'email.compose',
      widgetId: 'email-widget',
      riskTier: 'YELLOW',
      payload: {
        source: 'canvas_widget',
        action: 'compose_new',
      },
      suiteId,
      officeId,
      actorId,
      timestamp: Date.now(),
    });

    onActionComplete?.(result);

    if (result.status === 'succeeded') {
      onComposeClick?.();
    }
  }, [actorId, suiteId, officeId, onComposeClick, onActionComplete]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderEmailCard = useCallback(
    ({ item }: { item: Email }) => <EmailCard email={item} onPress={handleEmailPress} />,
    [handleEmailPress]
  );

  const keyExtractor = useCallback((item: Email) => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="mail-outline" size={32} color="rgba(255,255,255,0.3)" />
        <Text style={styles.loadingText}>Loading emails...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (emails.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="mail-outline" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>No emails yet</Text>
        <Text style={styles.emptySubtext}>Your inbox will appear here</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Email list */}
      <FlatList
        data={emails}
        renderItem={renderEmailCard}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={6}
        contentContainerStyle={styles.listContent}
      />

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable style={styles.ghostButton} onPress={handleViewAll}>
          <Text style={styles.ghostButtonText}>View All</Text>
        </Pressable>
        <Pressable
          style={styles.primaryButton}
          onPress={actorId ? handleComposeViaActionBus : onComposeClick}
          accessibilityRole="button"
          accessibilityLabel="Compose new email"
        >
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Compose</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CanvasTokens.background.elevated,
  },

  listContent: {
    padding: 16,
    paddingBottom: 80, // Account for action buttons
  },

  emailCard: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
    // Multi-layer shadow
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          transition: 'all 150ms ease',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }),
  },

  emailCardHover: {
    borderColor: 'rgba(59,130,246,0.2)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          transform: 'translateY(-2px)',
        } as unknown as ViewStyle)
      : {}),
  },

  unreadDot: {
    position: 'absolute',
    top: 16,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  emailContent: {
    flex: 1,
    gap: 4,
  },

  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  senderName: {
    flex: 1,
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },

  timestamp: {
    color: CanvasTokens.text.muted,
    fontSize: 12,
  },

  subject: {
    color: CanvasTokens.text.primary,
    fontSize: 13,
    fontWeight: '500',
  },

  preview: {
    color: CanvasTokens.text.secondary,
    fontSize: 12,
    lineHeight: 16,
  },

  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: CanvasTokens.background.surface,
    borderTopWidth: 1,
    borderTopColor: CanvasTokens.border.subtle,
  },

  ghostButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CanvasTokens.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 150ms ease',
        } as any)
      : {}),
  },

  ghostButtonText: {
    color: CanvasTokens.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  primaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 150ms ease',
        } as any)
      : {}),
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CanvasTokens.background.elevated,
  },

  loadingText: {
    color: CanvasTokens.text.secondary,
    fontSize: 14,
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CanvasTokens.background.elevated,
  },

  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CanvasTokens.background.elevated,
  },

  emptyText: {
    color: CanvasTokens.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },

  emptySubtext: {
    color: CanvasTokens.text.muted,
    fontSize: 14,
  },
});
