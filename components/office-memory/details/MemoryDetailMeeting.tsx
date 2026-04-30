/**
 * MemoryDetailMeeting — premium center-stage layout for `meeting` (and Zoom)
 * memories. Recording-heavy editorial layout per plan §15.B + §12.1.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Participants strip — overlapped avatar row (8 max)   │
 *   │                                                       │
 *   │ <MediaPlayer kind='video'/'audio'>                    │
 *   │   ─ Premium player: scrub, speed, transcript-sync     │
 *   │                                                       │
 *   │ <MemorySummaryCard summary={memory.summary} />         │
 *   │                                                       │
 *   │ <KeyDecisionsList items={memory.keyDecisions} />       │
 *   │ <ActionItemsList  items={memory.actionItems ?? []} />  │
 *   │                                                       │
 *   │ Transcript ▸ collapsed editorial accordion            │
 *   │   ─ Speaker turns w/ timestamp gutter                 │
 *   └──────────────────────────────────────────────────────┘
 *
 * Framer-style notes (§12.1):
 *   - Editorial rhythm: 24px between sections; 32px before transcript so the
 *     reveal earns a deliberate breath.
 *   - Avatar row floats above the player as a thin "cast list" — masthead feel.
 *   - Transcript section uses a magazine pullquote eyebrow + chevron, never a
 *     button — the affordance reads as editorial, not chrome.
 *   - All section transitions use spring physics via cardAnimations keyframes.
 *   - Empty state for keyDecisions/actionItems: replaced by a soft muted
 *     "No decisions captured yet" tile (matches the §12.1 personality bar).
 */

import React, { useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { MediaPlayer } from '../blocks/MediaPlayer';
import { KeyDecisionsList } from '../blocks/KeyDecisionsList';
import type { KeyDecisionEntry } from '../blocks/KeyDecisionsList';
import { ActionItemsList } from '../blocks/ActionItemsList';
import type { ActionItem } from '../blocks/ActionItemsList';
import { MemorySummaryCard } from './MemorySummaryCard';
import { injectMemoryKeyframes } from '../cardAnimations';

injectMemoryKeyframes();

export interface MemoryDetailMeetingProps {
  memory: MemoryDetail;
  /** When true, render Zoom-specific header chips (meeting id, host, count). */
  zoom?: boolean;
}

// ─── Avatar row helpers ──────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#3B82F6', '#A855F7', '#10B981', '#F59E0B',
  '#EC4899', '#0891B2', '#FB7185', '#818CF8',
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

/** Pull a Zoom meeting id from the title or linkedFacts; fall back to memory id. */
function resolveMeetingId(memory: MemoryDetail): string {
  // Zoom meeting ids are 9–11 digits, optionally with separator dashes.
  const m = memory.title.match(/\b(\d{3}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/);
  if (m) return m[0];
  const fact = (memory.linkedFacts ?? []).find((f) => f.kind === 'meeting');
  if (fact?.label) return fact.label;
  return memory.id.toUpperCase();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemoryDetailMeeting({ memory, zoom = false }: MemoryDetailMeetingProps) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const chevronAnim = React.useRef(new Animated.Value(0)).current;

  const toggleTranscript = () => {
    const next = !transcriptOpen;
    setTranscriptOpen(next);
    Animated.spring(chevronAnim, {
      toValue: next ? 1 : 0,
      damping: 18,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  const chevronRotate = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const participants = memory.participants ?? [];
  const visibleParticipants = participants.slice(0, 8);
  const overflowCount = Math.max(0, participants.length - visibleParticipants.length);

  const transcript = memory.transcript ?? [];
  const hasTranscript = transcript.length > 0;

  // Recording — meeting + zoom default to video; gracefully fall back to audio.
  const recording = memory.recording;

  return (
    <View style={styles.root}>
      {/* Zoom-specific banner — meeting id + host + participant count.
          Backend fixtures (Pass 17) will surface a `zoom` augmentation;
          for V1 we derive these from existing fields with sensible
          fallbacks so the banner never reads "blank." */}
      {zoom && (
        <View style={styles.zoomBanner}>
          <View style={styles.zoomBadge}>
            <Ionicons name="videocam" size={12} color="#60A5FA" />
            <Text style={styles.zoomBadgeText}>ZOOM MEETING</Text>
          </View>
          <View style={styles.zoomMetaRow}>
            <ZoomMeta
              label="Meeting ID"
              value={resolveMeetingId(memory)}
              mono
            />
            <ZoomMeta label="Host" value={memory.createdBy ?? 'Unknown'} />
            <ZoomMeta
              label="Participants"
              value={`${memory.participants?.length ?? 0}`}
            />
          </View>
        </View>
      )}

      {/* Cast list — overlapped avatar row */}
      {visibleParticipants.length > 0 && (
        <View style={styles.castSection}>
          <Text style={styles.eyebrow}>Cast</Text>
          <View style={styles.avatarRow}>
            {visibleParticipants.map((name, idx) => (
              <View
                key={`${name}-${idx}`}
                style={[
                  styles.avatar,
                  {
                    backgroundColor: avatarColor(name),
                    marginLeft: idx === 0 ? 0 : -8,
                    zIndex: visibleParticipants.length - idx,
                  },
                ]}
              >
                <Text style={styles.avatarText}>{initialsFor(name)}</Text>
              </View>
            ))}
            {overflowCount > 0 && (
              <View
                style={[
                  styles.avatar,
                  styles.avatarOverflow,
                  { marginLeft: -8, zIndex: 0 },
                ]}
              >
                <Text style={styles.avatarOverflowText}>+{overflowCount}</Text>
              </View>
            )}
            <View style={styles.castNameStack}>
              {visibleParticipants.slice(0, 3).map((name, i) => (
                <Text key={`${name}-${i}`} style={styles.castName} numberOfLines={1}>
                  {name}
                </Text>
              ))}
              {participants.length > 3 && (
                <Text style={styles.castNameMore}>and {participants.length - 3} more</Text>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Recording — premium media player */}
      {recording?.src && (
        <View style={styles.section}>
          <MediaPlayer
            src={recording.src}
            kind={recording.kind ?? (zoom ? 'video' : 'video')}
            durationSec={recording.durationSec}
            transcript={transcript}
          />
        </View>
      )}

      {/* Summary — magazine pullquote */}
      <View style={styles.section}>
        <MemorySummaryCard summary={memory.summary} />
      </View>

      {/* Key decisions */}
      <View style={styles.section}>
        <KeyDecisionsList
          decisions={
            (memory.keyDecisions ?? []).map<KeyDecisionEntry>((d) => ({
              label: d.label,
            }))
          }
        />
      </View>

      {/* Action items — until backend Pass 17 populates an `actionItems`
          field on MemoryDetail, the parent fixture is responsible for
          shaping this. We accept it via a non-typed escape hatch and
          fall back to an empty list (which renders the personality
          empty-state, never blank). */}
      <View style={styles.section}>
        <ActionItemsList
          items={((memory as any).actionItems as ActionItem[]) ?? []}
        />
      </View>

      {/* Transcript — collapsed editorial accordion */}
      {hasTranscript && (
        <View style={styles.transcriptWrap}>
          <Pressable
            onPress={toggleTranscript}
            accessibilityRole="button"
            accessibilityLabel={transcriptOpen ? 'Collapse transcript' : 'Expand transcript'}
            accessibilityState={{ expanded: transcriptOpen }}
            style={({ pressed }) => [
              styles.transcriptHead,
              pressed && styles.transcriptHeadPressed,
            ]}
          >
            <View style={styles.transcriptHeadLeft}>
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={Colors.text.tertiary}
                />
              </Animated.View>
              <Text style={styles.eyebrow}>Transcript</Text>
            </View>
            <Text style={styles.transcriptCount}>
              {transcript.length} turn{transcript.length === 1 ? '' : 's'}
            </Text>
          </Pressable>

          {transcriptOpen && (
            <ScrollView
              style={styles.transcriptScroll}
              contentContainerStyle={styles.transcriptScrollContent}
              nestedScrollEnabled
            >
              {transcript.map((turn, idx) => (
                <View
                  key={`${idx}-${turn.t}`}
                  style={styles.turnRow}
                >
                  <View style={styles.turnGutter}>
                    <Text style={styles.turnTimestamp}>
                      {formatSeconds(turn.t)}
                    </Text>
                  </View>
                  <View style={styles.turnBody}>
                    <Text style={styles.turnSpeaker}>{turn.speaker}</Text>
                    <Text style={styles.turnText}>{turn.text}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m.toString().padStart(2, '0')}:${s}`;
}

function ZoomMeta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.zoomMetaItem}>
      <Text style={styles.zoomMetaLabel}>{label}</Text>
      <Text
        style={[styles.zoomMetaValue, mono && styles.zoomMetaValueMono]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    gap: 24,
    minWidth: 0,
  },
  section: {
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },

  // Zoom banner
  zoomBanner: {
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: 16,
    gap: 12,
  },
  zoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  zoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#60A5FA',
  },
  zoomMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  zoomMetaItem: {
    minWidth: 0,
  },
  zoomMetaLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  zoomMetaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  zoomMetaValueMono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },

  // Cast row
  castSection: {
    gap: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a0a0c',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  avatarOverflow: {
    backgroundColor: '#1a1a1d',
    borderColor: '#0a0a0c',
  },
  avatarOverflowText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  castNameStack: {
    marginLeft: 14,
    minWidth: 0,
    flexShrink: 1,
  },
  castName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  castNameMore: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
    lineHeight: 18,
    marginTop: 2,
  },

  // Transcript accordion
  transcriptWrap: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
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
  transcriptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  transcriptHeadPressed: {
    opacity: 0.75,
  },
  transcriptHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  transcriptCount: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  transcriptScroll: {
    maxHeight: 420,
  },
  transcriptScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  turnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  turnGutter: {
    width: 56,
    paddingTop: 2,
  },
  turnTimestamp: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },
  turnBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  turnSpeaker: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  turnText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 22,
  },
});

export default MemoryDetailMeeting;
