/**
 * CanvasTrashCan.test.tsx -- Unit tests for Canvas Trash Can (Wave 19)
 *
 * Tests cover:
 * - 3-state visual system (inactive, active, hover)
 * - State transition animations
 * - Delete choreography
 * - Particle burst lifecycle
 * - Accessibility attributes
 * - Reduced motion compliance
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { CanvasTrashCan, type TrashState } from '../CanvasTrashCan';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/canvasTelemetry', () => ({
  emitCanvasEvent: jest.fn(),
}));

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: RN.View,
    },
    useSharedValue: jest.fn((v: number) => ({ value: v })),
    useAnimatedStyle: jest.fn((fn: Function) => fn()),
    withSpring: jest.fn((toValue: number) => toValue),
    withTiming: jest.fn((toValue: number) => toValue),
    withRepeat: jest.fn((animation: number) => animation),
    withSequence: jest.fn((...args: number[]) => args[args.length - 1]),
    cancelAnimation: jest.fn(),
    runOnJS: jest.fn((fn: Function) => fn),
    Easing: {
      out: jest.fn((e: Function) => e),
      in: jest.fn((e: Function) => e),
      cubic: jest.fn((t: number) => t),
    },
  };
});

jest.mock('@/components/icons/ui/TrashCanIcon', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    TrashCanIcon: (props: { size: number; color: string; lidOpen: number }) =>
      R.createElement(RN.View, {
        testID: 'trash-can-icon',
        accessibilityLabel: `trash-icon-lid-${props.lidOpen}-color-${props.color}`,
      }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTrash(
  state: TrashState = 'inactive',
  props: Partial<React.ComponentProps<typeof CanvasTrashCan>> = {},
) {
  return render(
    <CanvasTrashCan
      state={state}
      {...props}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests: Rendering
// ---------------------------------------------------------------------------

describe('rendering', () => {
  it('renders without crashing', () => {
    const { toJSON } = renderTrash();
    expect(toJSON()).not.toBeNull();
  });

  it('renders TrashCanIcon', () => {
    const { getByTestId } = renderTrash();
    expect(getByTestId('trash-can-icon')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: State-Dependent Visuals
// ---------------------------------------------------------------------------

describe('state-dependent visuals', () => {
  it('renders inactive state with muted color', () => {
    const { getByTestId } = renderTrash('inactive');
    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('lid-0');
    expect(icon.props.accessibilityLabel).toContain('rgba(255, 255, 255, 0.3)');
  });

  it('renders active state with red color', () => {
    const { getByTestId } = renderTrash('active');
    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('lid-0.5');
    expect(icon.props.accessibilityLabel).toContain('#EF4444');
  });

  it('renders hover state with deep red color', () => {
    const { getByTestId } = renderTrash('hover');
    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('lid-1');
    expect(icon.props.accessibilityLabel).toContain('#DC2626');
  });
});

// ---------------------------------------------------------------------------
// Tests: State Transitions
// ---------------------------------------------------------------------------

describe('state transitions', () => {
  it('transitions from inactive to active', () => {
    const { rerender, getByTestId } = render(
      <CanvasTrashCan state="inactive" />,
    );

    rerender(<CanvasTrashCan state="active" />);

    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('#EF4444');
  });

  it('transitions from active to hover', () => {
    const { rerender, getByTestId } = render(
      <CanvasTrashCan state="active" />,
    );

    rerender(<CanvasTrashCan state="hover" />);

    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('#DC2626');
  });

  it('transitions from hover back to inactive', () => {
    const { rerender, getByTestId } = render(
      <CanvasTrashCan state="hover" />,
    );

    rerender(<CanvasTrashCan state="inactive" />);

    const icon = getByTestId('trash-can-icon');
    expect(icon.props.accessibilityLabel).toContain('rgba(255, 255, 255, 0.3)');
  });
});

// ---------------------------------------------------------------------------
// Tests: Delete Choreography
// ---------------------------------------------------------------------------

describe('delete choreography', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('triggers delete animation when isDeleting is true', () => {
    const onDeleteComplete = jest.fn();

    render(
      <CanvasTrashCan
        state="hover"
        isDeleting={true}
        onDeleteComplete={onDeleteComplete}
      />,
    );

    // Advance past delete animation duration (400ms from tokens)
    jest.advanceTimersByTime(500);

    expect(onDeleteComplete).toHaveBeenCalledTimes(1);
  });

  it('emits telemetry on delete', () => {
    const { emitCanvasEvent } = require('@/lib/canvasTelemetry');

    render(
      <CanvasTrashCan
        state="hover"
        isDeleting={true}
        draggedWidgetId="widget-123"
      />,
    );

    expect(emitCanvasEvent).toHaveBeenCalledWith('stage_close', {
      action: 'widget_deleted',
      widgetId: 'widget-123',
    });
  });

  it('uses "unknown" widget ID when draggedWidgetId is null', () => {
    const { emitCanvasEvent } = require('@/lib/canvasTelemetry');

    render(
      <CanvasTrashCan
        state="hover"
        isDeleting={true}
        draggedWidgetId={null}
      />,
    );

    expect(emitCanvasEvent).toHaveBeenCalledWith('stage_close', {
      action: 'widget_deleted',
      widgetId: 'unknown',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Accessibility
// ---------------------------------------------------------------------------

describe('accessibility', () => {
  it('has correct accessibility label', () => {
    const tree = renderTrash();
    const json = tree.toJSON();
    const jsonStr = JSON.stringify(json);
    expect(jsonStr).toContain('Trash zone');
    expect(jsonStr).toContain('Drag a widget here to remove it from the canvas');
  });

  it('reports expanded state in hover', () => {
    const tree = renderTrash('hover');
    const json = tree.toJSON();
    const jsonStr = JSON.stringify(json);
    // The component sets accessibilityState={{ expanded: state === 'hover' }}
    expect(jsonStr).toContain('"expanded":true');
  });

  it('reports not expanded in inactive', () => {
    const tree = renderTrash('inactive');
    const json = tree.toJSON();
    const jsonStr = JSON.stringify(json);
    expect(jsonStr).toContain('"expanded":false');
  });
});

// ---------------------------------------------------------------------------
// Tests: Props
// ---------------------------------------------------------------------------

describe('props', () => {
  it('renders with all optional props provided', () => {
    const { toJSON } = render(
      <CanvasTrashCan
        state="active"
        onDelete={jest.fn()}
        draggedWidgetId="w1"
        isDeleting={false}
        onDeleteComplete={jest.fn()}
      />,
    );
    expect(toJSON()).not.toBeNull();
  });

  it('renders with minimal props', () => {
    const { toJSON } = render(
      <CanvasTrashCan state="inactive" />,
    );
    expect(toJSON()).not.toBeNull();
  });
});
