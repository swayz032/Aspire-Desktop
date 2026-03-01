/**
 * CanvasWorkspace — Premium canvas with WidgetDock + drag-drop widgets.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - Two-tone gray: #2A2A2A canvas surface + #1E1E1E widget cards
 * - macOS-style WidgetDock at bottom (10 draggable icons)
 * - Placed widgets use WidgetContainer (draggable + resizable)
 * - Chat sub-mode: WebPreview on top, Persona below (vertical)
 * - Toggle matches "Voice with Ava / Video with Ava" TabButton style
 * - Clean physical shadows, dot grid, edge vignette
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {
  Colors,
  Canvas as CanvasTokens,
} from '@/constants/tokens';
import {
  useImmersion,
} from '@/lib/immersionStore';
import { useDroppable, useCanvasDragDrop } from '@/lib/canvasDragDrop';
import { CanvasGrid } from './CanvasGrid';
import { VignetteOverlay } from './VignetteOverlay';
import { Stage } from './Stage';
import { CommandPalette } from './CommandPalette';
import { SnapGhost } from './SnapGhost';
import { DragPreview } from './DragPreview';
import { WidgetDock, DEFAULT_WIDGETS } from './WidgetDock';
import { WidgetContainer } from './WidgetContainer';
import { CanvasTrashCan } from './CanvasTrashCan';
import { CanvasModeToggle } from './CanvasModeToggle';
import { ChatCanvas } from './ChatCanvas';
import { Persona } from '@/components/ai-elements/Persona';
import { subscribe as subscribeCanvas, getMode as getCanvasMode, getPersonaState, getActiveAgent } from '@/lib/chatCanvasStore';
import type { CanvasMode } from '@/lib/chatCanvasStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// Widget content imports
import { QuoteWidget } from './widgets/QuoteWidget';
import { ContractWidget } from './widgets/ContractWidget';
import { CalendarWidget } from './widgets/CalendarWidget';
import { TodaysPlanWidget } from './widgets/TodaysPlanWidget';
import { AuthorityQueueWidget } from './widgets/AuthorityQueueWidget';
import { FinanceHubWidget } from './widgets/FinanceHubWidget';
import { ReceiptsWidget } from './widgets/ReceiptsWidget';
import { StickyNoteWidget } from './widgets/StickyNoteWidget';
import { EmailWidget } from './widgets/EmailWidget';
import { InvoiceWidget } from './widgets/InvoiceWidget';

// ---------------------------------------------------------------------------
// Widget content registry — maps dock widget IDs to their content components
// ---------------------------------------------------------------------------

const WIDGET_CONTENT: Record<string, { title: string; component: React.ComponentType }> = {
  email: { title: 'Email', component: EmailWidget },
  invoice: { title: 'Invoice', component: InvoiceWidget },
  quote: { title: 'Quote', component: QuoteWidget },
  contract: { title: 'Contract', component: ContractWidget },
  calendar: { title: 'Calendar', component: CalendarWidget },
  finance: { title: 'Finance Hub', component: FinanceHubWidget },
  task: { title: "Today's Plan", component: TodaysPlanWidget },
  approval: { title: 'Authority Queue', component: AuthorityQueueWidget },
  note: { title: 'Sticky Note', component: StickyNoteWidget },
  receipt: { title: 'Receipts', component: ReceiptsWidget },
};

// Default widget placement size
const DEFAULT_WIDGET_SIZE = { width: 360, height: 280 };

// ---------------------------------------------------------------------------
// CanvasWorkspace
// ---------------------------------------------------------------------------

// Responsive breakpoints
const BP_WIDE = 1440;    // Wide desktop (1440+)
const BP_DESKTOP = 1200;  // Desktop (1200-1439)
const BP_LAPTOP = 1024;   // Laptop (1024-1199)
const BP_TABLET = 768;    // Tablet (768-1023)

export function CanvasWorkspace(): React.ReactElement {
  const { mode, stageOpen } = useImmersion();
  const { width: screenWidth } = useWindowDimensions();

  // Responsive layout tier
  const isWide = screenWidth >= BP_WIDE;
  const isDesktop = screenWidth >= BP_DESKTOP;
  const isLaptop = screenWidth >= BP_LAPTOP;
  const isTablet = screenWidth >= BP_TABLET;

  // Chat | Canvas sub-mode (internal to workspace)
  const [subMode, setSubMode] = useState<CanvasMode>(getCanvasMode());
  useEffect(() => {
    const unsubscribe = subscribeCanvas((state) => {
      setSubMode(state.mode);
    });
    return unsubscribe;
  }, []);

  // Drag-drop integration
  const { setNodeRef, isOver } = Platform.OS === 'web'
    ? useDroppable({ id: 'canvas-workspace' })
    : { setNodeRef: () => {}, isOver: false };
  const { dragState, widgets, addWidget, removeWidget, checkCollision } = useCanvasDragDrop();

  // Placed widgets state (tracks which widgets are on the canvas)
  const [placedWidgets, setPlacedWidgets] = useState<
    Array<{ id: string; instanceId: string; position: { x: number; y: number }; size: { width: number; height: number } }>
  >([]);

  // Header entrance animation
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    headerAnim.setValue(0);
    Animated.spring(headerAnim, {
      toValue: 1,
      damping: 25,
      stiffness: 200,
      mass: 1.0,
      useNativeDriver: true,
    }).start();
    emitCanvasEvent('mode_change', { mode: 'canvas' });
  }, []);

  // Handle widget selection from dock (click to add)
  const handleWidgetSelect = useCallback((widgetId: string) => {
    const instanceId = `${widgetId}-${Date.now()}`;

    // Find a non-overlapping position
    let x = 80;
    let y = 120;
    const step = 40;

    // Simple stacking: offset each new widget
    for (const pw of placedWidgets) {
      if (Math.abs(pw.position.x - x) < 50 && Math.abs(pw.position.y - y) < 50) {
        x += step;
        y += step;
      }
    }

    setPlacedWidgets((prev) => [
      ...prev,
      {
        id: widgetId,
        instanceId,
        position: { x, y },
        size: { ...DEFAULT_WIDGET_SIZE },
      },
    ]);
  }, [placedWidgets]);

  // Handle widget close
  const handleWidgetClose = useCallback((instanceId: string) => {
    setPlacedWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
  }, []);

  // Handle widget position change
  const handlePositionChange = useCallback((instanceId: string, position: { x: number; y: number }) => {
    setPlacedWidgets((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, position } : w))
    );
  }, []);

  // Handle widget size change
  const handleSizeChange = useCallback((instanceId: string, size: { width: number; height: number }) => {
    setPlacedWidgets((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, size } : w))
    );
  }, []);

  // Header animation interpolations
  const headerOpacity = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const headerTranslateY = headerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  // Snap ghost validity
  const snapIsValid =
    dragState.previewPosition && dragState.activeWidgetId
      ? !checkCollision(
          dragState.previewPosition,
          DEFAULT_WIDGET_SIZE,
          dragState.activeWidgetId,
        )
      : true;

  return (
    <View ref={Platform.OS === 'web' ? (setNodeRef as any) : undefined} style={ws.root}>
      {/* Layer 1: Authority Queue gray surface */}
      <View style={ws.baseLayer} />

      {/* Layer 2: Edge vignette */}
      <View
        style={[
          ws.edgeVignetteLayer,
          Platform.OS === 'web'
            ? ({
                backgroundImage:
                  'radial-gradient(ellipse at center, transparent 60%, rgba(0, 0, 0, 0.15) 100%)',
              } as unknown as ViewStyle)
            : {},
        ]}
        pointerEvents="none"
      />

      {/* Layer 3: Vignette overlay */}
      <VignetteOverlay />

      {/* Layer 4: Dot grid */}
      <CanvasGrid />

      {/* Layer 5: Content — responsive padding */}
      <View style={[
        ws.content,
        {
          paddingHorizontal: isWide ? 64 : isDesktop ? 48 : isLaptop ? 32 : 20,
          paddingTop: isDesktop ? 36 : 24,
        },
      ]}>
        {/* Header with mode toggle */}
        <Animated.View
          style={[
            ws.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <View style={[ws.headerRow, { maxWidth: isWide ? 1200 : CanvasTokens.workspace.gridMaxWidth }]}>
            <View style={ws.headerLeft}>
              <View style={ws.headerDot} />
              <Text style={ws.headerTitle}>CANVAS</Text>
            </View>
            <CanvasModeToggle />
          </View>
          <Text style={ws.headerSub}>
            Governed execution workspace • Every action leaves a receipt
          </Text>
        </Animated.View>

        {/* Sub-mode content */}
        {subMode === 'chat' ? (
          <View style={ws.chatCanvasContainer}>
            <ChatCanvas
              webPreviewProps={{
                activityEvents: [],
                trustLevel: 'internal',
              }}
              personaElement={
                <Persona
                  state={getPersonaState()}
                  variant={getActiveAgent()}
                />
              }
            />
          </View>
        ) : (
          /* Canvas mode — free-form widget placement */
          <View style={ws.canvasArea}>
            {/* Placed widgets */}
            {placedWidgets.map((pw) => {
              const widgetDef = WIDGET_CONTENT[pw.id];
              if (!widgetDef) return null;
              const WidgetContent = widgetDef.component;
              return (
                <WidgetContainer
                  key={pw.instanceId}
                  title={widgetDef.title}
                  position={pw.position}
                  size={pw.size}
                  onPositionChange={(pos) => handlePositionChange(pw.instanceId, pos)}
                  onSizeChange={(size) => handleSizeChange(pw.instanceId, size)}
                  onClose={() => handleWidgetClose(pw.instanceId)}
                >
                  <WidgetContent />
                </WidgetContainer>
              );
            })}

            {/* Empty state when no widgets placed */}
            {placedWidgets.length === 0 && (
              <View style={ws.emptyState}>
                <Text style={ws.emptyTitle}>Your workspace is empty</Text>
                <Text style={ws.emptySub}>
                  Tap or drag widgets from the dock below to get started
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* WidgetDock — macOS-style dock at bottom (canvas mode only) */}
      {subMode === 'canvas' && (
        <WidgetDock
          widgets={DEFAULT_WIDGETS}
          onWidgetSelect={handleWidgetSelect}
          position="bottom"
        />
      )}

      {/* Trash can for drag-to-delete (canvas mode only) */}
      {subMode === 'canvas' && dragState.isDragging && (
        <CanvasTrashCan />
      )}

      {/* Snap ghost */}
      {dragState.isDragging && dragState.previewPosition && (
        <SnapGhost
          position={dragState.previewPosition}
          size={DEFAULT_WIDGET_SIZE}
          isValid={snapIsValid}
        />
      )}

      {/* Drag preview */}
      <DragPreview
        widgetId={dragState.activeWidgetId}
        isDragging={dragState.isDragging}
      />

      {/* Stage overlay */}
      <Stage />

      {/* Command Palette */}
      <CommandPalette />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ws = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
  },

  baseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CanvasTokens.workspace.bg,
    zIndex: 0,
  },

  edgeVignetteLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },

  content: {
    flex: 1,
    zIndex: 5,
    paddingHorizontal: CanvasTokens.workspace.contentPaddingH,
    paddingTop: CanvasTokens.workspace.contentPaddingV,
    paddingBottom: 80, // Space for dock
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: CanvasTokens.workspace.headerGap,
    width: '100%',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent.cyan,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px rgba(59,130,246,0.4)',
        } as unknown as ViewStyle)
      : {}),
  },

  headerTitle: {
    fontSize: CanvasTokens.tileType.headerTitle.fontSize,
    fontWeight: CanvasTokens.tileType.headerTitle.fontWeight,
    color: Colors.text.bright,
    letterSpacing: CanvasTokens.tileType.headerTitle.letterSpacing,
    textTransform: 'uppercase',
  } as any,

  headerSub: {
    fontSize: CanvasTokens.tileType.headerSub.fontSize,
    fontWeight: CanvasTokens.tileType.headerSub.fontWeight,
    color: Colors.text.muted,
    letterSpacing: CanvasTokens.tileType.headerSub.letterSpacing,
  },

  // Chat mode container
  chatCanvasContainer: {
    flex: 1,
    width: '100%',
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
    alignSelf: 'center',
  },

  // Canvas mode — free-form area for placed widgets
  canvasArea: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.tertiary,
  },

  emptySub: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.muted,
  },
});
