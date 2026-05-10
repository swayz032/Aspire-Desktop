export const Colors = {
  background: {
    primary: '#0a0a0a',
    secondary: '#0d0d0d',
    tertiary: '#0f0f0f',
    elevated: '#141414',
    premium: '#1a1a1a',
    overlay: 'rgba(0, 0, 0, 0.9)',
  },
  
  surface: {
    card: '#1C1C1E',
    cardHover: '#242426',
    cardBorder: '#2C2C2E',
    cardElevated: '#1E1E20',
    input: '#141414',
    inputBorder: '#2C2C2E',
    premium: '#1E1E20',
    premiumBorder: '#3C3C3E',
    secondary: '#1C1C1E',
    tertiary: '#141416',
  },

  text: {
    primary: '#ffffff',
    bright: '#f2f2f2',
    secondary: '#d1d1d6',
    tertiary: '#a1a1a6',
    muted: '#6e6e73',
    disabled: '#48484a',
  },

  accent: {
    cyan: '#3B82F6',
    cyanLight: 'rgba(59, 130, 246, 0.2)',
    cyanMedium: 'rgba(59, 130, 246, 0.3)',
    cyanDark: '#2563EB',
    blue: '#3B82F6',
    blueLight: 'rgba(59, 130, 246, 0.2)',
    blueMedium: 'rgba(59, 130, 246, 0.3)',
    blueDark: '#2563EB',
    amber: '#f59e0b',
    amberLight: 'rgba(245, 158, 11, 0.15)',
    amberMedium: 'rgba(245, 158, 11, 0.25)',
  },

  orb: {
    idle: {
      dark: '#2563EB',
      mid: '#3B82F6',
      light: '#60A5FA',
    },
    listening: {
      dark: '#2563EB',
      mid: '#3B82F6',
      light: '#60A5FA',
    },
    processing: {
      dark: '#2563EB',
      mid: '#3B82F6',
      light: '#60A5FA',
    },
    responding: {
      dark: '#2563EB',
      mid: '#3B82F6',
      light: '#93C5FD',
    },
  },

  semantic: {
    success: '#34c759',
    successLight: 'rgba(52, 199, 89, 0.15)',
    successDark: '#1a3a2a',
    
    warning: '#d4a017',
    warningLight: 'rgba(212, 160, 23, 0.15)',
    warningDark: '#3a2a1a',
    
    error: '#ff3b30',
    errorLight: 'rgba(255, 59, 48, 0.15)',
    errorDark: '#3a1a1a',
    
    info: '#0891B2',
    infoLight: 'rgba(8, 145, 178, 0.15)',
  },

  status: {
    live: '#0891B2',
    pending: '#d4a017',
    blocked: '#d4a017',
    failed: '#ff3b30',
    success: '#34c759',
    logged: '#8e8e93',
  },

  border: {
    subtle: '#1C1C1E',
    default: '#2C2C2E',
    strong: '#3C3C3E',
    premium: '#343436',
  },

  // Ava Presents — safety verdict glow + badge colors
  safety: {
    recommended: '#10B981',       // Green — "Recommended for business travel"
    recommendedLight: 'rgba(16, 185, 129, 0.15)',
    caution: '#F59E0B',           // Amber — "Use caution"
    cautionLight: 'rgba(245, 158, 11, 0.15)',
    notRecommended: '#EF4444',    // Red — "Not recommended"
    notRecommendedLight: 'rgba(239, 68, 68, 0.15)',
    neutral: '#3B82F6',           // Blue — default / no verdict
    neutralLight: 'rgba(59, 130, 246, 0.15)',
  },

  // Card hero fallback gradients (when no image available)
  gradient: {
    cardHero: ['#1a1e24', '#12151a'] as readonly [string, string],
    cardHeroCool: ['#1a2332', '#0f1923'] as readonly [string, string],
    cardHeroWarm: ['#221a1a', '#1a1214'] as readonly [string, string],
  },

  // Memory Engine — Aspire-blue ambient halo + LED ring layered over deep-black canvas
  // Used by MemoryCard, MemoryCardGlowHalo, LedAmbientSearchBar, MemoryEngineHero
  memory: {
    haloOuter: 'rgba(59, 130, 246, 0.18)',
    haloMid: 'rgba(59, 130, 246, 0.25)',
    haloRing: 'rgba(59, 130, 246, 0.35)',
    ledOff: 'rgba(59, 130, 246, 0.30)',
    ledOn: 'rgba(59, 130, 246, 0.65)',
    cardBg: '#101012',
    gradientTint: 'rgba(20, 20, 24, 0.55)',
    detailDivider: 'rgba(255, 255, 255, 0.07)',
    pageBackground: '#0a0a0c',
  },

  desktop: {
    cardPadding: 16,
    sectionGap: 14,
    cardRadius: 14,
  },
} as const;

/**
 * Responsive viewport tokens — single source of truth for breakpoint widths.
 *
 * Use cases:
 *   - TOUCH_TARGET_MIN (44px, Apple HIG 2026): minimum tappable area for any
 *     interactive element on touch devices. Use for `hitSlop` calculations
 *     and `minHeight`/`minWidth` on buttons, list rows, and icon controls.
 *   - TABLET_PORTRAIT_MIN_WIDTH (768): lower bound of the portrait-tablet band.
 *     Below this we treat as compact/phone (currently unsupported in desktop app).
 *   - TABLET_LANDSCAPE_MIN_WIDTH (1024): boundary between portrait and landscape
 *     tablet. Used by `useTabletLayout()` to disambiguate iPad portrait (1024
 *     tall, ~768 wide) from iPad landscape (1024+ wide).
 *   - DESKTOP_MIN_WIDTH (1280): true-desktop floor. Below this, prefer
 *     tablet-optimized layouts (larger hit targets, simpler nav).
 *
 * NOTE: The legacy bands in `lib/useDesktop.ts` `BREAKPOINTS` (laptop=768,
 * desktop=1024, wide=1920) are kept as-is for backward compat. Prefer the
 * tokens here for new code.
 */
export const TOUCH_TARGET_MIN = 44 as const;
export const TABLET_PORTRAIT_MIN_WIDTH = 768 as const;
export const TABLET_LANDSCAPE_MIN_WIDTH = 1024 as const;
export const DESKTOP_MIN_WIDTH = 1280 as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const Typography = {
  display: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
  },
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
  },
  headline: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  captionMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  smallMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  micro: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
} as const;

export const Shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 0,
  }),
} as const;

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  spring: {
    damping: 15,
    stiffness: 150,
  },
} as const;

/**
 * Motion — Aspire-aesthetic motion tokens for living UI elements.
 *
 * Spring config (damping 18, stiffness 180) gives a snappy yet organic settle
 * preferred over linear easing per Framer-style design directive (plan §12.1).
 *
 * Used by Memory Engine (LED pulse, card lift, grid stagger) and Front Desk
 * Setup (hero AvaOrbVideo backdrop, section transitions).
 */
export const Motion = {
  /** LED ambient pulse — search bar outline, status indicators */
  led: {
    pulseDuration: 2400,
    pulseEasing: 'cubic-bezier(0.4, 0, 0.6, 1)',
    /** Opacity range for breathing effect */
    opacityMin: 0.35,
    opacityMax: 0.6,
  },

  /** Card hover/press feedback — premium 3D floating feel */
  cardLift: {
    duration: 180,
    translateY: -2,
    pressScale: 0.98,
    easing: 'ease-out',
  },

  /** Grid entrance choreography — staggered card fade-in */
  gridStagger: {
    /** Delay between consecutive cards in a grid */
    interval: 60,
    /** Initial offset for entrance animation */
    translateY: 8,
    duration: 280,
  },

  /** Spring physics for entrance/exit — Framer-style snap with organic settle */
  spring: {
    damping: 18,
    stiffness: 180,
    mass: 0.9,
  },

  /** Hero entrance — slightly heavier spring for marquee elements */
  heroSpring: {
    damping: 22,
    stiffness: 160,
    mass: 1.0,
  },
} as const;

/**
 * Canvas Mode tokens — immersion layers, motion design, and visual depth
 * for the 3-tier canvas system (Off / Depth / Canvas).
 *
 * Spring config: damping 22 + stiffness 260 + mass 0.9 yields a snappy
 * but organic response curve (~180ms settle, <5% overshoot).
 */
export const Canvas = {
  /** Shadow scale multipliers and parallax bounds per immersion tier */
  depth: {
    elevationOff: 0,
    elevationDepth: 2,
    elevationCanvas: 4,
    shadowScaleDepth: 1.2,
    shadowScaleCanvas: 1.5,
    parallaxMax: 4,
    /** Web box-shadow values per mode (layered for realism) */
    webShadowDepth: '0 1px 2px rgba(0,0,0,0.24), 0 2px 6px rgba(0,0,0,0.12)',
    webShadowCanvas: '0 2px 4px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.16), 0 8px 24px rgba(0,0,0,0.08)',
  },

  /** Mode transition timing — spec Appendix A: 150ms ease-in-out */
  modeTransition: {
    durationMs: 150,
    easing: 'ease-in-out',
    /** CSS transition shorthand for web mode switching */
    css: 'box-shadow 150ms ease-in-out, border-color 150ms ease-in-out, opacity 150ms ease-in-out',
  },

  /** Duration targets (ms) and spring physics for all canvas animations */
  motion: {
    stageEnter: 180,
    stageExit: 140,
    runwayStep: 160,
    lensOpen: 120,
    lensClose: 100,
    palette: 200,
    stagger: 50,
    modeTransition: 250,
    /** Entrance choreography stagger (ms between tiles) */
    tileStagger: 60,
    /** Header entrance spring — heavier, more deliberate */
    headerSpring: { damping: 26, stiffness: 220, mass: 1.0 },
    /** Tile entrance spring — slightly snappier than header */
    spring: { damping: 22, stiffness: 260, mass: 0.9 },
    /** Runway entrance spring — gentle slide-up */
    runwaySpring: { damping: 24, stiffness: 200, mass: 1.1 },
  },

  /** Radial vignette overlay — subtle depth cueing at screen edges */
  vignette: {
    /** Per-mode opacity: depth is barely perceptible, canvas is atmospheric */
    opacityDepth: 0.10,
    opacityCanvas: 0.22,
    /** Legacy single value — kept for backward compat */
    opacity: 0.18,
    spread: 0.7,
    color: 'rgba(0,0,0,0.18)',
    colorDepth: 'rgba(0,0,0,0.10)',
    colorCanvas: 'rgba(0,0,0,0.22)',
  },

  /** Focus halo ring for active/selected canvas elements */
  halo: {
    width: 2,
    color: 'rgba(59,130,246,0.4)',
    blurRadius: 8,
    activeColor: 'rgba(59,130,246,0.6)',
    /** Per-desk accent tints — subtle identity on hover, not overwhelming */
    desk: {
      sarah: { ring: 'rgba(147,130,246,0.28)', glow: 'rgba(147,130,246,0.10)', hex: '#9382F6' },
      finn: { ring: 'rgba(52,199,89,0.28)', glow: 'rgba(52,199,89,0.10)', hex: '#34C759' },
      eli: { ring: 'rgba(245,158,11,0.28)', glow: 'rgba(245,158,11,0.10)', hex: '#F59E0B' },
      nora: { ring: 'rgba(8,145,178,0.28)', glow: 'rgba(8,145,178,0.10)', hex: '#0891B2' },
      quinn: { ring: 'rgba(59,130,246,0.28)', glow: 'rgba(59,130,246,0.10)', hex: '#3B82F6' },
    } as Record<string, { ring: string; glow: string; hex: string }>,
    /** Glass glow layers for premium feel */
    innerBlur: 6,
    outerBlur: 20,
    outerSpread: 2,
    transitionMs: 320,
    /** Cubic bezier for organic glow ramp */
    easing: 'cubic-bezier(0.19, 1, 0.22, 1)',
  },

  /** Stage overlay panel (draft / authority / receipt sidebars) */
  stage: {
    backdropBlur: 12,
    panelGap: 16,
    borderRadius: 20,
    overlayBg: 'rgba(0,0,0,0.6)',
  },

  /** 3-position immersion toggle pill */
  toggle: {
    pillHeight: 32,
    pillPadding: 3,
    indicatorRadius: 14,
    bg: 'rgba(255,255,255,0.06)',
    activeBg: 'rgba(59,130,246,0.15)',
    activeText: '#3B82F6',
    inactiveText: '#6e6e73',
  },

  /** Horizontal execution runway — step indicators + connectors */
  runway: {
    stepSize: 28,
    stepGap: 8,
    activeColor: '#3B82F6',
    completeColor: '#34c759',
    pendingColor: '#6e6e73',
    errorColor: '#ff3b30',
    connectorHeight: 2,
  },

  /** Workspace layout — tile dimensions, grid spacing, content regions */
  workspace: {
    /** Authority Queue gray — physical canvas SURFACE */
    bg: '#2A2A2A',
    /** Tile card dimensions */
    tileWidth: 268,
    tileHeight: 228,
    tileBorderRadius: 22,
    tilePadding: 24,
    /** Darker gray widgets — cards sit INTO the canvas surface */
    tileBg: '#1E1E1E',
    tileBorderColor: 'rgba(255,255,255,0.08)',
    tileBorderHover: 'rgba(59,130,246,0.3)',
    /** Grid layout */
    gridGap: 22,
    gridMaxWidth: 880,
    /** Content region padding */
    contentPaddingH: 48,
    contentPaddingV: 36,
    /** Header section */
    headerGap: 12,
    headerBottomMargin: 44,
    /** Runway section */
    runwayTopMargin: 44,
    runwayMaxWidth: 620,
    /** Dot grid atmosphere — more visible on gray surface */
    dotGridOpacity: 0.06,
    dotGridSpacing: 32,
    /** Cursor spotlight */
    spotlightRadius: 900,
    spotlightOpacity: 0.02,
    /** 3D slab — dark void behind canvas */
    behindBg: '#0D0D0D',
    surfaceRadius: 16,
    edgeThickness: 5,
    edgeColor: '#1A1A1A',
    edgeShadowColor: '#141414',
    topHighlight: 'rgba(255,255,255,0.06)',
    margin: { wide: 20, desktop: 16, laptop: 12, tablet: 8 },
    outerShadow: '0 12px 40px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
    perspective: 1200,
    minHeight: 600,
  },

  /** Responsive layout constraints per viewport tier */
  layout: {
    /** Max content width on wide displays (1920+) to prevent over-stretching */
    wideMaxWidth: 1600,
    /** Gap between columns per breakpoint */
    gapTablet: 12,
    gapLaptop: 12,
    gapDesktop: 16,
    gapWide: 16,
    /** Column widths per breakpoint */
    leftColLaptop: 260,
    leftColDesktop: 280,
    rightColTablet: 280,
    rightColLaptop: 280,
    rightColDesktop: 320,
  },

  /** Tile typography sub-tokens */
  tileType: {
    label: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
    deskTag: { fontSize: 9.5, fontWeight: '700' as const, letterSpacing: 2.0 },
    verbLabel: { fontSize: 12, fontWeight: '500' as const },
    riskPill: { fontSize: 8.5, fontWeight: '800' as const, letterSpacing: 0.8 },
    verbCount: { fontSize: 11, fontWeight: '400' as const },
    headerTitle: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 4.5 },
    headerSub: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.4 },
  },
} as const;
