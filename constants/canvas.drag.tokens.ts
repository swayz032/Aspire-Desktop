/**
 * Canvas Drag-Drop Design Tokens
 *
 * $10,000 UI/UX Quality — Premium drag-drop physics and visual feedback.
 * All timing values are spring-based (NO linear timing).
 */

export const CanvasDragTokens = {
  // ---------------------------------------------------------------------------
  // Grid & Snap System
  // ---------------------------------------------------------------------------
  grid: {
    /** Snap grid size (32px — consistent with CanvasGrid) */
    size: 32,
    /** Ghost preview grid alignment */
    snapThreshold: 16, // Snap when within 16px of grid intersection
  },

  // ---------------------------------------------------------------------------
  // Drag Initiation Physics
  // ---------------------------------------------------------------------------
  initiation: {
    /** Icon lift animation duration */
    liftDuration: 150,
    /** Spring config for lift */
    liftSpring: { damping: 25, stiffness: 300, mass: 0.8 },
    /** Scale during lift (1.0 → 1.05) */
    liftScale: 1.05,
    /** Placeholder opacity when icon is dragged */
    placeholderOpacity: 0.3,
    /** Shadow blur during lift (40px → 60px) */
    shadowBlurIdle: 40,
    shadowBlurLifted: 60,
    /** Tilt angle during drag (±2°) */
    maxTiltDegrees: 2,
  },

  // ---------------------------------------------------------------------------
  // Drag Preview Widget
  // ---------------------------------------------------------------------------
  preview: {
    /** Full widget preview size */
    width: 200,
    height: 150,
    /** Border radius */
    borderRadius: 20,
    /** Background glass tint */
    background: 'rgba(14,14,18,0.85)',
    /** Border color during valid drag */
    borderValid: 'rgba(59,130,246,0.4)',
    /** Border color during invalid drag (over dock) */
    borderInvalid: 'rgba(239,68,68,0.4)',
    /** Shadow during drag */
    shadowBlur: 60,
    shadowOpacity: 0.8,
    /** Rotation based on cursor momentum (spring-damped) */
    momentumRotationMax: 2, // degrees
  },

  // ---------------------------------------------------------------------------
  // Drop Zone Visual Feedback
  // ---------------------------------------------------------------------------
  dropZone: {
    /** Canvas background pulse on drag enter */
    pulseGlowMin: 0.04,
    pulseGlowMax: 0.08,
    pulseDuration: 300, // ms
    /** Grid dot brighten */
    gridDotIdleOpacity: 0.035,
    gridDotActiveOpacity: 0.08,
    /** Ghost preview (snap position indicator) */
    ghostBorder: '2px dashed rgba(59,130,246,0.4)',
    ghostOpacity: 0.4,
  },

  // ---------------------------------------------------------------------------
  // Drop Animation (Success)
  // ---------------------------------------------------------------------------
  drop: {
    /** Spring settle bounce (preview → real widget) */
    settleSpring: { damping: 20, stiffness: 280, mass: 0.9 },
    /** Scale bounce sequence: 1.05 → 0.95 → 1.0 */
    scalePeakShrink: 0.95,
    scaleFinal: 1.0,
    /** Fade in content opacity */
    contentFadeStart: 0.8,
    contentFadeFinal: 1.0,
    /** Total animation duration */
    totalDuration: 400, // ms
    /** Dock icon fade back timing */
    dockIconFadeDuration: 300,
  },

  // ---------------------------------------------------------------------------
  // Cancel Animation (Drop Outside Valid Zone)
  // ---------------------------------------------------------------------------
  cancel: {
    /** Curved arc trajectory back to dock */
    returnDuration: 300, // ms
    /** Bezier curve for arc motion */
    returnCurve: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // easeOutQuad
    /** Preview dissolve opacity */
    dissolveOpacity: 0,
    dissolveDuration: 200, // ms (after arriving at dock)
  },

  // ---------------------------------------------------------------------------
  // Error State (Overlap / Invalid Drop)
  // ---------------------------------------------------------------------------
  error: {
    /** Red shake animation */
    shakeDistance: 4, // px horizontal
    shakeCycles: 3,
    shakeDuration: 100, // ms per cycle
    /** Red error border */
    borderColor: 'rgba(239,68,68,0.6)',
    borderWidth: 2,
  },

  // ---------------------------------------------------------------------------
  // Cursor States (Web Only)
  // ---------------------------------------------------------------------------
  cursor: {
    idle: 'pointer',
    grab: 'grab',
    grabbing: 'grabbing',
    notAllowed: 'not-allowed',
  },

  // ---------------------------------------------------------------------------
  // Touch Feedback (Mobile/Tablet)
  // ---------------------------------------------------------------------------
  touch: {
    /** Long press duration to initiate drag */
    longPressDuration: 500, // ms
    /** Haptic feedback intensity (0-1) */
    hapticIntensity: 0.5,
    /** Touch preview scale (slightly larger than mouse) */
    previewScale: 1.1,
  },

  // ---------------------------------------------------------------------------
  // Z-Index Management
  // ---------------------------------------------------------------------------
  zIndex: {
    /** Dragged widget always on top */
    dragging: 1000,
    /** Dropped widgets layer by creation order */
    widget: 10,
    /** Widget increments when brought to front */
    widgetIncrement: 1,
  },

  // ---------------------------------------------------------------------------
  // Accessibility (Keyboard Drag Alternative)
  // ---------------------------------------------------------------------------
  keyboard: {
    /** Arrow key position increment (16px) */
    positionStep: 16,
    /** Shift+Arrow fine control (4px) */
    positionFineStep: 4,
    /** Focus ring color */
    focusRingColor: 'rgba(59,130,246,0.6)',
    focusRingWidth: 2,
    focusRingOffset: 4,
  },
} as const;
