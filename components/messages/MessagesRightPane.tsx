/**
 * MessagesRightPane — right-pane state machine for `/session/messages`
 * (plan §3.9.4, Lane E4).
 *
 * Branches on:
 *   (A) `selectedThread === null && threadCount === 0` → MessagesZeroState
 *       — premium getting-started panel for fresh tenants
 *   (B) `selectedThread === null && threadCount > 0`   → MessagesSuggestedActions
 *       — Ava-recommended follow-ups
 *   (C) `selectedThread !== null`                       → MessagesThreadView
 *       — chat-bubble stream + composer + A2P banner
 *   (D) Compose-active                                  → Lane E5's NewMessageSheet
 *       mounts OVER state (B) (the parent page owns the sheet — this pane
 *       does NOT render anything special for state D, by design).
 *
 * State transitions use a 300ms ease-out crossfade so changes feel intentional.
 * The crossfade is implemented via a tiny `Animated.Value` per branch: when
 * the active state changes, the outgoing branch fades opacity 1→0 (140ms)
 * while the incoming branch fades 0→1 (180ms, slight overlap). The result is
 * a perceptible-but-quick swap that matches plan §12.1 motion timing.
 *
 * `prefers-reduced-motion`: the crossfade is bypassed and the new branch
 * snaps to opacity 1 immediately. We respect the OS preference via the same
 * `matchMedia` singleton pattern used elsewhere in the app.
 *
 * This pane is a thin selector — it owns NO render logic of its own beyond
 * routing the current state to one of the three sub-components. That keeps
 * the state machine auditable in isolation.
 *
 * Props contract (from Lane E2 page handoff):
 *   selectedThread: MessageThreadSummary | null
 *   threadCount: number
 *   onComposeNew: () => void
 *   onOpenContacts: () => void
 *
 * Exports:
 *   - default export: MessagesRightPane
 *   - named export: MessagesRightPane (matches the Lane E2 try-import)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform, Easing } from 'react-native';
import type { MessageThreadSummary } from './fixtures';
import { MessagesZeroState } from './MessagesZeroState';
import { MessagesSuggestedActions } from './MessagesSuggestedActions';
import { MessagesThreadView } from './MessagesThreadView';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MessagesRightPaneProps {
  /** Currently selected thread (null when nothing selected). */
  selectedThread: MessageThreadSummary | null;
  /** Total active (non-archived) thread count — drives state A vs B. */
  threadCount: number;
  /** Open the NewMessageSheet (Lane E5 owns the sheet). */
  onComposeNew: () => void;
  /** Open the contacts side panel (Lane E5 owns the panel). */
  onOpenContacts: () => void;
}

/** Internal discriminator — derived from props every render. */
type RightPaneState =
  | { kind: 'zero' }
  | { kind: 'suggestions' }
  | { kind: 'thread'; thread: MessageThreadSummary };

// ---------------------------------------------------------------------------
// Reduced-motion singleton — same pattern as other Aspire UI surfaces.
// ---------------------------------------------------------------------------

let reducedMotionMatch: MediaQueryList | null = null;
function readReducedMotion(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (!reducedMotionMatch) {
    reducedMotionMatch = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return !!reducedMotionMatch?.matches;
}

// ---------------------------------------------------------------------------
// State derivation — pure function of props
// ---------------------------------------------------------------------------

function deriveState(
  selectedThread: MessageThreadSummary | null,
  threadCount: number,
): RightPaneState {
  if (selectedThread) return { kind: 'thread', thread: selectedThread };
  if (threadCount === 0) return { kind: 'zero' };
  return { kind: 'suggestions' };
}

/**
 * Stable identity key for animation purposes — used to detect a "real"
 * transition. Switching threads from thread A → thread B should crossfade
 * (different keys); revealing/hiding the same thread shouldn't.
 */
function stateKey(s: RightPaneState): string {
  switch (s.kind) {
    case 'zero':
      return 'zero';
    case 'suggestions':
      return 'suggestions';
    case 'thread':
      return `thread:${s.thread.thread_id}`;
  }
}

// ---------------------------------------------------------------------------
// Inner component — owns the crossfade lifecycle
// ---------------------------------------------------------------------------

function MessagesRightPaneInner({
  selectedThread,
  threadCount,
  onComposeNew,
  onOpenContacts,
}: MessagesRightPaneProps) {
  // Current = what the parent says we should be showing.
  // Outgoing = what we still have on screen, fading out.
  // We render BOTH during a transition; only `current` is interactive.
  const current = useMemo(
    () => deriveState(selectedThread, threadCount),
    [selectedThread, threadCount],
  );

  const prevKeyRef = useRef<string>(stateKey(current));
  const [outgoing, setOutgoing] = useState<RightPaneState | null>(null);
  const incomingOpacity = useRef(new Animated.Value(1)).current;
  const outgoingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const newKey = stateKey(current);
    if (newKey === prevKeyRef.current) return;

    // Real transition — set up the crossfade.
    if (readReducedMotion()) {
      // Reduced motion: snap, no animation.
      prevKeyRef.current = newKey;
      setOutgoing(null);
      incomingOpacity.setValue(1);
      outgoingOpacity.setValue(0);
      return;
    }

    // Capture the previous render as outgoing. The incoming starts at 0.
    // We can't actually capture component state, so we fade out the
    // *previous* derived state (which the parent had given us pre-update).
    // We rely on the prevKeyRef to know what the previous shape was.
    setOutgoing(rebuildPrev(prevKeyRef.current, selectedThread));
    prevKeyRef.current = newKey;

    incomingOpacity.setValue(0);
    outgoingOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(outgoingOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(incomingOpacity, {
        toValue: 1,
        duration: 180,
        delay: 60,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setOutgoing(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.kind, current.kind === 'thread' ? current.thread.thread_id : '']);

  return (
    <View style={styles.wrap}>
      {/* Outgoing branch (only present during a transition) */}
      {outgoing && (
        <Animated.View
          style={[styles.layer, { opacity: outgoingOpacity }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <RenderState
            state={outgoing}
            onComposeNew={onComposeNew}
            onOpenContacts={onOpenContacts}
          />
        </Animated.View>
      )}

      {/* Incoming / current branch — interactive */}
      <Animated.View style={[styles.layer, { opacity: incomingOpacity }]}>
        <RenderState
          state={current}
          onComposeNew={onComposeNew}
          onOpenContacts={onOpenContacts}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Reconstruct what we had on screen before the prop change. We only know
 * the previous state's *shape* (zero / suggestions / thread:<id>); for the
 * thread case we use the still-current selectedThread when available, or a
 * minimal stub when not. This is good enough for a 200ms crossfade — the
 * outgoing layer is non-interactive and pointer-events-locked anyway.
 */
function rebuildPrev(
  prevKey: string,
  currentSelected: MessageThreadSummary | null,
): RightPaneState {
  if (prevKey === 'zero') return { kind: 'zero' };
  if (prevKey === 'suggestions') return { kind: 'suggestions' };
  if (prevKey.startsWith('thread:')) {
    // Best-effort: if we still hold the thread, use it; else fall back to
    // suggestions for the outgoing layer (cheaper than synthesizing a fake
    // MessageThreadSummary that would clutter the a11y tree).
    if (currentSelected && `thread:${currentSelected.thread_id}` === prevKey) {
      return { kind: 'thread', thread: currentSelected };
    }
    return { kind: 'suggestions' };
  }
  return { kind: 'suggestions' };
}

// ---------------------------------------------------------------------------
// Render the active state — pure switch
// ---------------------------------------------------------------------------

interface RenderStateProps {
  state: RightPaneState;
  onComposeNew: () => void;
  onOpenContacts: () => void;
}

function RenderState({ state, onComposeNew, onOpenContacts }: RenderStateProps) {
  switch (state.kind) {
    case 'zero':
      return (
        <MessagesZeroState
          onComposeNew={onComposeNew}
          onOpenContacts={onOpenContacts}
        />
      );
    case 'suggestions':
      return (
        <MessagesSuggestedActions
          onComposeNew={onComposeNew}
          onOpenContacts={onOpenContacts}
        />
      );
    case 'thread':
      return <MessagesThreadView selectedThread={state.thread} />;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

// ---------------------------------------------------------------------------
// Public exports — both default and named for try-import compatibility
// ---------------------------------------------------------------------------

export function MessagesRightPane(props: MessagesRightPaneProps) {
  return <MessagesRightPaneInner {...props} />;
}

export default MessagesRightPane;
