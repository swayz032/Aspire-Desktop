/**
 * Shared constants for the Settings panel system.
 * Premium dark-theme palette and layout tokens.
 */

/** Settings-specific surface colors (slightly warmer than global tokens for depth) */
export const SettingsColors = {
  /** Panel canvas — sits above the page overlay */
  canvas: '#0C0C0E',
  /** Section header backgrounds */
  sectionHeader: '#101012',
  /** Field row background */
  fieldRow: '#131315',
  /** Field row hover */
  fieldRowHover: '#18181A',
  /** Input surface */
  input: '#141416',
  /** Input border default */
  inputBorder: '#28282A',
  /** Input border focused */
  inputBorderFocus: '#3B82F6',
  /** Toggle track OFF */
  toggleOff: '#28282A',
  /** Toggle track ON */
  toggleOn: '#3B82F6',
  /** Sidebar nav item active */
  navActive: 'rgba(59, 130, 246, 0.10)',
  /** Sidebar nav item hover */
  navHover: 'rgba(255, 255, 255, 0.03)',
  /** Divider / separator */
  divider: 'rgba(255, 255, 255, 0.05)',
  /** Overlay scrim behind the panel */
  scrim: 'rgba(0, 0, 0, 0.60)',
  /** Destructive / danger actions */
  destructive: '#ef4444',
  destructiveBg: 'rgba(239, 68, 68, 0.10)',
  /** Success green */
  success: '#34c759',
  successBg: 'rgba(52, 199, 89, 0.10)',
  /** Accent blue */
  accent: '#3B82F6',
  accentBg: 'rgba(59, 130, 246, 0.10)',
  accentBorder: 'rgba(59, 130, 246, 0.25)',
  /** Amber / warning */
  amber: '#f59e0b',
  amberBg: 'rgba(245, 158, 11, 0.10)',
} as const;

/** Panel dimensions */
export const SettingsLayout = {
  /** Total panel width */
  panelWidth: 860,
  /** Left sidebar nav width */
  sidebarWidth: 220,
  /** Content area padding */
  contentPadding: 32,
  /** Gap between form fields */
  fieldGap: 20,
  /** Section title bottom margin */
  sectionTitleMargin: 24,
  /** Panel border radius */
  borderRadius: 20,
  /** Animation duration (ms) */
  animDuration: 280,
} as const;

/** Web CSS transitions for settings components */
export const TRANSITION_SMOOTH = 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)';
export const TRANSITION_COLOR = 'color 0.15s ease-out, background-color 0.15s ease-out, border-color 0.15s ease-out';
