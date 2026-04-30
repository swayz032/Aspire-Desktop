/**
 * MemoryDetailResearch — center column for the `research` memory type.
 *
 * Layout (per plan §15.B):
 *   - Markdown body
 *   - Source URLs list
 *   - Confidence score
 */

import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MemorySummaryCard } from '../MemorySummaryCard';
import { MemoryBody } from './MemoryBody';

export interface MemoryDetailResearchProps {
  memory: MemoryDetail;
}

export function MemoryDetailResearch({ memory }: MemoryDetailResearchProps) {
  const body = memory.body ?? memory.rawContent ?? '';
  const score = memory.confidenceScore;

  return (
    <View style={styles.column}>
      <MemorySummaryCard summary={memory.summary} />

      {typeof score === 'number' && (
        <View style={styles.confidenceCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.confidenceEyebrow}>Confidence</Text>
            <Text style={styles.confidenceLabel}>{labelForScore(score)}</Text>
          </View>
          <View style={styles.confidenceMeter}>
            <View style={styles.confidenceTrack}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${Math.max(0, Math.min(1, score)) * 100}%` },
                  scoreColor(score),
                ]}
              />
            </View>
            <Text style={styles.confidenceValue}>{Math.round(score * 100)}%</Text>
          </View>
        </View>
      )}

      {body.length > 0 && (
        <MemoryBody content={body} format={memory.bodyFormat ?? 'markdown'} eyebrow="Findings" />
      )}

      {memory.sources && memory.sources.length > 0 && (
        <View style={styles.sourcesCard}>
          <Text style={styles.eyebrow}>Sources</Text>
          <View style={styles.sourcesList}>
            {memory.sources.map((s, i) => (
              <Pressable
                key={`${s.url}-${i}`}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    if (typeof window !== 'undefined') window.open(s.url, '_blank');
                  } else {
                    void Linking.openURL(s.url);
                  }
                }}
                accessibilityRole="link"
                accessibilityLabel={s.title ?? s.url}
                style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                  styles.sourceRow,
                  hovered && styles.sourceRowHover,
                  pressed && styles.sourceRowPressed,
                ]}
              >
                <View style={styles.sourceIcon}>
                  <Ionicons name="link" size={14} color={'#67E8F9'} />
                </View>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  {s.title && (
                    <Text style={styles.sourceTitle} numberOfLines={1}>
                      {s.title}
                    </Text>
                  )}
                  <Text style={styles.sourceUrl} numberOfLines={1}>
                    {s.url}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={14} color={Colors.text.tertiary as string} />
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function labelForScore(s: number): string {
  if (s >= 0.85) return 'Strong evidence';
  if (s >= 0.6) return 'Moderate evidence';
  if (s >= 0.35) return 'Some evidence';
  return 'Weak evidence';
}

function scoreColor(s: number): { backgroundColor: string } {
  if (s >= 0.85) return { backgroundColor: '#34D399' };
  if (s >= 0.6) return { backgroundColor: '#67E8F9' };
  if (s >= 0.35) return { backgroundColor: '#FBBF24' };
  return { backgroundColor: '#FB7185' };
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
  confidenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
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
  confidenceEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  confidenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  confidenceMeter: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-end',
  },
  confidenceTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary as string,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
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
    backgroundColor: 'rgba(34,211,238,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.28)',
  },
  sourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  sourceUrl: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
  },
});

export default MemoryDetailResearch;
