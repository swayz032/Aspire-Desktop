/**
 * MemoryDetailTranscript — center column for the `transcript` memory type.
 *
 * Layout (per plan §15.B):
 *   - Speaker-tagged turns scroll (timestamped speaker turns, monospace-ish
 *     but humanized — see typography choices below).
 *   - Link to refined session_summary parent (when present).
 *
 * Editorial details per §12.1:
 *   - Speaker label is uppercase tracking +1.6 in 11/700 muted, ABOVE the
 *     line — reads as a magazine "speaker tag" instead of inline `Bob:`.
 *   - Body text is 15/400, line-height 24, opacity-layered white. Each turn
 *     is paragraph-style — never crammed.
 *   - Even rows get a subtle background tint (rgba 0.02) for a "scoresheet"
 *     pattern that aids quick scanning.
 *   - Timestamp is right-aligned tabular-nums monospace so 3:42, 12:45,
 *     1:02:30 stack vertically.
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';

export interface MemoryDetailTranscriptProps {
  memory: MemoryDetail;
  onParentPress?: (id: string) => void;
}

function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const total = Math.floor(secs);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MemoryDetailTranscript({ memory, onParentPress }: MemoryDetailTranscriptProps) {
  const turns = memory.transcript ?? [];
  const parentId = memory.linkedMemories?.find((m) => m.type === 'session_summary')?.id;

  return (
    <View style={styles.column}>
      <MemorySummaryCard summary={memory.summary} eyebrow="Transcript Summary" />

      {parentId && (
        <Pressable
          onPress={() => onParentPress?.(parentId)}
          accessibilityRole="link"
          accessibilityLabel="Open refined session summary"
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.parentLink,
            hovered && styles.parentLinkHover,
            pressed && styles.parentLinkPressed,
          ]}
        >
          <View style={styles.parentIcon}>
            <Ionicons name="sparkles-outline" size={14} color={'#60A5FA'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.parentLinkLabel}>Refined Session Summary</Text>
            <Text style={styles.parentLinkSub}>Open the agent-narrated take of this transcript</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color={Colors.text.secondary as string} />
        </Pressable>
      )}

      <View style={styles.transcriptCard}>
        <View style={styles.transcriptHeaderRow}>
          <Text style={styles.eyebrow}>Transcript</Text>
          <Text style={styles.turnsCount}>{turns.length} turns</Text>
        </View>

        {turns.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mic-off-outline" size={28} color={Colors.text.muted as string} />
            <Text style={styles.emptyTitle}>No transcript captured</Text>
            <Text style={styles.emptyBody}>
              The recording exists but transcription hasn't completed yet, or the audio was redacted.
            </Text>
          </View>
        ) : (
          <View style={styles.turnList}>
            {turns.map((turn, i) => (
              <View
                key={`${turn.t}-${i}`}
                style={[styles.turn, i % 2 === 0 && styles.turnAlt]}
              >
                <View style={styles.turnHeader}>
                  <Text style={styles.speakerTag}>{turn.speaker || 'Speaker'}</Text>
                  <Text style={styles.timeTag}>{fmtTime(turn.t)}</Text>
                </View>
                <Text style={styles.turnBody}>{turn.text}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  parentLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.30)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'border-color 160ms ease-out, background-color 160ms ease-out, transform 160ms ease-out',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.10), 0 0 18px rgba(59,130,246,0.10)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }),
  },
  parentLinkHover: {
    backgroundColor: 'rgba(59,130,246,0.05)',
    borderColor: 'rgba(59,130,246,0.55)',
    transform: [{ translateY: -1 }],
  },
  parentLinkPressed: {
    transform: [{ translateY: 0 }, { scale: 0.99 }],
  },
  parentIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
  },
  parentLinkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  parentLinkSub: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
    marginTop: 1,
  },
  transcriptCard: {
    padding: 24,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  turnsCount: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
  },
  turnList: {
    gap: 4,
  },
  turn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    borderRadius: 8,
    gap: 6,
  },
  turnAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  turnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  speakerTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#93C5FD',
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  timeTag: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
  },
  turnBody: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 24,
    letterSpacing: -0.05,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary as string,
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 380,
    lineHeight: 19,
  },
});

export default MemoryDetailTranscript;
