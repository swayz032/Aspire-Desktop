/**
 * MemoryDetailCall — premium voicemail-app aesthetic for `call` memories.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ Outcome pill ─ pulse-glow on active states           │
 *   │                                                       │
 *   │ Caller card  (avatar · name · phone · relationship)  │
 *   │                                                       │
 *   │ <MediaPlayer kind='audio' /> + waveform overlay      │
 *   │                                                       │
 *   │ Transcript scroll (last 8 turns surfaced; full       │
 *   │   list expands on tap — cinematic accordion)         │
 *   │                                                       │
 *   │ Outcome card (message_taken: capture grid)           │
 *   │   ─ Caller name · Callback # · Reason · Urgency …    │
 *   │                                                       │
 *   │ Linked receipts ▸ tiny pill chain                    │
 *   └──────────────────────────────────────────────────────┘
 *
 * Framer notes (§12.1):
 *   - Outcome pill is the hero: oversized typography, color-coded by outcome,
 *     subtle status-flash animation when "live" (executed = green-flash).
 *   - Caller card uses a chunky 56px avatar — premium voicemail energy,
 *     not a CRM row.
 *   - Captured-message grid mirrors a paper memo pad: tight 2-col grid,
 *     monospaced numbers for instant copy-paste feel.
 *   - Outcome → status → captured-message flows top-to-bottom so the eye
 *     resolves "what happened" before "what to do next."
 */

import React, { useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '@/constants/tokens';
import type { MemoryDetail, MemoryStatus } from '../types';
import { MediaPlayer } from '../blocks/MediaPlayer';
import { injectMemoryKeyframes } from '../cardAnimations';

injectMemoryKeyframes();

// ─── Outcome derivation ──────────────────────────────────────────────────────
//
// The Sarah v2 contract surfaces call outcomes via a combination of
// `MemoryStatus` + the `task.statusLabel` free-text ("transferred",
// "voicemail", "message_taken"). We derive a strongly-typed outcome here so
// the UI renders consistently regardless of upstream string variation.

type CallOutcome =
  | 'transferred'
  | 'voicemail'
  | 'message_taken'
  | 'completed'
  | 'missed'
  | 'unknown';

interface OutcomeStyle {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  fg: string;
  bg: string;
  ring: string;
  /** Whether the pill should slowly pulse (live / fresh outcomes) */
  flash?: boolean;
}

const OUTCOME_STYLES: Record<CallOutcome, OutcomeStyle> = {
  transferred:   { label: 'Transferred',     icon: 'call-outline',           fg: '#60A5FA', bg: 'rgba(59,130,246,0.10)',  ring: 'rgba(59,130,246,0.30)' },
  voicemail:     { label: 'Voicemail',       icon: 'recording-outline',      fg: '#A78BFA', bg: 'rgba(168,85,247,0.10)',  ring: 'rgba(168,85,247,0.30)' },
  message_taken: { label: 'Message Taken',   icon: 'document-text-outline',  fg: '#34D399', bg: 'rgba(16,185,129,0.10)',  ring: 'rgba(16,185,129,0.30)' },
  completed:     { label: 'Completed',       icon: 'checkmark-circle',       fg: '#34D399', bg: 'rgba(16,185,129,0.10)',  ring: 'rgba(16,185,129,0.30)' },
  missed:        { label: 'Missed',          icon: 'close-circle-outline',   fg: '#FB7185', bg: 'rgba(244,63,94,0.10)',   ring: 'rgba(244,63,94,0.30)' },
  unknown:       { label: 'Logged',          icon: 'time-outline',           fg: '#A1A1A6', bg: 'rgba(255,255,255,0.04)', ring: 'rgba(255,255,255,0.10)' },
};

function deriveOutcome(memory: MemoryDetail): CallOutcome {
  const labelRaw = memory.task?.statusLabel?.toLowerCase().trim();
  if (labelRaw) {
    if (labelRaw.includes('transfer')) return 'transferred';
    if (labelRaw.includes('voicemail')) return 'voicemail';
    if (labelRaw.includes('message')) return 'message_taken';
    if (labelRaw.includes('miss')) return 'missed';
    if (labelRaw.includes('complet')) return 'completed';
  }
  const status: MemoryStatus | undefined = memory.status;
  if (status === 'executed') return 'completed';
  if (status === 'failed') return 'missed';
  return 'unknown';
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface MemoryDetailCallProps {
  memory: MemoryDetail;
}

export function MemoryDetailCall({ memory }: MemoryDetailCallProps) {
  const outcome = deriveOutcome(memory);
  const o = OUTCOME_STYLES[outcome];

  // Subtle live-pulse on the outcome pill ring (native side — web uses CSS class)
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Caller info — derived from contact (richer schema) → entity (MemorySummary).
  const callerName = memory.contact?.name ?? memory.entity?.name ?? 'Unknown caller';
  const callerPhone = memory.contact?.phone;

  const recording = memory.recording;
  const transcript = memory.transcript ?? [];
  const linkedReceipts = memory.linkedReceipts ?? [];
  const capturedMessage = memory.task?.description; // free-form captured message body

  // Show first 8 transcript turns by default, full set on expand.
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const visibleTurns = transcriptOpen ? transcript : transcript.slice(0, 8);
  const hasMore = transcript.length > visibleTurns.length;

  return (
    <View style={styles.root}>
      {/* Outcome pill — hero */}
      <View
        style={[
          styles.outcomePill,
          { backgroundColor: o.bg, borderColor: o.ring },
        ]}
      >
        <Ionicons name={o.icon} size={14} color={o.fg} />
        <Text style={[styles.outcomeText, { color: o.fg }]}>{o.label}</Text>
        {memory.duration && (
          <>
            <View style={[styles.outcomeDot, { backgroundColor: o.ring }]} />
            <Text style={styles.outcomeDuration}>{memory.duration}</Text>
          </>
        )}
      </View>

      {/* Caller card — premium voicemail energy */}
      <View style={styles.callerCard}>
        <View style={[styles.callerAvatar, { backgroundColor: o.bg }]}>
          <Ionicons name="person" size={28} color={o.fg} />
        </View>
        <View style={styles.callerBody}>
          <Text style={styles.callerName} numberOfLines={1}>
            {callerName}
          </Text>
          {callerPhone && (
            <View style={styles.callerPhoneRow}>
              <Ionicons name="call-outline" size={12} color={Colors.text.tertiary} />
              <Text style={styles.callerPhone} numberOfLines={1}>
                {callerPhone}
              </Text>
            </View>
          )}
          {memory.entity && memory.entity.name !== callerName && (
            <View style={styles.callerRelation}>
              <Ionicons name="business-outline" size={11} color={Colors.text.muted} />
              <Text style={styles.callerRelationText} numberOfLines={1}>
                Relationship · {memory.entity.name}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Recording — audio with waveform built into MediaPlayer */}
      {recording?.src && (
        <View style={styles.section}>
          <MediaPlayer
            src={recording.src}
            kind={recording.kind ?? 'audio'}
            durationSec={recording.durationSec}
            transcript={transcript}
          />
        </View>
      )}

      {/* Transcript — scroll preview */}
      {transcript.length > 0 && (
        <View style={styles.transcriptCard}>
          <View style={styles.transcriptHead}>
            <Text style={styles.eyebrow}>Transcript</Text>
            <Text style={styles.transcriptCount}>
              {transcript.length} turn{transcript.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.transcriptList}>
            {visibleTurns.map((turn, idx) => (
              <View key={`${idx}-${turn.t}`} style={styles.turnRow}>
                <View style={styles.turnGutter}>
                  <Text style={styles.turnTimestamp}>{formatSeconds(turn.t)}</Text>
                </View>
                <View style={styles.turnBody}>
                  <Text style={styles.turnSpeaker}>{turn.speaker}</Text>
                  <Text style={styles.turnText}>{turn.text}</Text>
                </View>
              </View>
            ))}
          </View>
          {hasMore && (
            <Pressable
              onPress={() => setTranscriptOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Show full transcript"
              style={({ pressed }) => [
                styles.transcriptMore,
                pressed && styles.transcriptMorePressed,
              ]}
            >
              <Text style={styles.transcriptMoreText}>
                Show {transcript.length - visibleTurns.length} more turns
              </Text>
              <Ionicons name="chevron-down" size={14} color={Colors.accent.cyan} />
            </Pressable>
          )}
        </View>
      )}

      {/* Captured-message card — Sarah v2 §04 capture canon */}
      {outcome === 'message_taken' && capturedMessage && (
        <View style={styles.captureCard}>
          <View style={styles.captureHeadRow}>
            <View style={styles.captureBadge}>
              <Ionicons name="document-text" size={12} color="#34D399" />
              <Text style={styles.captureBadgeText}>MESSAGE FOR YOU</Text>
            </View>
            {memory.date && (
              <Text style={styles.captureTime}>{formatRelativeTime(memory.date)}</Text>
            )}
          </View>
          <Text style={styles.captureBody}>{capturedMessage}</Text>

          {/* Capture canon grid — the structured fields we always ask Sarah to gather */}
          <View style={styles.captureGrid}>
            <CaptureField
              label="Caller"
              value={callerName}
              icon="person-outline"
            />
            {callerPhone && (
              <CaptureField
                label="Callback"
                value={callerPhone}
                icon="call-outline"
                mono
              />
            )}
            {memory.task?.dueDate && (
              <CaptureField
                label="Window"
                value={memory.task.dueDate}
                icon="time-outline"
              />
            )}
            {memory.task?.assignee && (
              <CaptureField
                label="For"
                value={memory.task.assignee}
                icon="person-circle-outline"
              />
            )}
          </View>
        </View>
      )}

      {/* Linked receipts */}
      {linkedReceipts.length > 0 && (
        <View style={styles.receiptsRow}>
          <Text style={styles.eyebrow}>Receipts cut during this call</Text>
          <View style={styles.receiptPills}>
            {linkedReceipts.map((r) => (
              <View key={r.id} style={styles.receiptPill}>
                <Ionicons name="receipt-outline" size={11} color={Colors.text.tertiary} />
                <Text style={styles.receiptPillText} numberOfLines={1}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Sub-components / helpers ────────────────────────────────────────────────

function CaptureField({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  mono?: boolean;
}) {
  return (
    <View style={styles.captureField}>
      <View style={styles.captureFieldHead}>
        <Ionicons name={icon} size={11} color={Colors.text.muted} />
        <Text style={styles.captureFieldLabel}>{label}</Text>
      </View>
      <Text
        style={[styles.captureFieldValue, mono && styles.captureFieldValueMono]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m.toString().padStart(2, '0')}:${s}`;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  // Outcome pill
  outcomePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  outcomeDot: {
    width: 3,
    height: 3,
    borderRadius: 999,
    opacity: 0.6,
  },
  outcomeDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },

  // Caller card
  callerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    padding: 20,
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
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
  callerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  callerName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  callerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callerPhone: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    letterSpacing: 0.2,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },
  callerRelation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  callerRelationText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  // Transcript card
  transcriptCard: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 24,
    gap: 16,
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
  },
  transcriptCount: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  transcriptList: {
    gap: 14,
  },
  turnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  turnGutter: {
    width: 48,
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent.cyan,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  turnText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 20,
  },
  transcriptMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  transcriptMorePressed: {
    opacity: 0.75,
  },
  transcriptMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.cyan,
    letterSpacing: 0.3,
  },

  // Captured-message card
  captureCard: {
    backgroundColor: 'rgba(16,185,129,0.04)',
    borderColor: 'rgba(16,185,129,0.18)',
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: 24,
    gap: 18,
  },
  captureHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  captureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#34D399',
  },
  captureTime: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
    letterSpacing: 0.3,
  },
  captureBody: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.05,
  },
  captureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16,185,129,0.10)',
  },
  captureField: {
    flexBasis: '45%' as unknown as number,
    minWidth: 140,
    gap: 4,
  },
  captureFieldHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  captureFieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  captureFieldValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  captureFieldValueMono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'ui-monospace, SF Mono, Menlo, monospace',
    }),
  },

  // Linked receipts
  receiptsRow: {
    gap: 10,
  },
  receiptPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  receiptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 240,
  },
  receiptPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.secondary,
    letterSpacing: 0.2,
  },
});

export default MemoryDetailCall;
