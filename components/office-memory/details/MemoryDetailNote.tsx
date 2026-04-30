/**
 * MemoryDetailNote — center-column body for the `note` memory type.
 *
 * Layout (per plan §15.B):
 *   - Title + datetime (rendered by parent header)
 *   - Markdown body
 *   - Source link if linked to receipt
 *
 * This component is also used as the V1 fallback for the cluster of new
 * Coordination-Spine memory types (decision_fact, handoff_note,
 * pending_intent, authority_context, risk_flag, timeline_event,
 * receipt_reference, workflow_reference). Lane-A/B detail components will
 * own richer renderings in a follow-up pass; until then, the body + summary
 * + linked-receipts pattern keeps every type readable.
 */

import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';
import { MemoryBody } from './MemoryBody';

export interface MemoryDetailNoteProps {
  memory: MemoryDetail;
}

export function MemoryDetailNote({ memory }: MemoryDetailNoteProps) {
  const sourceUrl = memory.linkedReceipts?.[0]?.href;
  const body = memory.body ?? memory.rawContent ?? '';

  return (
    <View style={styles.column}>
      <MemorySummaryCard summary={memory.summary} />

      {body.length > 0 && (
        <MemoryBody content={body} format={memory.bodyFormat ?? 'markdown'} />
      )}

      {body.length === 0 && (
        <View style={styles.emptyBody}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={26} color={Colors.text.muted as string} />
          </View>
          <Text style={styles.emptyTitle}>No expanded body yet</Text>
          <Text style={styles.emptyHint}>
            Notes capture the gist in the summary above. Open the source if
            you need the full record.
          </Text>
        </View>
      )}

      {sourceUrl && (
        <Pressable
          onPress={() => {
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined') window.open(sourceUrl, '_blank');
            } else {
              void Linking.openURL(sourceUrl);
            }
          }}
          accessibilityRole="link"
          accessibilityLabel="Open source"
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.sourceCard,
            hovered && styles.sourceCardHover,
            pressed && styles.sourceCardPressed,
          ]}
        >
          <View style={styles.sourceIconWrap}>
            <Ionicons name="link" size={16} color={'#60A5FA'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.sourceLabel}>Source</Text>
            <Text style={styles.sourceUrl} numberOfLines={1}>
              {memory.linkedReceipts?.[0]?.label ?? sourceUrl}
            </Text>
          </View>
          <Ionicons name="open-outline" size={16} color={Colors.text.tertiary as string} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: 16,
  },
  emptyBody: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary as string,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 340,
    lineHeight: 19,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'border-color 160ms ease-out, background-color 160ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  sourceCardHover: {
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderColor: 'rgba(59,130,246,0.40)',
  },
  sourceCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  sourceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
  },
  sourceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  sourceUrl: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
});

export default MemoryDetailNote;
