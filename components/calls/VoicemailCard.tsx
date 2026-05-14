/**
 * VoicemailCard — single voicemail row in the Calls & Messages voicemails tab.
 *
 * Reuses the existing design-system primitives:
 *   - Card     (components/ui/Card.tsx)
 *   - Badge    (components/ui/Badge.tsx)  — used only for the "unread" pip;
 *               urgency uses a custom pill so we hit the brand colors from the
 *               plan (#DC2626 / #F59E0B / #6B7280) rather than the theme map.
 *
 * Realtime "new voicemail" entries fade + slide in via the `entering` prop —
 * the parent screen wraps the card in `Animated.View` to drive the 200ms
 * ease-out. Fade-in is opt-in so re-renders don't stutter.
 */

import React, { useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { formatPhoneNumber, formatRelativeTime } from '@/lib/formatters';
import type { FrontdeskVoicemail } from '@/types/calls-messages';

interface Props {
  voicemail: FrontdeskVoicemail;
  onCallBack: (vm: FrontdeskVoicemail) => void;
  onMarkRead: (vm: FrontdeskVoicemail) => void;
  onArchive: (vm: FrontdeskVoicemail) => void;
  /** When true, the card animates in (used for realtime arrivals). */
  animateIn?: boolean;
}

const URGENCY: Record<
  FrontdeskVoicemail['urgency'],
  { bg: string; label: string }
> = {
  high: { bg: '#DC2626', label: 'High' },
  medium: { bg: '#F59E0B', label: 'Medium' },
  low: { bg: '#6B7280', label: 'Low' },
};

export function VoicemailCard({
  voicemail,
  onCallBack,
  onMarkRead,
  onArchive,
  animateIn,
}: Props): React.ReactElement {
  const [audioOpen, setAudioOpen] = useState(false);
  const opacity = useMemo(() => new Animated.Value(animateIn ? 0 : 1), [animateIn]);
  const translateY = useMemo(() => new Animated.Value(animateIn ? 8 : 0), [animateIn]);

  React.useEffect(() => {
    if (!animateIn) return;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [animateIn, opacity, translateY]);

  const isUnread = !voicemail.read_at;
  const urgency = URGENCY[voicemail.urgency];
  const callerLabel = voicemail.caller_name ?? 'Unknown';
  const phoneLabel = voicemail.callback_number
    ? formatPhoneNumber(voicemail.callback_number)
    : 'No callback number';

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <Card variant="default" padding="lg" style={styles.card}>
        <View style={styles.header}>
          <View style={[styles.urgencyPill, { backgroundColor: urgency.bg }]}>
            <Text style={styles.urgencyText}>{urgency.label}</Text>
          </View>
          {isUnread && <View style={styles.unreadDot} accessibilityLabel="Unread" />}
          <Text style={styles.timeAgo}>{formatRelativeTime(voicemail.created_at)}</Text>
        </View>

        <View style={styles.identityRow}>
          <Text style={styles.callerName} numberOfLines={1}>
            {callerLabel}
          </Text>
          <Text style={styles.phone}>{phoneLabel}</Text>
        </View>

        {voicemail.call_reason && (
          <Text style={styles.reason} numberOfLines={1}>
            {voicemail.call_reason}
          </Text>
        )}

        {voicemail.call_summary && (
          <Text style={styles.summary} numberOfLines={2}>
            {voicemail.call_summary}
          </Text>
        )}

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call back ${callerLabel}`}
            onPress={() => onCallBack(voicemail)}
            style={({ pressed }) => [
              styles.primaryAction,
              pressed && styles.actionPressed,
            ]}
          >
            <Ionicons name="call" size={16} color="#0a0a0a" />
            <Text style={styles.primaryActionText}>Call back</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play audio"
            onPress={() => setAudioOpen((v) => !v)}
            disabled={!voicemail.audio_uri}
            style={({ pressed }) => [
              styles.secondaryAction,
              !voicemail.audio_uri && styles.actionDisabled,
              pressed && voicemail.audio_uri && styles.actionPressed,
            ]}
          >
            <Ionicons
              name={audioOpen ? 'pause' : 'play'}
              size={16}
              color={Colors.text.secondary}
            />
            <Text style={styles.secondaryActionText}>
              {audioOpen ? 'Hide player' : 'Play'}
            </Text>
          </Pressable>

          {isUnread && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark as read"
              onPress={() => onMarkRead(voicemail)}
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && styles.actionPressed,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={Colors.text.secondary}
              />
              <Text style={styles.secondaryActionText}>Mark read</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Archive voicemail"
            onPress={() => onArchive(voicemail)}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.actionPressed,
            ]}
          >
            <Ionicons name="archive-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.secondaryActionText}>Archive</Text>
          </Pressable>
        </View>

        {audioOpen && voicemail.audio_uri && (
          <View style={styles.audioPlayer}>
            <Text style={styles.audioPlaceholder}>
              Audio player ({voicemail.duration_seconds ?? 0}s)
            </Text>
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  urgencyPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
  },
  timeAgo: {
    marginLeft: 'auto',
    color: Colors.text.muted,
    fontSize: Typography.caption.fontSize,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  callerName: {
    color: Colors.text.primary,
    fontSize: Typography.headline.fontSize,
    fontWeight: '600',
    flexShrink: 1,
  },
  phone: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
  },
  reason: {
    color: Colors.text.secondary,
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  summary: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    minHeight: 44,
    alignItems: 'center',
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.text.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    minHeight: 44,
  },
  primaryActionText: {
    color: '#0a0a0a',
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
    minHeight: 44,
  },
  secondaryActionText: {
    color: Colors.text.secondary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '500',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  audioPlayer: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
  },
  audioPlaceholder: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
  },
});
