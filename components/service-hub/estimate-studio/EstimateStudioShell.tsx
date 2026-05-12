import React from 'react';
import { View, StyleSheet, useWindowDimensions, Platform, type ViewStyle } from 'react-native';
import { usePathname } from 'expo-router';
import { EstimateStudioHeader } from './EstimateStudioHeader';
import { ProjectAddressBar } from './ProjectAddressBar';
import { EstimateStudioTabBar } from './EstimateStudioTabBar';
import { TimRailContainer } from './TimRailContainer';
import { MaterialsSlotBar } from './materials/MaterialsSlotBar';
import { MaterialsSearchProvider } from './materials/MaterialsSearchContext';
import { useProjectAddress } from '@/hooks/useProjectAddress';

const WORKSPACE_BREAKPOINT = 1100;        // Tim rail collapses below this (peer of Finance Hub right-rail)
const CANVAS_MAX_WIDTH = 1440;            // Desktop cap — beyond this the canvas centers with breathing room
const TABLET_BREAKPOINT = 768;            // Below this we drop horizontal padding

// Estimate Studio workspace — ONE BIG CANVAS.
//
// Architecture (matches mockups 58BAD8D9 Visuals + 04AE5BEB Roofing Mode):
//
//   ┌─────────────────────────────────────────────────────────────┐
//   │ ONE rounded outer canvas (border + dark elevated bg)        │
//   │                                                              │
//   │ ┌──────────────────────────────────┬───────────────────────┐│
//   │ │ MAIN ZONE                        │ TIM ZONE              ││
//   │ │ (flex-grow)                      │ (320px, border-left)  ││
//   │ │                                  │                        ││
//   │ │ EstimateStudioHeader             │ TimRailContainer       ││
//   │ │   (title + BETA + subtitle)      │   (avatar + name +     ││
//   │ │                                  │    role + status +     ││
//   │ │ Contextual slot                  │    voice icons)        ││
//   │ │   Phase 1 default = Visuals      │                        ││
//   │ │   address search bar.            │ Tim body               ││
//   │ │   Phase 2+ swaps per active      │   Phase 2 fills with   ││
//   │ │   tab (Roofing shows breadcrumb  │   chat thread + file   ││
//   │ │   + address + Change button).    │   drop + composer.     ││
//   │ │                                  │                        ││
//   │ │ [Phase 2: TabBar slot]           │                        ││
//   │ │                                  │                        ││
//   │ │ Canvas content area              │                        ││
//   │ │   (per-tab content, Phase 3+)    │                        ││
//   │ └──────────────────────────────────┴───────────────────────┘│
//   └─────────────────────────────────────────────────────────────┘
//
// Both zones live inside ONE outer container — no gap between them, just a
// subtle vertical divider line.

interface EstimateStudioShellProps {
  children?: React.ReactNode;
}

export function EstimateStudioShell({ children }: EstimateStudioShellProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= WORKSPACE_BREAKPOINT;
  const isTablet = width < WORKSPACE_BREAKPOINT && width >= TABLET_BREAKPOINT;
  const isMobile = width < TABLET_BREAKPOINT;
  const pathname = usePathname() ?? '';
  // Materials tab owns its own search bar (the materials warehouse search)
  // and route-hero canvas-swap. Detect the route via path-segment endsWith
  // (route groups can strip the URL prefix — see issue with `includes`
  // not matching reliably under expo-router groups).
  const isMaterialsTab =
    pathname.endsWith('/materials') || pathname.endsWith('/materials/');
  const { address: projectAddress } = useProjectAddress();

  const body = (
    <View
      style={[
        styles.outerCanvas,
        isMobile && styles.outerCanvasMobile,
        isTablet && styles.outerCanvasTablet,
      ]}
      testID="estimate-studio-canvas"
    >
      <View style={[styles.row, !isWide && styles.rowStacked]}>
        {/* MAIN ZONE */}
        <View style={styles.mainZone} testID="estimate-studio-main-zone">
          <View style={styles.mainZonePadded}>
            <EstimateStudioHeader />
          </View>

          {/* Contextual slot. Phase 1 default = Visuals address search. Phase 2+
              swaps based on active tab. On Materials, the slot is hidden —
              the Materials tab renders its own warehouse-search bar. */}
          <View style={styles.contextualSlot}>
            {isMaterialsTab ? <MaterialsSlotBar /> : <ProjectAddressBar />}
          </View>

          {/* Tab bar — Phase 2 */}
          <View style={styles.tabBarSlot}>
            <EstimateStudioTabBar />
          </View>

          {/* Active tab content (rendered via expo-router Slot in _layout.tsx). */}
          <View style={styles.canvasArea} testID="estimate-studio-canvas-content">
            {children}
          </View>
        </View>

        {/* TIM ZONE — divider via border-left in TimRailContainer.cardZone */}
        <TimRailContainer />
      </View>
    </View>
  );

  // Always mount the MaterialsSearchProvider — hooks are cheap + idempotent
  // and consumers (MaterialsSlotBar, MaterialsTab, MaterialsRouteHero,
  // MaterialsRouteContextCard) need a valid context every render. The
  // pathname-based gating used previously was unreliable under expo-router
  // route groups and produced "must be used inside provider" throws.
  return (
    <MaterialsSearchProvider projectAddress={projectAddress}>
      {body}
    </MaterialsSearchProvider>
  );
}

const styles = StyleSheet.create({
  outerCanvas: {
    flex: 1,
    minHeight: 820,
    width: '100%',
    maxWidth: CANVAS_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 14,
    borderWidth: 1,
    // Soft amber-tinted rim — picks up the ambient glow without screaming.
    borderColor: 'rgba(251,191,36,0.14)',
    overflow: 'hidden',
    // Web-only: cap the canvas at the viewport so the rail can scroll
    // internally rather than stretching the whole page. Also layers the
    // soft amber ambient glow around the OUTER canvas edges (not the
    // inner canvasArea):
    //   1) inset hairline rim — warms the edge from within
    //   2) close halo — 24px amber bloom for premium presence
    //   3) ambient halo — 80px wide warmth, very subtle
    //   4) grounding shadow — keeps the card seated on the dark bg
    ...(Platform.OS === 'web'
      ? (({
          height: 'calc(100vh - 90px)',
          maxHeight: 'calc(100vh - 90px)',
          boxShadow: [
            'inset 0 0 0 1px rgba(251,191,36,0.06)',
            '0 0 24px rgba(251,191,36,0.12)',
            '0 0 80px rgba(251,191,36,0.06)',
            '0 30px 90px rgba(0,0,0,0.45)',
          ].join(', '),
        } as unknown) as ViewStyle)
      : {
          // Native fallback — single-color amber drop shadow.
          shadowColor: '#fbbf24',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 24,
          elevation: 12,
        }),
  },
  outerCanvasTablet: {
    borderRadius: 12,
    minHeight: 760,
  },
  outerCanvasMobile: {
    borderRadius: 10,
    minHeight: 720,
  },
  row: {
    flexDirection: 'row',
    flex: 1,
  },
  rowStacked: {
    flexDirection: 'column',
  },
  mainZone: {
    flex: 1,
    minHeight: 760,
  },
  mainZonePadded: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 4,
  },
  contextualSlot: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarSlot: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 4,
  },
  canvasArea: {
    flex: 1,
    margin: 18,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    minHeight: 580,
  },
});
