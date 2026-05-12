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

// Breakpoint ladder (responsive Estimate Studio):
//   Desktop  : >= 1400  — canvas capped at 1400 + centered
//   Laptop   : 1100–1399 — canvas full width, rail right
//   Tablet   : 768–1099  — canvas full width, rail STACKED below
//   Mobile   : <  768    — canvas full width, rail stacked, tighter chrome
const DESKTOP_BREAKPOINT = 1400;
const WORKSPACE_BREAKPOINT = 1100;        // Tim rail collapses below this
const TABLET_BREAKPOINT = 768;

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
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isWide = width >= WORKSPACE_BREAKPOINT;
  const isTablet = width < WORKSPACE_BREAKPOINT && width >= TABLET_BREAKPOINT;
  const isMobile = width < TABLET_BREAKPOINT;
  // Laptop heuristic: wide enough for the rail (>=1100) but short viewport
  // (<860 inner height after browser chrome). This is what makes 13–15"
  // laptops look 'stretched out' on the same code that fits on a 1080p+
  // desktop — fixed calc(100vh - 118px) leaves no room for the full hero
  // photo + photo lane row, content overflows the canvas at the bottom.
  const isLaptop = isWide && !isDesktop && height < 900;

  // Responsive canvas width: cap on big desktops, full-width below 1400.
  const canvasMaxWidth = isDesktop ? 1400 : undefined;

  // Laptop-specific dynamic height: subtract more so the canvas leaves
  // breathing room for the photo lane at the bottom. Desktop unchanged.
  const canvasHeightCalc = isLaptop
    ? 'calc(100vh - 96px)'
    : 'calc(100vh - 118px)';
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
        // Responsive max width: 1400 on big desktops, full-width below.
        canvasMaxWidth ? { maxWidth: canvasMaxWidth } : null,
        // Laptop-specific height override (short viewports only). Desktop
        // keeps the existing calc(100vh - 118px) baked into outerCanvas.
        Platform.OS === 'web' && isLaptop
          ? (({
              height: canvasHeightCalc,
              maxHeight: canvasHeightCalc,
            } as unknown) as ViewStyle)
          : null,
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
      {/* Amber ambient overlay — painted ON TOP of all canvas children
          so opaque content (route map, hero photos, Cesium 3D) does
          not cover the inset glow. pointerEvents:none keeps it
          interactive-transparent. */}
      <View pointerEvents="none" style={styles.glowOverlay} />
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
    // maxWidth applied inline based on viewport: 1400 on big desktops,
    // unconstrained (full-width) on laptops / tablets / mobile.
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
          height: 'calc(100vh - 118px)',
          maxHeight: 'calc(100vh - 118px)',
        } as unknown) as ViewStyle)
      : {}),
  },
  glowOverlay: {
    // Absolutely positioned over the entire outer canvas, ON TOP of
    // children, so opaque canvas content (route map, Aerial 3D, photo
    // hero) doesn't cover the inset amber glow the way it would if
    // the shadow lived on outerCanvas itself.
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    ...(Platform.OS === 'web'
      ? (({
          boxShadow: [
            'inset 0 0 110px rgba(251,191,36,0.12)',
            'inset 0 0 28px rgba(251,191,36,0.08)',
            'inset 0 0 0 1px rgba(251,191,36,0.28)',
          ].join(', '),
        } as unknown) as ViewStyle)
      : {}),
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
    paddingTop: 6,
    // 8 px between the contextual-slot content (search bar / address
    // bar) and the tab pills row directly below it — was 0, the two
    // were touching.
    paddingBottom: 8,
  },
  tabBarSlot: {
    paddingHorizontal: 18,
    paddingTop: 4,
    // Crisper hairline under the tab row + above the screen — line
    // was faded/washed-out before. Amber tint matches the canvas's
    // ambient glow language.
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(251,191,36,0.18)',
  },
  canvasArea: {
    flex: 1,
    margin: 0,
    borderRadius: 0,
    backgroundColor: 'rgba(0,0,0,0.18)',
    // Top hairline mirrors the tab-row line on the screen side so the
    // separator reads as ONE crisp gold-tinted divider instead of a
    // washed-out edge.
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.10)',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
});
