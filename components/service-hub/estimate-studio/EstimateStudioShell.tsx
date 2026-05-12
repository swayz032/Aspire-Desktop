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
    // Lowered from 820 — canvas was being forced taller than typical
    // 13" laptop viewports (768–810 inner-height after browser chrome),
    // pushing the bottom off-screen and forcing the user to scroll.
    minHeight: 600,
    width: '100%',
    maxWidth: CANVAS_MAX_WIDTH,
    alignSelf: 'center',
    // Transparent fill — earlier 'rgba(255,255,255,0.02)' was picking up
    // the amber bloom and rendering as a faint white wash. Removing it
    // lets the glow read as pure warmth, not glare.
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 0,
    overflow: 'hidden',
    // Web-only: cap the canvas at the viewport so the rail can scroll
    // internally rather than stretching the whole page. The amber glow
    // is tight to the edge — small blur, small spread — so it reads as
    // an LED outline hugging the perimeter, NOT a flood that lifts the
    // page background. Goal: light at the edge, dark everywhere else.
    ...(Platform.OS === 'web'
      ? (({
          // Real chrome above canvas: ServiceHubTopNav 52 + content
          // paddingTop 16 = 68. Below: content paddingBottom 16 + a
          // safety pad of ~16 for window-zoom drift = ~32. Subtract
          // 104 to keep the canvas fully on-screen with breathing room.
          height: 'calc(100vh - 104px)',
          maxHeight: 'calc(100vh - 104px)',
          // Premium amber ambient stack — four layers, all amber, no
          // black, no white. From inside out:
          //   1) inset bloom — faint inner warmth, canvas feels 'lit'
          //   2) hairline rim — crisp edge definition
          //   3) tight LED bloom — concentrated edge glow
          //   4) ambient halo — wider soft scatter for atmosphere
          // The wide halo opacity is intentionally low (0.08) so it
          // does NOT lift the surrounding page bg the way the prior
          // 0.20 wide halo did.
          boxShadow: [
            // Inner ambient — wide soft bloom INSIDE the canvas. This is
            // the 'ambient glow' lighting the workspace from its edges
            // inward, not flooding the page bg.
            'inset 0 0 90px rgba(251,191,36,0.10)',
            'inset 0 0 24px rgba(251,191,36,0.07)',
            // Hairline rim — crisp edge.
            '0 0 0 1px rgba(251,191,36,0.22)',
            // Tight outer LED bloom — falls off within ~14px, no wider
            // halo (the wide outer scatter is what was lifting the page
            // background).
            '0 0 14px 1px rgba(251,191,36,0.30)',
          ].join(', '),
        } as unknown) as ViewStyle)
      : {
          // Native fallback — single amber halo (no layered ambient).
          shadowColor: '#fbbf24',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.32,
          shadowRadius: 14,
          elevation: 10,
        }),
  },
  outerCanvasTablet: {
    borderRadius: 12,
    minHeight: 560,
  },
  outerCanvasMobile: {
    borderRadius: 10,
    minHeight: 520,
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
    // Lowered from 760 to match the new outerCanvas budget — the prior
    // value forced the main column taller than the outer container on
    // shorter viewports.
    minHeight: 480,
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
    minHeight: 320,
  },
});
