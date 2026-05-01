/**
 * MessagesRightPane.demo — interactive cycle through the 4 right-pane
 * states. Designed to validate the state-machine selector + crossfade
 * transitions in isolation.
 *
 * Variant cycler at top — click each chip to swap state. The crossfade
 * (180ms in / 140ms out) should feel intentional, not abrupt.
 *
 * State (D) — compose-active — is owned by Lane E5's NewMessageSheet,
 * which mounts OVER state (B). For demo purposes we simulate state (D)
 * by overlaying a placeholder banner on top of the suggestions branch.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { MessagesRightPane } from './MessagesRightPane';
import { MOCK_THREADS_5, type MessageThreadSummary } from './fixtures';

type DemoState = 'zero' | 'suggestions' | 'thread' | 'compose';

const STATES: { id: DemoState; label: string; description: string }[] = [
  {
    id: 'zero',
    label: 'A · Zero state',
    description: 'No conversations yet — premium getting-started panel',
  },
  {
    id: 'suggestions',
    label: 'B · Suggestions',
    description: 'Conversations exist, none selected — Ava follow-ups',
  },
  {
    id: 'thread',
    label: 'C · Thread',
    description: 'Thread selected — bubble stream + composer',
  },
  {
    id: 'compose',
    label: 'D · Compose',
    description: 'NewMessageSheet (Lane E5 owned) mounts over state B',
  },
];

const SAMPLE_THREAD: MessageThreadSummary = MOCK_THREADS_5[0];

export default function MessagesRightPaneDemo() {
  const [state, setState] = useState<DemoState>('zero');

  // Map demo state → MessagesRightPane props
  const selectedThread = state === 'thread' ? SAMPLE_THREAD : null;
  const threadCount = state === 'zero' ? 0 : MOCK_THREADS_5.length;

  return (
    <View style={styles.root}>
      {/* ---------- Cycler ---------- */}
      <View style={styles.cyclerOuter}>
        <Text style={styles.cyclerLabel}>RIGHT-PANE STATE</Text>
        <View style={styles.cyclerChips}>
          {STATES.map((s) => (
            <Chip
              key={s.id}
              active={s.id === state}
              label={s.label}
              onPress={() => setState(s.id)}
            />
          ))}
        </View>
        <Text style={styles.cyclerDescription}>
          {STATES.find((s) => s.id === state)?.description}
        </Text>
      </View>

      {/* ---------- Render frame matching real page right column ---------- */}
      <View style={styles.frame}>
        <MessagesRightPane
          selectedThread={selectedThread}
          threadCount={threadCount}
          onComposeNew={() => setState('compose')}
          onOpenContacts={() => {
            // No-op for demo — log only.
            if (Platform.OS === 'web' && typeof console !== 'undefined') {
              console.info(
                '[demo] open contacts — Lane E5 ContactsSidePanel pending',
              );
            }
          }}
        />

        {/* Compose overlay — simulates Lane E5's NewMessageSheet mounting
            over state (B) without conflicting with the right-pane state
            machine. Once Lane E5 lands, this overlay drops out. */}
        {state === 'compose' && (
          <ComposeOverlayStub onClose={() => setState('suggestions')} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

interface ChipProps {
  active: boolean;
  label: string;
  onPress: () => void;
}

function Chip({ active, label, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Show ${label}`}
      style={({ pressed }) => [
        chipStyles.wrap,
        active ? chipStyles.wrapActive : chipStyles.wrapInactive,
        pressed && chipStyles.wrapPressed,
      ]}
    >
      <Text
        style={[
          chipStyles.label,
          active ? chipStyles.labelActive : chipStyles.labelInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapActive: {
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderColor: 'rgba(59,130,246,0.45)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 0 14px rgba(59,130,246,0.22)' } as object)
      : {}),
  } as any,
  wrapInactive: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  wrapPressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: Colors.text.tertiary,
  },
});

// ---------------------------------------------------------------------------
// Compose overlay stub — Lane E5 replaces this with NewMessageSheet
// ---------------------------------------------------------------------------

function ComposeOverlayStub({ onClose }: { onClose: () => void }) {
  return (
    <View
      style={overlayStyles.backdrop}
      accessibilityRole="alert"
      accessibilityLabel="New message composer placeholder"
      accessibilityViewIsModal
    >
      <View style={overlayStyles.card}>
        <View style={overlayStyles.iconHalo}>
          <Ionicons name="create-outline" size={26} color={Colors.accent.cyan} />
        </View>
        <Text style={overlayStyles.title}>NewMessageSheet placeholder</Text>
        <Text style={overlayStyles.body}>
          Lane E5 owns this overlay. It mounts on top of state (B) and the
          right pane stays mounted underneath — the state machine doesn’t
          render anything different for state (D). Closing returns to (B).
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close compose placeholder"
          style={({ pressed }) => [
            overlayStyles.cta,
            pressed && overlayStyles.ctaPressed,
          ]}
        >
          <Ionicons name="close" size={14} color="#ffffff" />
          <Text style={overlayStyles.ctaText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const overlayStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,12,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)' } as object)
      : {}),
  } as any,
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    backgroundColor: '#1A1A1C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 12px 36px rgba(0,0,0,0.5), 0 0 32px rgba(59,130,246,0.10)',
        } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.5,
          shadowRadius: 22,
        }),
  } as any,
  iconHalo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.tertiary,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 340,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    minWidth: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: 4,
  },
  ctaPressed: {
    backgroundColor: Colors.accent.cyanDark,
    opacity: 0.95,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.1,
  },
});

// ---------------------------------------------------------------------------
// Page styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    padding: 32,
    gap: 20,
    ...(Platform.OS === 'web' ? ({ height: '100%' } as object) : {}),
  } as any,
  cyclerOuter: {
    gap: 10,
  },
  cyclerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  cyclerChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cyclerDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  frame: {
    flex: 1,
    minHeight: 600,
    backgroundColor: '#0d0d0d',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
});
