/**
 * InviteSheet — Premium 4-tab invite system for Conference Room
 *
 * Now delegates to InviteTabContent for all tab logic and UI.
 * This component provides the modal shell (overlay, backdrop, sheet chrome).
 * Backward compatible — same export name, same props interface.
 *
 * Tab 1: "Team"         — Search & invite suite members (internal)
 * Tab 2: "Aspire User"  — Cross-suite lookup by Suite ID + Office ID
 * Tab 3: "External"     — Email invite to non-Aspire guests (YELLOW tier via Eli)
 * Tab 4: "Link"         — Shareable room link with guest token
 *
 * Law #3: All API calls use authenticatedFetch (JWT + X-Suite-Id).
 * Law #6: Internal search is RLS-scoped. Cross-suite returns display names only.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { InviteTabContent, PressableScale } from '@/components/session/InviteTabContent';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  roomName: string;
  hostName: string;
  purpose: string;
  correlationId?: string;
  onInviteMember: (userId: string, name: string, inviteType?: 'internal' | 'cross-suite') => void;
  onInviteGuest: (name: string, contact: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InviteSheet({
  visible,
  onClose,
  roomName,
  hostName,
  purpose,
  correlationId,
  onInviteMember,
  onInviteGuest,
}: InviteSheetProps) {
  // Key increments on close to force InviteTabContent remount (resets internal state)
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!visible) {
      setResetKey(prev => prev + 1);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { pointerEvents: 'box-none' }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close invite sheet"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { pointerEvents: 'auto' }]} accessible accessibilityLabel="Invite participant dialog">
          {/* Handle bar — 36x4 centered */}
          <View style={styles.handle} accessibilityElementsHidden />
          <Text style={styles.title} accessibilityRole="header">Invite Participant</Text>

          {/* Delegated tab content — remounts on close via key */}
          <InviteTabContent
            key={resetKey}
            roomName={roomName}
            hostName={hostName}
            purpose={purpose}
            correlationId={correlationId}
            onInviteMember={onInviteMember}
            onInviteGuest={onInviteGuest}
          />

          {/* Cancel button */}
          <PressableScale
            style={styles.cancelButton}
            onPress={onClose}
            accessibilityLabel="Close invite sheet"
          >
            <Text style={styles.cancelText}>Close</Text>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheet: {
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '85%',
    zIndex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border.default,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headline,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  cancelButton: {
    backgroundColor: Colors.background.tertiary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  cancelText: {
    ...Typography.body,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
});
