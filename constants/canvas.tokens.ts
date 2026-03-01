/**
 * Canvas Mode Design Tokens
 *
 * Premium $10K aesthetic — two-tone gray with refined blue accents
 * Surface: Authority Queue gray (#2A2A2A) — physical desk/workspace feel
 * Widgets: Today's Plan dark (#1E1E1E) — cards sit INTO the surface
 * Reference: Claude.ai Cowork, Figma workspace, Bloomberg Terminal
 */

export const CanvasTokens = {
  // Background layers (depth hierarchy — two-tone gray, NOT deep black)
  background: {
    base: '#2A2A2A',           // Authority Queue gray — canvas SURFACE
    surface: '#1E1E1E',        // Darker gray — widgets sit INTO canvas
    elevated: '#2A2A2A',       // Same as base for elevated panels
  },

  // Borders
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',      // Refined white dividers
    emphasis: 'rgba(59, 130, 246, 0.3)',       // Blue hover accent (not glow)
  },

  // Shadows (physical depth — real shadows, NOT sci-fi glow)
  shadow: {
    ambient: 'rgba(0, 0, 0, 0.15)',           // Neutral ambient (no blue)
    widget: 'rgba(0, 0, 0, 0.4)',             // Widget elevation shadow
    widgetBlur: 16,                            // Shadow blur radius (px)
  },

  // Agent glow colors
  glow: {
    ava: '#A855F7',            // Purple
    finn: '#10B981',           // Green
    eli: '#3B82F6',            // Blue
  },

  // Typography
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },

  // Grid (visible on gray surface — slightly brighter than on black)
  grid: {
    dotColor: 'rgba(255, 255, 255, 0.06)',    // Visible dots on #2A2A2A gray
    spacing: {
      desktop: 32,             // 32px grid on desktop
      laptop: 28,              // 28px grid on laptop
      tablet: 24,              // 24px grid on tablet
    },
  },

  // Widget sizing
  widget: {
    titleBarHeight: 44,        // Drag handle height
    resizeHandleSize: 12,      // Corner/edge resize handle size
    borderWidth: 1,            // Widget border thickness
    borderRadius: 12,          // Widget corner radius
  },

  // Dock
  dock: {
    height: 80,                // Bottom dock height
    iconSize: 48,              // Icon diameter
    iconSpacing: 16,           // Space between icons
    background: 'rgba(24, 24, 24, 0.95)',  // Dark glass on gray surface
  },

  // ---------------------------------------------------------------------------
  // Wave 19: Premium Trash Can (Canvas Drag-Delete Zone)
  // ---------------------------------------------------------------------------

  trash: {
    /** Total container size (width = height) */
    size: 64,
    /** Can body dimensions within the SVG viewBox */
    canBodyWidth: 20,
    canBodyHeight: 36,
    /** Lid dimensions within the SVG viewBox */
    lidWidth: 24,
    lidHeight: 6,

    /** Lid rotation per state (degrees, negative = counterclockwise tilt) */
    lidTiltInactive: -5,
    lidTiltActive: -15,
    lidTiltHover: -30,
    /** Lid vertical lift per state (px) */
    lidLiftActive: -4,
    lidLiftHover: -8,

    /** State colors */
    colors: {
      inactive: 'rgba(255, 255, 255, 0.3)',
      active: '#EF4444',
      hover: '#DC2626',
    },

    /** Per-state web box-shadow glow strings */
    glow: {
      inactive: '0 4px 12px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
      active: [
        '0 8px 20px rgba(0, 0, 0, 0.5)',
        '0 0 24px rgba(239, 68, 68, 0.6)',
        'inset 0 2px 8px rgba(239, 68, 68, 0.3)',
      ].join(', '),
      hover: [
        '0 12px 32px rgba(0, 0, 0, 0.7)',
        '0 0 40px rgba(239, 68, 68, 0.8)',
        'inset 0 4px 12px rgba(239, 68, 68, 0.5)',
        '0 0 0 2px rgba(239, 68, 68, 0.6)',
      ].join(', '),
    },

    /** Fixed position (bottom-right of canvas viewport) */
    position: {
      bottom: 100,   // px from bottom (above dock)
      right: 32,     // px from right edge
    },

    /** Animation timing per interaction phase (ms) */
    animation: {
      stateTransition: 200,   // inactive <-> active
      hoverTransition: 150,   // active <-> hover
      pulseDuration: 800,     // hover pulse cycle
      deleteDuration: 400,    // total delete choreography
      particleDuration: 300,  // particle burst fade-out
      /** Spring physics (matches WidgetContainer snappy feel) */
      spring: { damping: 20, stiffness: 300, mass: 0.9 },
      /** Tighter spring for hover responsiveness */
      hoverSpring: { damping: 22, stiffness: 350, mass: 0.8 },
    },

    /** Particle burst specs (delete confirmation effect) */
    particles: {
      count: 8,
      size: 4,               // px diameter per particle
      color: 'rgba(239, 68, 68, 0.8)',
      distanceMin: 20,       // min radial travel (px)
      distanceMax: 30,       // max radial travel (px)
    },

    /** Hit-test zone (larger than visual size for forgiving drop target) */
    hitZone: {
      width: 96,
      height: 96,
    },

    /** Background surface (on gray canvas) */
    bg: {
      inactive: 'rgba(20, 20, 22, 0.6)',
      active: 'rgba(239, 68, 68, 0.08)',
      hover: 'rgba(239, 68, 68, 0.12)',
    },

    /** Border per state */
    border: {
      inactive: 'rgba(255, 255, 255, 0.1)',
      active: 'rgba(239, 68, 68, 0.4)',
      hover: 'rgba(239, 68, 68, 0.6)',
    },
  },

  // Avatar
  avatar: {
    size: 80,                  // Agent avatar diameter
    glowOpacity: 0.6,          // Glow transparency
  },

  // ---------------------------------------------------------------------------
  // Wave 16: Premium Widget Design Tokens
  // ---------------------------------------------------------------------------

  /** Finance Hub widget tokens */
  finance: {
    amountFontSize: 28,
    chartHeight: 80,
    chartBarRadius: 3,
    chartBarGap: 4,
    runwayHealthyThreshold: 12,  // > 12 weeks = green
    runwayCautionThreshold: 6,   // 6-12 weeks = yellow, < 6 = red
  },

  /** Priority chip tokens (Today's Plan, Authority Queue) */
  priority: {
    chipHeight: 22,
    chipPaddingH: 8,
    chipBorderRadius: 6,
    chipBorderWidth: 1,
    chipGap: 4,
    chipFontSize: 11,
    chipFontWeight: '600' as const,
    high: { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#EF4444' },
    medium: { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#F59E0B' },
    low: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#10B981' },
  },

  /** Checkbox tokens (Today's Plan) */
  checkbox: {
    size: 20,
    borderWidth: 2,
    borderRadius: 4,
    hitArea: 44,
    checkedColor: '#3B82F6',
    uncheckedBorder: 'rgba(255,255,255,0.3)',
  },

  /** Risk tier tokens (Authority Queue) */
  riskTier: {
    red: { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#EF4444' },
    yellow: { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#F59E0B' },
    green: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#10B981' },
  },

  /** Sticky note tokens */
  note: {
    stripeWidth: 3,
    minHeight: 60,
    colorDotSize: 8,
    colors: {
      amber: { stripe: '#F59E0B', dot: '#F59E0B' },
      blue: { stripe: '#3B82F6', dot: '#3B82F6' },
      emerald: { stripe: '#10B981', dot: '#10B981' },
      pink: { stripe: '#EC4899', dot: '#EC4899' },
    },
  },

  /** Receipt widget tokens */
  receipt: {
    iconContainerSize: 32,
    iconSize: 18,
    filterChipHeight: 28,
    filterChipPaddingH: 10,
    filterChipBorderRadius: 6,
    filterChipGap: 6,
    searchHeight: 32,
    searchBorderRadius: 8,
    status: {
      succeeded: { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
      failed: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
      denied: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
      pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
    },
  },

  /** Shared inner card tokens (used across all Wave 16 widgets) */
  innerCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#242426',
    gap: 8,
    hoverTranslateY: -2,
    hoverBorderColor: 'rgba(59,130,246,0.2)',
    /** Web box-shadow for inner cards — clean physical depth */
    webShadow: '0 1px 4px rgba(0,0,0,0.2)',
    webShadowHover: '0 2px 8px rgba(0,0,0,0.3)',
  },

  /** Shared action button tokens */
  button: {
    primaryBg: '#3B82F6',
    primaryHeight: 36,
    ghostBorderColor: 'rgba(255,255,255,0.15)',
    ghostBg: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '600' as const,
  },

  /** Premium physical shadow (web box-shadow) for WidgetContainer
   *  Clean depth — real shadows, NOT sci-fi blue glow */
  premiumShadow: [
    '0 2px 8px rgba(0, 0, 0, 0.3)',
    '0 1px 3px rgba(0, 0, 0, 0.2)',
    'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    '0 0 0 1px rgba(255, 255, 255, 0.06)',
  ].join(', '),

  // ---------------------------------------------------------------------------
  // Wave 17: Risk Tier Confirmation Modal Tokens
  // ---------------------------------------------------------------------------

  /** Modal sizing per tier */
  modal: {
    /** YELLOW modal width (desktop) */
    yellowWidth: 560,
    /** RED modal width (desktop — wider for extra content) */
    redWidth: 640,
    /** Mobile max width (90vw capped) */
    mobileMaxYellow: 440,
    mobileMaxRed: 480,
    /** Content padding */
    padding: 24,
    /** Header bar height */
    headerHeight: 44,
    /** Action button height (56px = premium tap target) */
    buttonHeight: 56,
    /** Input field height (RED tier text input) */
    inputHeight: 56,
    /** Warning banner height (RED tier) */
    warningBannerHeight: 48,
    /** Max modal height (80vh fallback in px for StyleSheet) */
    maxHeight: 600,
    /** Inner card tokens (consistent with widget innerCard) */
    innerCardPadding: 16,
    innerCardRadius: 10,
    innerCardBorder: 'rgba(255, 255, 255, 0.08)',
    innerCardBg: 'rgba(0, 0, 0, 0.25)',

    /** Modal background layers */
    bg: {
      surface: '#2A2A2A',
      header: '#1E1E1E',
      backdrop: {
        yellow: 'rgba(0, 0, 0, 0.85)',
        red: 'rgba(0, 0, 0, 0.9)',
      },
    },

    /** Divider glow colors per tier */
    divider: {
      yellow: 'rgba(59, 130, 246, 0.4)',
      red: 'rgba(239, 68, 68, 0.4)',
    },

    /** Risk chip colors */
    chip: {
      yellow: { bg: '#F59E0B', text: '#FFFFFF' },
      red: { bg: '#EF4444', text: '#FFFFFF' },
    },

    /** Button colors */
    approveButton: {
      enabled: '#3B82F6',
      disabled: 'rgba(59, 130, 246, 0.3)',
      hover: '#2563EB',
    },
    cancelButton: {
      bg: 'rgba(255, 255, 255, 0.1)',
      hover: 'rgba(255, 255, 255, 0.15)',
      text: 'rgba(255, 255, 255, 0.7)',
    },

    /** Text input (RED tier) */
    input: {
      borderInactive: 'rgba(255, 255, 255, 0.3)',
      borderFocused: '#3B82F6',
      bg: 'rgba(0, 0, 0, 0.3)',
      placeholder: 'rgba(255, 255, 255, 0.35)',
    },

    /** Warning banner (RED tier) */
    warningBanner: {
      bg: '#EF4444',
      text: '#FFFFFF',
    },

    /** Clean physical shadow per tier (web box-shadow) */
    shadowYellow: [
      '0 16px 48px rgba(0, 0, 0, 0.5)',
      '0 4px 16px rgba(0, 0, 0, 0.4)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      '0 0 0 1px rgba(255, 255, 255, 0.06)',
    ].join(', '),
    shadowRed: [
      '0 16px 48px rgba(0, 0, 0, 0.5)',
      '0 4px 16px rgba(0, 0, 0, 0.4)',
      '0 0 24px rgba(239, 68, 68, 0.1)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      '0 0 0 1px rgba(255, 255, 255, 0.06)',
    ].join(', '),

    /** Animation timing */
    animation: {
      backdropFade: 200,
      entranceScale: { from: 0.95, to: 1.0 },
      entranceScaleRed: { from: 0.9, to: 1.0 },
      exitDuration: 150,
      exitScale: { from: 1.0, to: 0.95 },
      exitScaleRed: { from: 1.0, to: 0.9 },
      buttonTransition: 200,
      bannerPulseDuration: 2000,
      /** Spring physics — snappy, premium (matches WidgetContainer) */
      spring: { damping: 20, stiffness: 300, mass: 0.9 },
    },

    /** Backdrop blur (px) — premium glass effect */
    backdropBlur: 20,
  },
} as const;

// Type export for TypeScript consumers
export type CanvasTokens = typeof CanvasTokens;
