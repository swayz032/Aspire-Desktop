/**
 * GuestConferenceLayout — Flex layout for guest conference view.
 *
 * Renders Aspire-branded header, Nora tile as a participant alongside
 * the Zoom UI Toolkit, and a branded footer.
 *
 * Desktop: Nora on left (proportional, 240-320px), Toolkit fills remaining.
 * Tablet (<1024): Nora narrower (200px fixed).
 * Mobile (<768px): Nora as compact 120px strip on top, Toolkit below.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { NoraTile } from '@/components/session/NoraTile';
import { GuestConferenceHeader } from '@/components/session/GuestConferenceHeader';
import type { RoomAvaState } from '@/components/session/RoomAvaTile';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

type LayoutMode = 'mobile' | 'tablet' | 'desktop';

interface GuestConferenceLayoutProps {
  roomName: string;
  children: React.ReactNode; // The Zoom UI Toolkit container
  noraState?: RoomAvaState;
  isNoraSpeaking?: boolean;
}

export function GuestConferenceLayout({
  roomName,
  children,
  noraState = 'idle',
  isNoraSpeaking = false,
}: GuestConferenceLayoutProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('desktop');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const checkWidth = () => {
      const w = window.innerWidth;
      if (w < MOBILE_BREAKPOINT) setLayoutMode('mobile');
      else if (w < TABLET_BREAKPOINT) setLayoutMode('tablet');
      else setLayoutMode('desktop');
    };

    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const isMobile = layoutMode === 'mobile';
  const isTablet = layoutMode === 'tablet';

  const handleNoraTap = () => {
    // MVP: no-op. Future: toggle Nora voice interaction.
  };

  return (
    <View style={styles.root}>
      <GuestConferenceHeader roomName={roomName} />

      <View style={[styles.mainRow, isMobile && styles.mainRowMobile]}>
        {/* Nora tile — real participant, sized to match video tiles */}
        <View
          style={[
            styles.noraSide,
            isTablet && styles.noraSideTablet,
            isMobile && styles.noraSideMobile,
          ]}
          accessibilityLabel="Nora AI assistant video tile"
        >
          <NoraTile
            avaState={noraState}
            isNoraSpeaking={isNoraSpeaking}
            onPress={handleNoraTap}
            compact={isMobile}
          />
        </View>

        {/* Zoom UI Toolkit container */}
        <View style={[styles.toolkitSide, isMobile && styles.toolkitSideMobile]}>
          {children}
        </View>
      </View>

      {/* Branded footer — minimal, non-competing */}
      <View
        style={styles.footer}
        accessibilityRole="contentinfo"
        accessibilityLabel="Powered by Aspire"
      >
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>Powered by Aspire</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },

  // ── Main content row ──────────────────────────────────────────────
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm, // 8px — visible but tight seam between tiles
    padding: Spacing.sm,
  },
  mainRowMobile: {
    flexDirection: 'column',
    gap: Spacing.xs, // 4px — tighter on mobile to maximize video area
  },

  // ── Nora side — desktop: proportional participant tile ────────────
  noraSide: {
    width: 280,
    minWidth: 240,
    maxWidth: 320,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  noraSideTablet: {
    width: 200,
    minWidth: 180,
    maxWidth: 240,
  },
  noraSideMobile: {
    width: '100%' as unknown as number,
    minWidth: undefined,
    maxWidth: undefined,
    height: 120, // Compact strip — photo stays visible, no wasted space
    borderRadius: BorderRadius.md,
  },

  // ── Toolkit side ──────────────────────────────────────────────────
  toolkitSide: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
  },
  toolkitSideMobile: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },

  // ── Footer ────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md, // 12px — slightly more breathing room
    backgroundColor: 'rgba(10, 10, 12, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as unknown as ViewStyle : {}),
  },
  footerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  footerText: {
    ...Typography.small,
    color: Colors.text.tertiary, // #a1a1a6 — more readable than muted (#6e6e73)
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
