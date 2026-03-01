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

  desktop: {
    cardPadding: 16,
    sectionGap: 14,
    cardRadius: 14,
  },
} as const;

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
