/**
 * MemoryDetailSummary — center column for `summary`, `thread_summary`,
 * `office_brief`, `finance_brief`.
 *
 * Layout (per plan §15.B):
 *   - Period label (eyebrow + headline)
 *   - Markdown body
 *   - Source memory list (the things being summarized)
 */

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail, MemoryType } from '../types';
import { MemoryBody } from './MemoryBody';

export interface MemoryDetailSummaryProps {
  memory: MemoryDetail;
  onLinkedMemoryPress?: (id: string) => void;
}

export function MemoryDetailSummary({ memory, onLinkedMemoryPress }: MemoryDetailSummaryProps) {
  const period = memory.period;
  const body = memory.body ?? memory.rawContent ?? memory.summary;

  return (
    <View style={styles.column}>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{period ? 'Period' : 'Summary'}</Text>
        {period && (
          <Text style={styles.heroPeriod} accessibilityRole="header">
            {period}
          </Text>
        )}
        <Text style={styles.heroSummary}>{memory.summary}</Text>
      </View>

      {body && body !== memory.summary && (
        <MemoryBody content={body} format={memory.bodyFormat ?? 'markdown'} eyebrow="Narrative" />
      )}

      {memory.linkedMemories && memory.linkedMemories.length > 0 && (
        <View style={styles.sourcesCard}>
          <View style={styles.sourcesHeaderRow}>
            <Text style={styles.eyebrow}>Source Memories</Text>
            <Text style={styles.sourceCount}>
              {memory.linkedMemories.length} {memory.linkedMemories.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          <View style={styles.sourcesList}>
            {memory.linkedMemories.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => onLinkedMemoryPress?.(m.id)}
                accessibilityRole="link"
                accessibilityLabel={m.title}
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                  styles.sourceRow,
                  hovered && styles.sourceRowHover,
                  pressed && styles.sourceRowPressed,
                ]}
              >
                <View style={styles.sourceIcon}>
                  <Ionicons name="document-text-outline" size={14} color={'#CBD5E1'} />
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text style={styles.sourceTitle} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={styles.sourceSub}>{humanizeType(m.type)}</Text>
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
  heroCard: {
    padding: 28,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 8,
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
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
  heroPeriod: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary as string,
    letterSpacing: -0.5,
    marginTop: 4,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 0 24px rgba(59,130,246,0.20)' } as unknown as TextStyle)
      : {}),
  },
  heroSummary: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 24,
    marginTop: 6,
    letterSpacing: -0.05,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  sourcesCard: {
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
  sourcesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sourceCount: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted as string,
    fontVariant: ['tabular-nums'],
  },
  sourcesList: { gap: 4 },
  sourceRow: {
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
  sourceRowHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sourceRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sourceIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148,163,184,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  sourceSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
  },
});

export default MemoryDetailSummary;
