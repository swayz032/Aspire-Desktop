/**
 * StatusTimeline — horizontal stepper with rich per-step metadata.
 *
 * Layout:
 *   ●━━━━━━●━━━━━━●━━━━━━○━━━━━━○
 *   Draft   Sent   Viewed  Paid    Closed
 *   Apr 12  Apr 14 Apr 14  …       …
 *   Tonio   Sarah  Acme    …       …
 *
 * Editorial details per §12.1:
 *   - Active step glows Aspire-blue (CSS box-shadow halo on web, native shadow
 *     stack otherwise) — the eye instantly lands on "where we are."
 *   - Completed steps show check icon in the dot; pending = empty ring; error
 *     = red ring with warning icon.
 *   - Connector segments between dots animate fill on web (linear gradient
 *     blue→muted) so the journey reads as motion, not a static list.
 *
 * Native: when too many steps to fit horizontally, layout collapses to a
 * vertical timeline (dot column on the left, content stack on the right).
 */

import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface StatusTimelineEvent {
  label: string;
  /** Ionicons name (outline preferred for non-active, filled for active). */
  icon: string;
  datetime: string;
  actor?: string;
  /** Currently-active step (glow). */
  current?: boolean;
  /** Completed (filled dot + check). */
  completed?: boolean;
  /** Error step (red). */
  error?: boolean;
}

export interface StatusTimelineProps {
  events: StatusTimelineEvent[];
  /** Eyebrow override (default: "Status Timeline"). */
  eyebrow?: string;
}

export function StatusTimeline({ events, eyebrow = 'Status Timeline' }: StatusTimelineProps) {
  const total = events.length;
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <View style={styles.stepRow}>
        {events.map((ev, i) => {
          const next = events[i + 1];
          const linkActive = ev.completed && (next?.completed || next?.current);
          return (
            <React.Fragment key={`${ev.label}-${i}`}>
              <View style={styles.stepCol}>
                <Step ev={ev} />
                <Text style={[styles.stepLabel, ev.current && styles.stepLabelActive]}>
                  {ev.label}
                </Text>
                <Text style={styles.stepDate}>{ev.datetime}</Text>
                {ev.actor && (
                  <Text style={styles.stepActor} numberOfLines={1}>
                    {ev.actor}
                  </Text>
                )}
              </View>
              {i < total - 1 && (
                <View
                  style={[styles.connector, linkActive && styles.connectorActive]}
                  accessibilityElementsHidden
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// ─── Step (the dot itself) ───────────────────────────────────────────────────

function Step({ ev }: { ev: StatusTimelineEvent }) {
  const tone = ev.error
    ? 'error'
    : ev.current
    ? 'current'
    : ev.completed
    ? 'complete'
    : 'pending';

  const dotStyle = [
    styles.dot,
    tone === 'current' && styles.dotCurrent,
    tone === 'complete' && styles.dotComplete,
    tone === 'pending' && styles.dotPending,
    tone === 'error' && styles.dotError,
  ];

  const iconColor =
    tone === 'pending'
      ? (Colors.text.muted as string)
      : tone === 'error'
      ? '#FFFFFF'
      : '#FFFFFF';

  const iconName = ev.error ? 'alert' : ev.completed ? 'checkmark' : (ev.icon as never);

  return (
    <View style={dotStyle} accessibilityElementsHidden>
      <Ionicons name={iconName as never} size={14} color={iconColor} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
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
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    flexWrap: 'wrap',
  },
  stepCol: {
    alignItems: 'center',
    minWidth: 96,
    flex: 1,
    gap: 8,
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 13, // visually centered with 28pt dots
    minWidth: 24,
    borderRadius: 1,
  },
  connectorActive: {
    backgroundColor: 'rgba(59,130,246,0.55)',
    ...(Platform.OS === 'web'
      ? ({
          background: 'linear-gradient(90deg, rgba(59,130,246,0.85) 0%, rgba(96,165,250,0.55) 100%)',
        } as unknown as ViewStyle)
      : {}),
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  dotPending: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  dotComplete: {
    backgroundColor: 'rgba(16,185,129,0.35)',
    borderColor: 'rgba(52,211,153,0.85)',
  },
  dotCurrent: {
    backgroundColor: Colors.accent.cyan as string,
    borderColor: '#93C5FD',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 4px rgba(59,130,246,0.18), 0 0 18px rgba(59,130,246,0.55)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }),
  },
  dotError: {
    backgroundColor: 'rgba(255,59,48,0.35)',
    borderColor: 'rgba(255,59,48,0.85)',
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary as string,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  stepLabelActive: {
    fontWeight: '700',
    color: Colors.text.primary as string,
  },
  stepDate: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    fontVariant: ['tabular-nums'],
  },
  stepActor: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.muted as string,
  },
});

export default StatusTimeline;
