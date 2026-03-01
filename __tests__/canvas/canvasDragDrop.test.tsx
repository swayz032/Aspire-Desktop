/**
 * Canvas Drag-Drop System — Unit Tests
 *
 * Coverage:
 * - Grid snap calculation
 * - Collision detection
 * - Widget management (add/remove/update)
 * - Drag state tracking
 * - Context provider integration
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import {
  CanvasDragDropProvider,
  useCanvasDragDrop,
  snapToGrid,
  checkRectOverlap,
  GRID_SIZE,
  type CanvasWidget,
} from '@/lib/canvasDragDrop';

// ---------------------------------------------------------------------------
// Test Component
// ---------------------------------------------------------------------------

function TestConsumer({ onMount }: { onMount: (ctx: any) => void }) {
  const ctx = useCanvasDragDrop();

  React.useEffect(() => {
    onMount(ctx);
  }, [ctx, onMount]);

  return (
    <View>
      <Text>Widgets: {ctx.widgets.size}</Text>
      <Text>Dragging: {ctx.dragState.isDragging ? 'yes' : 'no'}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grid Snap Tests
// ---------------------------------------------------------------------------

describe('snapToGrid', () => {
  it('snaps 0 to 0', () => {
    expect(snapToGrid(0)).toBe(0);
  });

  it('snaps 15 to 0 (rounds down)', () => {
    expect(snapToGrid(15)).toBe(0);
  });

  it('snaps 16 to 32 (rounds up)', () => {
    expect(snapToGrid(16)).toBe(32);
  });

  it('snaps 32 to 32 (exact match)', () => {
    expect(snapToGrid(32)).toBe(32);
  });

  it('snaps 48 to 64 (rounds up)', () => {
    expect(snapToGrid(48)).toBe(64);
  });

  it('snaps 96 to 96 (exact match)', () => {
    expect(snapToGrid(96)).toBe(96);
  });

  it('snaps negative values correctly', () => {
    // -15 rounds to -0, which is Object.is equivalent to 0 but fails toBe check
    expect(Math.abs(snapToGrid(-15))).toBe(0);
    // -16 also rounds to -0 (closer to 0 than -32)
    expect(Math.abs(snapToGrid(-16))).toBe(0);
    expect(snapToGrid(-32)).toBe(-32);
  });
});

// ---------------------------------------------------------------------------
// Collision Detection Tests
// ---------------------------------------------------------------------------

describe('checkRectOverlap', () => {
  it('detects no overlap when rects are far apart', () => {
    const rect1 = { x: 0, y: 0, width: 100, height: 100 };
    const rect2 = { x: 200, y: 200, width: 100, height: 100 };
    expect(checkRectOverlap(rect1, rect2)).toBe(false);
  });

  it('detects overlap when rects intersect', () => {
    const rect1 = { x: 0, y: 0, width: 100, height: 100 };
    const rect2 = { x: 50, y: 50, width: 100, height: 100 };
    expect(checkRectOverlap(rect1, rect2)).toBe(true);
  });

  it('detects overlap when one rect is inside another', () => {
    const rect1 = { x: 0, y: 0, width: 200, height: 200 };
    const rect2 = { x: 50, y: 50, width: 50, height: 50 };
    expect(checkRectOverlap(rect1, rect2)).toBe(true);
  });

  it('detects no overlap when rects touch edges', () => {
    const rect1 = { x: 0, y: 0, width: 100, height: 100 };
    const rect2 = { x: 100, y: 0, width: 100, height: 100 };
    // Edge touch is NOT overlap (strict inequality in algorithm)
    expect(checkRectOverlap(rect1, rect2)).toBe(false);
  });

  it('detects overlap with 1px intersection', () => {
    const rect1 = { x: 0, y: 0, width: 100, height: 100 };
    const rect2 = { x: 99, y: 0, width: 100, height: 100 };
    expect(checkRectOverlap(rect1, rect2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Context Provider Tests
// ---------------------------------------------------------------------------

describe('CanvasDragDropProvider', () => {
  it('throws error when useCanvasDragDrop used outside provider', () => {
    // Suppress console.error for this test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <View>
          <TestConsumer onMount={() => {}} />
        </View>
      );
    }).toThrow('useCanvasDragDrop must be used within CanvasDragDropProvider');

    spy.mockRestore();
  });

  it('provides context when wrapped in provider', () => {
    let context: any = null;

    render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    expect(context).not.toBeNull();
    expect(context.widgets).toBeInstanceOf(Map);
    expect(context.widgets.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Widget Management Tests
// ---------------------------------------------------------------------------

describe('Widget Management', () => {
  it('adds widgets to the canvas', async () => {
    let context: any = null;

    const { rerender } = render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget: CanvasWidget = {
      id: 'test-widget-1',
      position: { x: 64, y: 64 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    context.addWidget(widget);

    // Force re-render to trigger state update
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      expect(context.widgets.size).toBe(1);
    });

    expect(context.widgets.get('test-widget-1')).toEqual(widget);
  });

  it('removes widgets from the canvas', async () => {
    let context: any = null;

    const { rerender } = render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget: CanvasWidget = {
      id: 'test-widget-2',
      position: { x: 64, y: 64 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    context.addWidget(widget);
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      expect(context.widgets.size).toBe(1);
    });

    context.removeWidget('test-widget-2');
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      expect(context.widgets.size).toBe(0);
    });

    expect(context.widgets.get('test-widget-2')).toBeUndefined();
  });

  it('updates widget position', async () => {
    let context: any = null;

    const { rerender } = render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget: CanvasWidget = {
      id: 'test-widget-3',
      position: { x: 0, y: 0 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    context.addWidget(widget);
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    context.updateWidgetPosition('test-widget-3', { x: 128, y: 128 });
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      const updated = context.widgets.get('test-widget-3');
      expect(updated?.position).toEqual({ x: 128, y: 128 });
    });
  });

  it('updates widget size', async () => {
    let context: any = null;

    const { rerender } = render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget: CanvasWidget = {
      id: 'test-widget-4',
      position: { x: 0, y: 0 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    context.addWidget(widget);
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    context.updateWidgetSize('test-widget-4', { width: 400, height: 300 });
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      const updated = context.widgets.get('test-widget-4');
      expect(updated?.size).toEqual({ width: 400, height: 300 });
    });
  });
});

// ---------------------------------------------------------------------------
// Collision Check Tests
// ---------------------------------------------------------------------------

describe('Context checkCollision', () => {
  it('detects collision with existing widgets', async () => {
    let context: any = null;

    const { rerender } = render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget1: CanvasWidget = {
      id: 'widget-1',
      position: { x: 64, y: 64 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    context.addWidget(widget1);
    rerender(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    await waitFor(() => {
      expect(context.widgets.size).toBe(1);
    });

    // New widget overlaps with widget-1
    const hasCollision = context.checkCollision(
      { x: 128, y: 128 },
      { width: 280, height: 200 }
    );

    expect(hasCollision).toBe(true);
  });

  it('detects no collision when widgets are far apart', async () => {
    let context: any = null;

    render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget1: CanvasWidget = {
      id: 'widget-2',
      position: { x: 0, y: 0 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    await waitFor(() => {
      context.addWidget(widget1);
    });

    // New widget is far away from widget-2
    const hasCollision = context.checkCollision(
      { x: 600, y: 600 },
      { width: 280, height: 200 }
    );

    expect(hasCollision).toBe(false);
  });

  it('excludes specified widget from collision check', async () => {
    let context: any = null;

    render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    const widget1: CanvasWidget = {
      id: 'widget-3',
      position: { x: 64, y: 64 },
      size: { width: 280, height: 200 },
      zIndex: 1,
    };

    await waitFor(() => {
      context.addWidget(widget1);
    });

    // Check collision but exclude widget-3 (moving itself)
    const hasCollision = context.checkCollision(
      { x: 96, y: 96 },
      { width: 280, height: 200 },
      'widget-3'
    );

    expect(hasCollision).toBe(false); // No collision because widget-3 is excluded
  });
});

// ---------------------------------------------------------------------------
// Drag State Tests
// ---------------------------------------------------------------------------

describe('Drag State', () => {
  it('initializes with no active drag', () => {
    let context: any = null;

    render(
      <CanvasDragDropProvider>
        <TestConsumer
          onMount={(ctx) => {
            context = ctx;
          }}
        />
      </CanvasDragDropProvider>
    );

    expect(context.dragState.activeWidgetId).toBeNull();
    expect(context.dragState.isDragging).toBe(false);
    expect(context.dragState.previewPosition).toBeNull();
  });
});
