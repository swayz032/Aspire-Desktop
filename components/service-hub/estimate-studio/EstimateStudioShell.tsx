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
          // Flex owns sizing now — no explicit height calc. The
          // parent flex chain (container > content > mainArea >
          // scrollView with scrollContent.flexGrow=1) gives this
          // canvas the exact viewport-minus-chrome height, and
          // crucially keeps it CONSISTENT regardless of inner content.
          // Amber lives ENTIRELY inside the canvas — no outer bloom,
          // no outer rim. Page background stays pristine dark.
          boxShadow: [
            'inset 0 0 110px rgba(251,191,36,0.12)',
            'inset 0 0 28px rgba(251,191,36,0.08)',
            'inset 0 0 0 1px rgba(251,191,36,0.28)',
          ].join(', '),
        } as unknown) as ViewStyle)
      : {
          // Native — no shadow, ambient is web-only via inset boxShadow
          // (RN ShadowStyle does not support inset on iOS/Android).
        }),
  },
  outerCanvasTablet: {
    borderRadius: 12,
  },
  outerCanvasMobile: {
    borderRadius: 10,
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
    // No minHeight — mainZone takes whatever vertical space the row
    // gives it, which is bounded by the outer canvas (now flex:1).
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
    // Zero margins — inner canvas fully fills the space below the
    // tab bar so the property hero (3D Aerial / Street View / etc.)
    // has no visible gap between it and the outer canvas edge.
    margin: 0,
    // Drop the inner border + radius too — they were the visible
    // 'second frame' creating the gap effect. The hero owns the
    // visual now; only the outer canvas defines the edge.
    borderRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 0,
    overflow: 'hidden',
  },
});
