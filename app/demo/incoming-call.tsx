/**
 * Incoming Call — dev-only demo page.
 *
 * Drives the visual diff against `IncomingVideoCallOverlay` per plan §3.10
 * (≤5% pixel delta target). Tab strip cycles through the 3 fixtures from
 * `IncomingCallOverlay.demo.tsx` (known routing contact / recent SMS / unknown).
 *
 * The page does NOT render the overlay component itself — the overlay is
 * mounted globally in `app/_layout.tsx`. We just trigger it via the store.
 *
 * Each fixture:
 *   1. Calls `dismissIncomingCallOverlay` to clear any existing overlay
 *   2. Calls `triggerIncomingCall(fixture.call)` to show the new one
 *   3. After a simulated lookup delay, injects the resolved-caller payload
 *      via `setResolvedCaller` (skipping the real backend lookup)
 *
 * This mirrors how production flow works: overlay shows immediately, caller
 * info resolves shortly after — letting us watch the smooth re-render.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import {
  dismissIncomingCallOverlay,
  setResolvedCaller,
  triggerIncomingCall,
} from '@/lib/incomingCallOverlayStore';
import {
  INCOMING_CALL_FIXTURES,
  type IncomingCallFixture,
} from '@/components/calls/IncomingCallOverlay.demo';

// ---------------------------------------------------------------------------
// Hub — fixture launcher
// ---------------------------------------------------------------------------

function IncomingCallDemoHub() {
  const [activeId, setActiveId] = useState<string>(INCOMING_CALL_FIXTURES[0].id);
  const [isVisible, setIsVisible] = useState(false);
  /** Holds the pending lookup-simulation timeout so we can cancel it when
   *  switching fixtures or unmounting. */
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active =
    INCOMING_CALL_FIXTURES.find((f) => f.id === activeId) ?? INCOMING_CALL_FIXTURES[0];

  const launchFixture = useCallback((fixture: IncomingCallFixture) => {
    // Clear any prior timer + dismiss any existing overlay so the show
    // animation runs cleanly from scratch.
    if (resolveTimerRef.current) {
      clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
    dismissIncomingCallOverlay();

    // Brief gap so the dismiss animation finishes before we re-show. The
    // 180ms matches the overlay's exit timing (150ms) + a safety buffer.
    setTimeout(() => {
      triggerIncomingCall(fixture.call, true);
      setIsVisible(true);

      // Simulate the lookup landing after the configured delay
      resolveTimerRef.current = setTimeout(() => {
        setResolvedCaller(fixture.resolved);
        resolveTimerRef.current = null;
      }, fixture.resolveDelayMs ?? 250);
    }, 180);
  }, []);

  const handleDismiss = useCallback(() => {
    if (resolveTimerRef.current) {
      clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
    dismissIncomingCallOverlay();
    setIsVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
      dismissIncomingCallOverlay();
    };
  }, []);

  return (
    <View style={styles.page}>
      <View style={styles.tabBar}>
        <View style={styles.tabBarHeader}>
          <Ionicons name="call-outline" size={16} color={Colors.accent.cyan as string} />
          <Text style={styles.tabBarTitle}>Incoming Call · Demo Hub</Text>
          <Text style={styles.tabBarSub}>dev-only</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {INCOMING_CALL_FIXTURES.map((fixture) => {
            const isActive = fixture.id === activeId && isVisible;
            return (
              <Pressable
                key={fixture.id}
                onPress={() => {
                  setActiveId(fixture.id);
                  launchFixture(fixture);
                }}
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.tab,
                  hovered && !isActive && styles.tabHover,
                  isActive && styles.tabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${fixture.label} fixture`}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {fixture.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={handleDismiss}
            style={({ hovered }: { hovered?: boolean }) => [
              styles.tab,
              styles.dismissTab,
              hovered && styles.dismissTabHover,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss overlay"
          >
            <Ionicons
              name="close"
              size={14}
              color="rgba(255,255,255,0.65)"
              style={styles.dismissIcon}
            />
            <Text style={styles.dismissLabel}>Dismiss</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.body}>
        <View style={styles.briefCard}>
          <View style={styles.briefHeader}>
            <View style={styles.briefBadge}>
              <Text style={styles.briefBadgeText}>FIXTURE</Text>
            </View>
            <Text style={styles.briefTitle}>{active.label}</Text>
          </View>
          <Text style={styles.briefDescription}>{active.description}</Text>

          <View style={styles.briefDivider} />

          <View style={styles.briefRow}>
            <Text style={styles.briefRowLabel}>FROM</Text>
            <Text style={styles.briefRowValue}>{active.call.from_number ?? 'n/a'}</Text>
          </View>
          <View style={styles.briefRow}>
            <Text style={styles.briefRowLabel}>RESOLVED NAME</Text>
            <Text style={styles.briefRowValue}>
              {active.resolved?.display_name ?? '— (unknown)'}
            </Text>
          </View>
          <View style={styles.briefRow}>
            <Text style={styles.briefRowLabel}>CONTACT TYPE</Text>
            <Text style={styles.briefRowValue}>
              {active.resolved?.contact_type ?? 'unknown'}
            </Text>
          </View>
          {active.resolved?.role ? (
            <View style={styles.briefRow}>
              <Text style={styles.briefRowLabel}>ROLE</Text>
              <Text style={styles.briefRowValue}>{active.resolved.role}</Text>
            </View>
          ) : null}

          <View style={styles.briefDivider} />

          <Text style={styles.briefHelp}>
            Use the tabs above to launch each fixture. The overlay renders globally
            (mounted in app/_layout.tsx). Visual chrome should match the video
            overlay: 440px card, 16 radius, 20px backdrop blur, blue accent label,
            divider with glow, detail card, blue gradient Answer button.
          </Text>

          <View style={styles.briefActions}>
            <Pressable
              onPress={() => launchFixture(active)}
              style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
                styles.launchBtn,
                hovered && styles.launchBtnHover,
                pressed && styles.launchBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Re-launch current fixture"
            >
              <Ionicons name="refresh" size={14} color="#fff" />
              <Text style={styles.launchBtnText}>Re-launch</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function IncomingCallDemoPage() {
  return (
    <PageErrorBoundary pageName="incoming-call-demo-hub">
      <DesktopShell fullBleed>
        <IncomingCallDemoHub />
      </DesktopShell>
    </PageErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#0a0a0c',
    ...(Platform.OS === 'web' ? ({ height: '100%', minHeight: 0 } as object) : {}),
  } as any,

  tabBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle as string,
    backgroundColor: 'rgba(10,10,12,0.8)',
  },
  tabBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tabBarTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text.primary as string,
    letterSpacing: 0.4,
  },
  tabBarSub: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.text.muted as string,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    marginLeft: 4,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 4,
    paddingBottom: 0,
  },

  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 44,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 140ms ease-out, color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  tabHover: {
    borderBottomColor: Colors.border.strong as string,
  },
  tabActive: {
    borderBottomColor: Colors.accent.cyan as string,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.tertiary as string,
  },
  tabLabelActive: {
    color: Colors.accent.cyan as string,
    fontWeight: '600' as const,
  },

  dismissTab: {
    marginLeft: 12,
    borderBottomColor: 'transparent',
  },
  dismissTabHover: {
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  dismissIcon: {
    marginRight: 4,
  },
  dismissLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.65)',
  },

  body: {
    flex: 1,
    minHeight: 0,
    padding: 32,
    alignItems: 'center',
  },

  /* Brief card — describes the active fixture so reviewers can verify
     the overlay reflects the right resolved-contact payload. */
  briefCard: {
    width: '100%',
    maxWidth: 560,
    padding: 24,
    borderRadius: 14,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyleHack)
      : {}),
  } as any,
  briefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  briefBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(59,130,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  briefBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1.4,
    color: '#3B82F6',
  },
  briefTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  briefDescription: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
  },
  briefDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 16,
  },
  briefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  briefRowLabel: {
    width: 130,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
  },
  briefRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.92)',
  },
  briefHelp: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  briefActions: {
    marginTop: 16,
    flexDirection: 'row',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          boxShadow: '0 2px 8px rgba(59,130,246,0.25)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          cursor: 'pointer',
        } as unknown as ViewStyleHack)
      : {}),
  } as any,
  launchBtnHover: {
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
          transform: 'translateY(-1px)',
        } as unknown as ViewStyleHack)
      : {}),
  } as any,
  launchBtnPressed: {
    opacity: 0.9,
  },
  launchBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#fff',
  },
});

// Used purely so the `as unknown as ViewStyleHack` cast above keeps lint happy
// without polluting the global ViewStyle namespace; mirrors `as ViewStyle`
// pattern used elsewhere in the codebase for web-only CSS keys.
type ViewStyleHack = Record<string, unknown>;
