/**
 * MemoryDetailStrategy — center column for the `strategy` memory type.
 *
 * Layout (per plan §15.B):
 *   - Markdown body
 *   - Decision Twin tags
 *   - Linked memory list
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail, MemoryType } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';
import { MemoryBody } from './MemoryBody';

export interface MemoryDetailStrategyProps {
  memory: MemoryDetail;
  onLinkedMemoryPress?: (id: string) => void;
}

export function MemoryDetailStrategy({ memory, onLinkedMemoryPress }: MemoryDetailStrategyProps) {
  const body = memory.body ?? memory.rawContent ?? '';
  return (
    <View style={styles.column}>
      <MemorySummaryCard summary={memory.summary} />

      {body.length > 0 && (
        <MemoryBody content={body} format={memory.bodyFormat ?? 'markdown'} eyebrow="Strategy" />
      )}

      {memory.decisionTags && memory.decisionTags.length > 0 && (
        <View style={styles.tagsCard}>
          <Text style={styles.eyebrow}>Decision Twin</Text>
          <View style={styles.tagsRow}>
            {memory.decisionTags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <View style={styles.tagDot} />
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {memory.linkedMemories && memory.linkedMemories.length > 0 && (
        <View style={styles.linkedCard}>
          <Text style={styles.eyebrow}>Referenced Memories</Text>
          <View style={styles.linkedList}>
            {memory.linkedMemories.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => onLinkedMemoryPress?.(m.id)}
                accessibilityRole="link"
                accessibilityLabel={m.title}
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                  styles.linkedRow,
                  hovered && styles.linkedRowHover,
                  pressed && styles.linkedRowPressed,
                ]}
              >
                <View style={styles.linkedIcon}>
                  <Ionicons name="git-network-outline" size={14} color={'#C084FC'} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.linkedTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={styles.linkedSub}>{humanizeType(m.type)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.text.tertiary as string} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function humanizeType(t: MemoryType): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  column: { gap: 16 },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  tagsCard: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
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
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C084FC',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C084FC',
    letterSpacing: 0.1,
  },
  linkedCard: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
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
  linkedList: { gap: 6 },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  linkedRowHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  linkedRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  linkedIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  linkedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  linkedSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
  },
});

export default MemoryDetailStrategy;
