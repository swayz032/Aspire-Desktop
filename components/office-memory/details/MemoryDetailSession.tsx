/**
 * MemoryDetailSession — center column for `session_summary` (EL/Anam agent
 * sessions) and the `transcript` parent.
 *
 * Layout (per plan §15.B):
 *   - Agent avatar (AvaOrb / Persona obsidian) + intents detected pills
 *   - Summary card
 *   - Refined narrative body
 *   - ToolInvocationLog
 *   - Linked receipts (handled by right rail)
 *   - Handoff link (if `correlation_id` ties to follow-on session)
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AvaOrb } from '@/components/AvaOrb';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';
import { MemoryBody } from './MemoryBody';
import { ToolInvocationLog } from '../blocks/ToolInvocationLog';

export interface MemoryDetailSessionProps {
  memory: MemoryDetail;
  onHandoffPress?: (id: string) => void;
  onReceiptPress?: (receiptId: string) => void;
}

// Agent identity → ring color (for the avatar surround)
const AGENT_RING: Record<string, string> = {
  ava: 'rgba(59,130,246,0.45)',
  finn: 'rgba(52,199,89,0.45)',
  eli: 'rgba(245,158,11,0.45)',
  nora: 'rgba(8,145,178,0.45)',
  sarah: 'rgba(147,130,246,0.45)',
};

export function MemoryDetailSession({
  memory,
  onHandoffPress,
  onReceiptPress,
}: MemoryDetailSessionProps) {
  const agent = memory.agent;
  const ring = agent ? AGENT_RING[agent.id.toLowerCase()] ?? 'rgba(96,165,250,0.45)' : 'rgba(96,165,250,0.45)';

  return (
    <View style={styles.column}>
      {/* Hero band — agent avatar + intents */}
      <View style={styles.heroCard}>
        <View
          style={[
            styles.avatarFrame,
            {
              borderColor: ring,
              ...(Platform.OS === 'web'
                ? ({
                    boxShadow: `0 0 0 4px ${ring.replace('0.45', '0.16')}, 0 0 36px ${ring}`,
                  } as unknown as ViewStyle)
                : {
                    shadowColor: ring,
                    shadowOpacity: 0.5,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 6,
                  }),
            },
          ]}
        >
          <AvaOrb state="idle" size={88} />
        </View>

        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <Text style={styles.heroEyebrow}>Agent Session</Text>
          <Text style={styles.heroTitle} numberOfLines={1}>
            {agent?.name ?? 'Aspire Agent'}
          </Text>
          {memory.intents && memory.intents.length > 0 ? (
            <View style={styles.intentsRow}>
              {memory.intents.map((intent, i) => (
                <View key={`${intent}-${i}`} style={styles.intentPill}>
                  <Ionicons name="sparkles" size={10} color={'#60A5FA'} />
                  <Text style={styles.intentText}>{intent}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.heroSub}>No intents detected in this session.</Text>
          )}
        </View>
      </View>

      <MemorySummaryCard summary={memory.summary} eyebrow="Session Summary" />

      {memory.narrative && (
        <MemoryBody
          content={memory.narrative}
          format={memory.bodyFormat ?? 'markdown'}
          eyebrow="Refined Narrative"
        />
      )}

      {memory.toolCalls && memory.toolCalls.length > 0 && (
        <ToolInvocationLog
          calls={memory.toolCalls}
          onReceiptPress={onReceiptPress}
        />
      )}

      {memory.handoff && (
        <Pressable
          onPress={() => onHandoffPress?.(memory.handoff?.id ?? '')}
          accessibilityRole="link"
          accessibilityLabel={`Open handoff: ${memory.handoff.label}`}
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            styles.handoffCard,
            hovered && styles.handoffCardHover,
            pressed && styles.handoffCardPressed,
          ]}
        >
          <View style={styles.handoffIcon}>
            <Ionicons name="git-branch-outline" size={16} color={'#C084FC'} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.handoffEyebrow}>Handoff</Text>
            <Text style={styles.handoffLabel} numberOfLines={1}>
              {memory.handoff.label}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color={Colors.text.secondary as string} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
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
  avatarFrame: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary as string,
    letterSpacing: -0.4,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 0 24px rgba(59,130,246,0.20)' } as unknown as TextStyle)
      : {}),
  },
  heroSub: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
  },
  intentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  intentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.24)',
  },
  intentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
    letterSpacing: 0.1,
  },
  handoffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.30)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'border-color 160ms ease-out, background-color 160ms ease-out, transform 160ms ease-out',
          boxShadow: '0 0 0 1px rgba(168,85,247,0.10), 0 0 18px rgba(168,85,247,0.10)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#A855F7',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }),
  },
  handoffCardHover: {
    backgroundColor: 'rgba(168,85,247,0.06)',
    borderColor: 'rgba(168,85,247,0.55)',
    transform: [{ translateY: -1 }],
  },
  handoffCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  handoffIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  handoffEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  handoffLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
});

export default MemoryDetailSession;
