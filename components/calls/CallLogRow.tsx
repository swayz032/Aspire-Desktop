/**
 * CallLogRow — single row in the Recent Calls table.
 *
 * Reuses Ionicons for direction, formatPhoneNumber + formatRelativeTime
 * + formatDuration from `lib/formatters.ts`. No new design primitives.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import {
  formatDuration,
  formatPhoneNumber,
  formatRelativeTime,
} from '@/lib/formatters';
import type {
  FrontdeskCallSession,
  FrontdeskContact,
} from '@/types/calls-messages';

interface Props {
  call: FrontdeskCallSession;
  contact: FrontdeskContact | null;
  onCallBack: (call: FrontdeskCallSession) => void;
}

export function CallLogRow({ call, contact, onCallBack }: Props): React.ReactElement {
  const isInbound = call.direction === 'inbound';
  const partyNumber = isInbound ? call.from_number : call.to_number;
  const name = contact?.display_name?.trim() || formatPhoneNumber(partyNumber ?? '');

  return (
    <View style={styles.row}>
      <View style={styles.directionCol}>
        <Ionicons
          name={isInbound ? 'arrow-down-circle' : 'arrow-up-circle'}
          size={18}
          color={isInbound ? Colors.accent.cyan : Colors.semantic.success}
        />
      </View>

      <View style={styles.identityCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name || 'Unknown'}
        </Text>
        {contact?.company && (
          <Text style={styles.company} numberOfLines={1}>
            {contact.company}
          </Text>
        )}
      </View>

      <View style={styles.summaryCol}>
        <Text style={styles.summary} numberOfLines={1}>
          {call.transcript_summary ?? '—'}
        </Text>
      </View>

      <View style={styles.metaCol}>
        <Text style={styles.duration}>
          {formatDuration(call.duration_seconds ?? 0)}
        </Text>
        <Text style={styles.timeAgo}>{formatRelativeTime(call.started_at)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${name}`}
        onPress={() => onCallBack(call)}
        style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
      >
        <Ionicons name="call" size={16} color={Colors.text.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: Spacing.md,
  },
  directionCol: {
    width: 24,
    alignItems: 'center',
  },
  identityCol: {
    width: 200,
  },
  name: {
    color: Colors.text.primary,
    fontSize: Typography.captionMedium.fontSize,
    fontWeight: '600',
  },
  company: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  summaryCol: {
    flex: 1,
    minWidth: 0,
  },
  summary: {
    color: Colors.text.tertiary,
    fontSize: Typography.caption.fontSize,
  },
  metaCol: {
    width: 96,
    alignItems: 'flex-end',
  },
  duration: {
    color: Colors.text.secondary,
    fontSize: Typography.caption.fontSize,
    fontVariant: ['tabular-nums'],
  },
  timeAgo: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.tertiary,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
