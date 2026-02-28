// ---------------------------------------------------------------------------
// Canvas Mode — Visual Regression Tests
// Covers: structural rendering, style contracts, mode-dependent DOM structure,
//         snapshot stability for all canvas components
// ---------------------------------------------------------------------------

import React from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before component imports (Jest hoisting)
// ---------------------------------------------------------------------------

// Track immersion state for per-test control
let mockImmersionState = {
  mode: 'off' as 'off' | 'depth' | 'canvas',
  fpsMovingAvg: 60,
  stageOpen: false,
  stagedTileId: null as string | null,
  runwayState: 'IDLE' as string,
  dryRunActive: false,
  soundMode: 'essential' as string,
  lensOpen: false,
  lensTileId: null as string | null,
  commandPaletteOpen: false,
};

jest.mock('@/lib/immersionStore', () => ({
  useImmersion: jest.fn(() => mockImmersionState),
  setImmersionMode: jest.fn(),
  setStageOpen: jest.fn(),
  setCommandPaletteOpen: jest.fn(),
  getImmersionState: jest.fn(() => mockImmersionState),
}));

jest.mock('@/lib/canvasTelemetry', () => ({
  emitCanvasEvent: jest.fn(),
}));

jest.mock('@/lib/soundManager', () => ({
  playSound: jest.fn(),
}));

jest.mock('@/lib/runwayMachine', () => {
  const actual = jest.requireActual('@/lib/runwayMachine');
  return {
    ...actual,
  };
});

// Mock expo-linear-gradient using React.createElement (jest-expo mocks are class components)
jest.mock('expo-linear-gradient', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    LinearGradient: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { ...props, testID: 'mock-linear-gradient' }),
  };
});

// Mock Ionicons — render as Text element containing the icon name
jest.mock('@expo/vector-icons', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    Ionicons: (props: { name: string; size?: number; color?: string; style?: unknown }) =>
      R.createElement(RN.Text, { testID: `icon-${props.name}` }, props.name),
  };
});

// Mock Badge — render as View + Text
jest.mock('@/components/ui/Badge', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    Badge: (props: { label: string; variant?: string; size?: string; icon?: unknown }) =>
      R.createElement(
        RN.View,
        { testID: `badge-${props.variant ?? 'default'}` },
        R.createElement(RN.Text, null, props.label),
      ),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { render } from '@testing-library/react-native';
import { View, Text } from 'react-native';

import { ImmersionLayer } from '@/components/canvas/ImmersionLayer';
import { VignetteOverlay } from '@/components/canvas/VignetteOverlay';
import { CanvasToggle } from '@/components/canvas/CanvasToggle';
import { RunwayDisplay } from '@/components/canvas/RunwayDisplay';
import { LiveLens } from '@/components/canvas/LiveLens';
import { Stage } from '@/components/canvas/Stage';
import { CommandPalette } from '@/components/canvas/CommandPalette';
import { DryRunDisplay } from '@/components/canvas/DryRunDisplay';
import { TileContextMenu } from '@/components/canvas/TileContextMenu';
import { Canvas } from '@/constants/tokens';
import type { RunwayState } from '@/lib/runwayMachine';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setMode(mode: 'off' | 'depth' | 'canvas'): void {
  mockImmersionState = { ...mockImmersionState, mode };
}

function resetImmersionState(): void {
  mockImmersionState = {
    mode: 'off',
    fpsMovingAvg: 60,
    stageOpen: false,
    stagedTileId: null,
    runwayState: 'IDLE',
    dryRunActive: false,
    soundMode: 'essential',
    lensOpen: false,
    lensTileId: null,
    commandPaletteOpen: false,
  };
}

/** Simple child component for ImmersionLayer tests */
function MockChild(): React.ReactElement {
  return React.createElement(
    View,
    { testID: 'mock-child' },
    React.createElement(Text, null, 'Test Child'),
  );
}

// Anchor for LiveLens positioning
const ANCHOR = { x: 100, y: 100, width: 200, height: 40 };

// ============================================================================
// 1) Structural Rendering Tests — Components Render Without Crashing
// ============================================================================

describe('Visual Regression: Structural Rendering', () => {
  beforeEach(() => {
    resetImmersionState();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ImmersionLayer
  // -------------------------------------------------------------------------
  describe('ImmersionLayer', () => {
    it('renders children in off mode as pure passthrough (no wrapper)', () => {
      setMode('off');
      const { toJSON } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders children in depth mode with shadow wrapper', () => {
      setMode('depth');
      const { toJSON } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
      // Depth mode wraps in a View with shadow style
      if (tree && typeof tree === 'object' && 'type' in tree) {
        expect(tree.type).toBe('View');
      }
    });

    it('renders children in canvas mode with Animated.View parallax container', () => {
      setMode('canvas');
      const { toJSON } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );
      const tree = toJSON();
      expect(tree).toBeTruthy();
      if (tree && typeof tree === 'object' && 'type' in tree) {
        expect(tree.type).toBe('View');
      }
    });

    it('off mode produces zero canvas-specific visual elements', () => {
      setMode('off');
      const { toJSON } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );
      const json = JSON.stringify(toJSON());
      // No "Immersive canvas layer" label in off mode
      expect(json).not.toContain('Immersive canvas layer');
    });

    it('canvas mode includes "Immersive canvas layer" accessibility label', () => {
      setMode('canvas');
      const { toJSON } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('Immersive canvas layer');
    });
  });

  // -------------------------------------------------------------------------
  // VignetteOverlay
  // -------------------------------------------------------------------------
  describe('VignetteOverlay', () => {
    it('returns null in off mode (no DOM nodes)', () => {
      setMode('off');
      const { toJSON } = render(<VignetteOverlay />);
      expect(toJSON()).toBeNull();
    });

    it('renders an overlay element in depth mode', () => {
      setMode('depth');
      const { toJSON } = render(<VignetteOverlay />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders an overlay element in canvas mode', () => {
      setMode('canvas');
      const { toJSON } = render(<VignetteOverlay />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // CanvasToggle
  // -------------------------------------------------------------------------
  describe('CanvasToggle', () => {
    it('renders 3 mode option pressables', () => {
      setMode('off');
      const { toJSON } = render(<CanvasToggle />);
      const json = JSON.stringify(toJSON());
      // Each mode has its own label text
      expect(json).toContain('Off');
      expect(json).toContain('Depth');
      expect(json).toContain('Canvas');
    });

    it('renders correct accessibility labels for modes', () => {
      setMode('off');
      const { toJSON } = render(<CanvasToggle />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('Off immersion mode');
      expect(json).toContain('Depth immersion mode');
      expect(json).toContain('Canvas immersion mode');
    });

    it('has radiogroup accessibility role on container', () => {
      setMode('off');
      const { toJSON } = render(<CanvasToggle />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"accessibilityRole":"radiogroup"');
    });
  });

  // -------------------------------------------------------------------------
  // RunwayDisplay
  // -------------------------------------------------------------------------
  describe('RunwayDisplay', () => {
    it('renders with IDLE state without crashing', () => {
      const { toJSON } = render(<RunwayDisplay currentState="IDLE" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders 5 step labels: Preflight, Draft, Authority, Execute, Receipt', () => {
      const { toJSON } = render(<RunwayDisplay currentState="IDLE" />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('Preflight');
      expect(json).toContain('Draft');
      expect(json).toContain('Authority');
      expect(json).toContain('Execute');
      expect(json).toContain('Receipt');
    });

    it('has progressbar accessibility role', () => {
      const { toJSON } = render(<RunwayDisplay currentState="IDLE" />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"accessibilityRole":"progressbar"');
    });
  });

  // -------------------------------------------------------------------------
  // LiveLens
  // -------------------------------------------------------------------------
  describe('LiveLens', () => {
    it('returns null when mode is off', () => {
      setMode('off');
      const { toJSON } = render(
        <LiveLens
          tileId="conference_call"
          anchorPosition={ANCHOR}
          onClose={jest.fn()}
          onOpenStage={jest.fn()}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('returns null when mode is depth', () => {
      setMode('depth');
      const { toJSON } = render(
        <LiveLens
          tileId="conference_call"
          anchorPosition={ANCHOR}
          onClose={jest.fn()}
          onOpenStage={jest.fn()}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders card in canvas mode with known tile', () => {
      setMode('canvas');
      const { toJSON } = render(
        <LiveLens
          tileId="conference_call"
          anchorPosition={ANCHOR}
          onClose={jest.fn()}
          onOpenStage={jest.fn()}
        />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('returns null for unknown tile ID (deny-by-default)', () => {
      setMode('canvas');
      const { toJSON } = render(
        <LiveLens
          tileId="nonexistent"
          anchorPosition={ANCHOR}
          onClose={jest.fn()}
          onOpenStage={jest.fn()}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders with max-width constraint of 320', () => {
      setMode('canvas');
      const { toJSON } = render(
        <LiveLens
          tileId="conference_call"
          anchorPosition={ANCHOR}
          onClose={jest.fn()}
          onOpenStage={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"width":320');
    });
  });

  // -------------------------------------------------------------------------
  // Stage
  // -------------------------------------------------------------------------
  describe('Stage', () => {
    it('returns null when stageOpen is false', () => {
      setMode('canvas');
      mockImmersionState = {
        ...mockImmersionState,
        stageOpen: false,
        stagedTileId: null,
      };
      const { toJSON } = render(<Stage />);
      expect(toJSON()).toBeNull();
    });

    it('returns null when mode is off even if stageOpen', () => {
      setMode('off');
      mockImmersionState = {
        ...mockImmersionState,
        stageOpen: true,
        stagedTileId: 'conference_call',
      };
      const { toJSON } = render(<Stage />);
      expect(toJSON()).toBeNull();
    });

    it('renders 3 panels when open with valid tile in canvas mode', () => {
      setMode('canvas');
      mockImmersionState = {
        ...mockImmersionState,
        stageOpen: true,
        stagedTileId: 'conference_call',
        runwayState: 'IDLE',
      };
      const { toJSON } = render(<Stage />);
      const json = JSON.stringify(toJSON());
      // Stage renders Draft, Authority, Receipt panels
      expect(json).toContain('Authority');
      expect(json).toContain('Receipt');
    });
  });

  // -------------------------------------------------------------------------
  // CommandPalette
  // -------------------------------------------------------------------------
  describe('CommandPalette', () => {
    it('returns null when commandPaletteOpen is false', () => {
      setMode('canvas');
      mockImmersionState = {
        ...mockImmersionState,
        commandPaletteOpen: false,
      };
      const { toJSON } = render(<CommandPalette />);
      expect(toJSON()).toBeNull();
    });

    it('returns null when mode is off even if palette is open', () => {
      setMode('off');
      mockImmersionState = {
        ...mockImmersionState,
        commandPaletteOpen: true,
      };
      const { toJSON } = render(<CommandPalette />);
      expect(toJSON()).toBeNull();
    });

    it('renders search input when open in canvas mode', () => {
      setMode('canvas');
      mockImmersionState = {
        ...mockImmersionState,
        commandPaletteOpen: true,
      };
      const { toJSON } = render(<CommandPalette />);
      const json = JSON.stringify(toJSON());
      expect(json).toContain('Search actions...');
    });

    it('renders grouped results from all tiles', () => {
      setMode('canvas');
      mockImmersionState = {
        ...mockImmersionState,
        commandPaletteOpen: true,
      };
      const { toJSON } = render(<CommandPalette />);
      const json = JSON.stringify(toJSON());
      // Desk names are uppercased in group headers
      expect(json).toContain('QUINN');
      expect(json).toContain('NORA');
    });
  });

  // -------------------------------------------------------------------------
  // DryRunDisplay
  // -------------------------------------------------------------------------
  describe('DryRunDisplay', () => {
    it('renders with valid tile and verb', () => {
      const { toJSON } = render(
        <DryRunDisplay
          tileId="conference_call"
          verbId="start_conference"
          riskTier="yellow"
          onProceed={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(toJSON()).toBeTruthy();
    });

    it('renders preview banner text', () => {
      const { toJSON } = render(
        <DryRunDisplay
          tileId="conference_call"
          verbId="start_conference"
          riskTier="yellow"
          onProceed={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('THIS IS A PREVIEW');
    });

    it('returns null for unknown tile', () => {
      const { toJSON } = render(
        <DryRunDisplay
          tileId="nonexistent"
          verbId="start_conference"
          riskTier="yellow"
          onProceed={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders risk-tier border via container borderColor', () => {
      const { toJSON } = render(
        <DryRunDisplay
          tileId="conference_call"
          verbId="start_conference"
          riskTier="red"
          onProceed={jest.fn()}
          onCancel={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      // Red tier borderColor = Colors.semantic.error (#ff3b30)
      expect(json).toContain('#ff3b30');
    });
  });

  // -------------------------------------------------------------------------
  // TileContextMenu
  // -------------------------------------------------------------------------
  describe('TileContextMenu', () => {
    it('renders verb list for known tile', () => {
      const { toJSON } = render(
        <TileContextMenu
          tileId="conference_call"
          position={{ x: 200, y: 200 }}
          onClose={jest.fn()}
          onSelectVerb={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('Start Conference');
      expect(json).toContain('Draft Agenda');
      expect(json).toContain('Invite Attendees');
    });

    it('returns null for unknown tile (deny-by-default)', () => {
      const { toJSON } = render(
        <TileContextMenu
          tileId="unknown_tile"
          position={{ x: 200, y: 200 }}
          onClose={jest.fn()}
          onSelectVerb={jest.fn()}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('has menu accessibility role', () => {
      const { toJSON } = render(
        <TileContextMenu
          tileId="conference_call"
          position={{ x: 200, y: 200 }}
          onClose={jest.fn()}
          onSelectVerb={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      expect(json).toContain('"accessibilityRole":"menu"');
    });

    it('renders menuitem roles for each verb', () => {
      const { toJSON } = render(
        <TileContextMenu
          tileId="conference_call"
          position={{ x: 200, y: 200 }}
          onClose={jest.fn()}
          onSelectVerb={jest.fn()}
        />,
      );
      const json = JSON.stringify(toJSON());
      // Count occurrences of "menuitem" accessibilityRole
      const matches = json.match(/"accessibilityRole":"menuitem"/g);
      expect(matches).toHaveLength(3); // conference_call has 3 verbs
    });
  });
});

// ============================================================================
// 2) Style Contract Tests
// ============================================================================

describe('Visual Regression: Style Contracts', () => {
  beforeEach(() => {
    resetImmersionState();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Canvas token type validation
  // -------------------------------------------------------------------------
  describe('Canvas token structure', () => {
    it('Canvas.depth tokens are numbers', () => {
      expect(typeof Canvas.depth.elevationOff).toBe('number');
      expect(typeof Canvas.depth.elevationDepth).toBe('number');
      expect(typeof Canvas.depth.elevationCanvas).toBe('number');
      expect(typeof Canvas.depth.shadowScaleDepth).toBe('number');
      expect(typeof Canvas.depth.shadowScaleCanvas).toBe('number');
      expect(typeof Canvas.depth.parallaxMax).toBe('number');
    });

    it('Canvas.motion tokens are numbers', () => {
      expect(typeof Canvas.motion.stageEnter).toBe('number');
      expect(typeof Canvas.motion.stageExit).toBe('number');
      expect(typeof Canvas.motion.runwayStep).toBe('number');
      expect(typeof Canvas.motion.lensOpen).toBe('number');
      expect(typeof Canvas.motion.lensClose).toBe('number');
      expect(typeof Canvas.motion.palette).toBe('number');
      expect(typeof Canvas.motion.stagger).toBe('number');
      expect(typeof Canvas.motion.modeTransition).toBe('number');
    });

    it('Canvas.motion.spring has damping, stiffness, mass as numbers', () => {
      expect(typeof Canvas.motion.spring.damping).toBe('number');
      expect(typeof Canvas.motion.spring.stiffness).toBe('number');
      expect(typeof Canvas.motion.spring.mass).toBe('number');
    });

    it('Canvas.vignette tokens are correct types', () => {
      expect(typeof Canvas.vignette.opacity).toBe('number');
      expect(typeof Canvas.vignette.spread).toBe('number');
      expect(typeof Canvas.vignette.color).toBe('string');
    });

    it('Canvas.halo tokens are correct types', () => {
      expect(typeof Canvas.halo.width).toBe('number');
      expect(typeof Canvas.halo.color).toBe('string');
      expect(typeof Canvas.halo.blurRadius).toBe('number');
      expect(typeof Canvas.halo.activeColor).toBe('string');
    });

    it('Canvas.stage tokens are correct types', () => {
      expect(typeof Canvas.stage.backdropBlur).toBe('number');
      expect(typeof Canvas.stage.panelGap).toBe('number');
      expect(typeof Canvas.stage.borderRadius).toBe('number');
      expect(typeof Canvas.stage.overlayBg).toBe('string');
    });

    it('Canvas.toggle tokens are correct types', () => {
      expect(typeof Canvas.toggle.pillHeight).toBe('number');
      expect(typeof Canvas.toggle.pillPadding).toBe('number');
      expect(typeof Canvas.toggle.indicatorRadius).toBe('number');
      expect(typeof Canvas.toggle.bg).toBe('string');
      expect(typeof Canvas.toggle.activeBg).toBe('string');
      expect(typeof Canvas.toggle.activeText).toBe('string');
      expect(typeof Canvas.toggle.inactiveText).toBe('string');
    });

    it('Canvas.runway tokens are correct types', () => {
      expect(typeof Canvas.runway.stepSize).toBe('number');
      expect(typeof Canvas.runway.stepGap).toBe('number');
      expect(typeof Canvas.runway.activeColor).toBe('string');
      expect(typeof Canvas.runway.completeColor).toBe('string');
      expect(typeof Canvas.runway.pendingColor).toBe('string');
      expect(typeof Canvas.runway.errorColor).toBe('string');
      expect(typeof Canvas.runway.connectorHeight).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // ImmersionLayer off mode passthrough contract
  // -------------------------------------------------------------------------
  describe('ImmersionLayer passthrough contract', () => {
    it('off mode returns children unchanged (no wrapper View)', () => {
      setMode('off');
      const { toJSON: offTree } = render(
        <ImmersionLayer>
          <MockChild />
        </ImmersionLayer>,
      );

      // Render just the child directly for comparison
      const { toJSON: directTree } = render(<MockChild />);

      // Both should produce the same tree structure
      expect(JSON.stringify(offTree())).toBe(JSON.stringify(directTree()));
    });
  });

  // -------------------------------------------------------------------------
  // Mode transitions: DOM node stability (CLS prevention)
  // -------------------------------------------------------------------------
  describe('Mode transition DOM stability', () => {
    it('CanvasToggle renders same label set across all modes', () => {
      for (const mode of ['off', 'depth', 'canvas'] as const) {
        setMode(mode);
        const { toJSON } = render(<CanvasToggle />);
        const json = JSON.stringify(toJSON());
        // All modes always render all 3 labels
        expect(json).toContain('Off');
        expect(json).toContain('Depth');
        expect(json).toContain('Canvas');
      }
    });

    it('RunwayDisplay renders same 5-step structure regardless of state', () => {
      const states: RunwayState[] = ['IDLE', 'PREFLIGHT', 'EXECUTING', 'RECEIPT_READY', 'ERROR'];

      for (const state of states) {
        const { toJSON } = render(<RunwayDisplay currentState={state} />);
        const tree = toJSON();
        expect(tree).toBeTruthy();
        const json = JSON.stringify(tree);
        expect(json).toContain('Preflight');
        expect(json).toContain('Draft');
        expect(json).toContain('Authority');
        expect(json).toContain('Execute');
        expect(json).toContain('Receipt');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Canvas token value constraints
  // -------------------------------------------------------------------------
  describe('Canvas token value constraints', () => {
    it('motion durations are positive and within budget', () => {
      expect(Canvas.motion.stageEnter).toBeGreaterThan(0);
      expect(Canvas.motion.stageEnter).toBeLessThanOrEqual(500);
      expect(Canvas.motion.stageExit).toBeGreaterThan(0);
      expect(Canvas.motion.stageExit).toBeLessThanOrEqual(500);
      expect(Canvas.motion.palette).toBeGreaterThan(0);
      expect(Canvas.motion.palette).toBeLessThanOrEqual(500);
    });

    it('spring physics values are in valid ranges', () => {
      expect(Canvas.motion.spring.damping).toBeGreaterThan(0);
      expect(Canvas.motion.spring.stiffness).toBeGreaterThan(0);
      expect(Canvas.motion.spring.mass).toBeGreaterThan(0);
    });

    it('vignette opacity is between 0 and 1', () => {
      expect(Canvas.vignette.opacity).toBeGreaterThanOrEqual(0);
      expect(Canvas.vignette.opacity).toBeLessThanOrEqual(1);
    });

    it('toggle pill dimensions are positive', () => {
      expect(Canvas.toggle.pillHeight).toBeGreaterThan(0);
      expect(Canvas.toggle.pillPadding).toBeGreaterThanOrEqual(0);
      expect(Canvas.toggle.indicatorRadius).toBeGreaterThan(0);
    });

    it('runway step size is positive', () => {
      expect(Canvas.runway.stepSize).toBeGreaterThan(0);
      expect(Canvas.runway.connectorHeight).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// 3) Snapshot Tests — Structure Stability
// ============================================================================

describe('Visual Regression: Snapshots', () => {
  beforeEach(() => {
    resetImmersionState();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // CanvasToggle snapshots per mode
  // -------------------------------------------------------------------------
  describe('CanvasToggle snapshots', () => {
    it.each(['off', 'depth', 'canvas'] as const)(
      'matches snapshot in %s mode',
      (mode) => {
        setMode(mode);
        const { toJSON } = render(<CanvasToggle />);
        expect(toJSON()).toMatchSnapshot();
      },
    );
  });

  // -------------------------------------------------------------------------
  // RunwayDisplay snapshots per state
  // -------------------------------------------------------------------------
  describe('RunwayDisplay snapshots', () => {
    it.each([
      'IDLE',
      'PREFLIGHT',
      'DRAFT_CREATING',
      'DRAFT_READY',
      'AUTHORITY_PENDING',
      'EXECUTING',
      'RECEIPT_READY',
      'ERROR',
      'CANCELLED',
      'TIMEOUT',
    ] as RunwayState[])(
      'matches snapshot for state %s',
      (state) => {
        const { toJSON } = render(<RunwayDisplay currentState={state} />);
        expect(toJSON()).toMatchSnapshot();
      },
    );
  });

  // -------------------------------------------------------------------------
  // VignetteOverlay snapshots
  // -------------------------------------------------------------------------
  describe('VignetteOverlay snapshots', () => {
    it('matches snapshot in depth mode', () => {
      setMode('depth');
      const { toJSON } = render(<VignetteOverlay />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('matches snapshot in canvas mode', () => {
      setMode('canvas');
      const { toJSON } = render(<VignetteOverlay />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  // -------------------------------------------------------------------------
  // DryRunDisplay snapshots per risk tier
  // -------------------------------------------------------------------------
  describe('DryRunDisplay snapshots', () => {
    // DryRunDisplay calls formatTimestamp() which uses new Date() — freeze time
    const FIXED_DATE = new Date('2026-01-15T12:00:00Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(FIXED_DATE);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each(['green', 'yellow', 'red'] as const)(
      'matches snapshot for %s risk tier',
      (tier) => {
        const { toJSON } = render(
          <DryRunDisplay
            tileId="conference_call"
            verbId="start_conference"
            riskTier={tier}
            onProceed={jest.fn()}
            onCancel={jest.fn()}
          />,
        );
        expect(toJSON()).toMatchSnapshot();
      },
    );
  });

  // -------------------------------------------------------------------------
  // TileContextMenu snapshots for different tiles
  // -------------------------------------------------------------------------
  describe('TileContextMenu snapshots', () => {
    it.each(['conference_call', 'calendar', 'finance_hub'])(
      'matches snapshot for tile %s',
      (tileId) => {
        const { toJSON } = render(
          <TileContextMenu
            tileId={tileId}
            position={{ x: 200, y: 200 }}
            onClose={jest.fn()}
            onSelectVerb={jest.fn()}
          />,
        );
        expect(toJSON()).toMatchSnapshot();
      },
    );
  });

  // -------------------------------------------------------------------------
  // ImmersionLayer snapshots per mode
  // -------------------------------------------------------------------------
  describe('ImmersionLayer snapshots', () => {
    it.each(['off', 'depth', 'canvas'] as const)(
      'matches snapshot in %s mode',
      (mode) => {
        setMode(mode);
        const { toJSON } = render(
          <ImmersionLayer>
            <MockChild />
          </ImmersionLayer>,
        );
        expect(toJSON()).toMatchSnapshot();
      },
    );
  });
});
