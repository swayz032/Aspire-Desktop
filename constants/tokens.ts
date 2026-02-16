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
