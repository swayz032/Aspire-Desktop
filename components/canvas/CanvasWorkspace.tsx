/**
 * CanvasWorkspace — Premium 3D canvas with WidgetDock + drag-drop widgets.
 *
 * $10,000 UI/UX QUALITY MANDATE:
 * - 3D DEPTH CANVAS: Multi-layer depth system with perspective, inner shadows,
 *   raised surface feel — NOT a flat 2D background
 * - Two-tone gray: #2A2A2A canvas surface + #1E1E1E widget cards
 * - macOS-style WidgetDock at bottom (10 draggable icons)
 * - Placed widgets use WidgetContainer (draggable + resizable)
 * - Chat sub-mode: WebPreview on top, Persona below (vertical)
 * - Toggle matches "Voice with Ava / Video with Ava" TabButton style
 * - Responsive: Desktop (1440+), Laptop (1200+), Tablet (1024+), Small (768+)
 * - Adam wired to WebPreview via SSE activity stream
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
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
import type { PersonaState } from '@/components/ai-elements/Persona';
import {
  subscribe as subscribeCanvas,
  getMode as getCanvasMode,
  getPersonaState,
  getActiveAgent,
  getActivityEvents,
  addActivityEvent,
} from '@/lib/chatCanvasStore';
import type { CanvasMode } from '@/lib/chatCanvasStore';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { useCanvasVoice } from '@/hooks/useCanvasVoice';

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
// Widget content registry
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

// ---------------------------------------------------------------------------
// Responsive breakpoints & widget sizing
// ---------------------------------------------------------------------------

const BP_WIDE = 1440;
const BP_DESKTOP = 1200;
const BP_LAPTOP = 1024;
const BP_TABLET = 768;

function getDefaultWidgetSize(screenWidth: number) {
  if (screenWidth >= BP_WIDE) return { width: 400, height: 320 };
  if (screenWidth >= BP_DESKTOP) return { width: 360, height: 280 };
  if (screenWidth >= BP_LAPTOP) return { width: 320, height: 260 };
  if (screenWidth >= BP_TABLET) return { width: 280, height: 240 };
  return { width: 260, height: 220 };
}

// ---------------------------------------------------------------------------
// CanvasWorkspace
// ---------------------------------------------------------------------------

export function CanvasWorkspace(): React.ReactElement {
  const { mode, stageOpen } = useImmersion();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Responsive layout tier
  const isWide = screenWidth >= BP_WIDE;
  const isDesktop = screenWidth >= BP_DESKTOP;
  const isLaptop = screenWidth >= BP_LAPTOP;
  const isTablet = screenWidth >= BP_TABLET;

  const defaultWidgetSize = getDefaultWidgetSize(screenWidth);

  // Chat | Canvas sub-mode
  const [subMode, setSubMode] = useState<CanvasMode>(getCanvasMode());
  const [activityEvents, setActivityEvents] = useState(getActivityEvents());

  useEffect(() => {
    const unsubscribe = subscribeCanvas((state) => {
      setSubMode(state.mode);
      setActivityEvents(state.activityEvents);
    });
    return unsubscribe;
  }, []);

  // Voice pipeline: Ava voice session (ElevenLabs TTS + STT → Orchestrator → Agents)
  // useCanvasVoice syncs persona state to chatCanvasStore automatically
  const avaVoice = useCanvasVoice('ava');

  // Live persona state from voice pipeline
  const [personaState, setPersonaState] = useState<PersonaState>(getPersonaState() as PersonaState);
  const [activeAgent, setActiveAgentLocal] = useState(getActiveAgent());

  useEffect(() => {
    const unsubscribe = subscribeCanvas((state) => {
      setPersonaState(state.personaState as PersonaState);
      setActiveAgentLocal(state.activeAgent);
    });
    return unsubscribe;
  }, []);

  // Auto-start voice session when entering chat mode
  useEffect(() => {
    if (subMode === 'chat' && !avaVoice.isListening && !avaVoice.isProcessing && avaVoice.status === 'idle') {
      // Voice session starts on user interaction (browser autoplay policy)
      // We don't auto-start — user taps the Persona orb or control bar
    }
  }, [subMode]);

  // Drag-drop integration
  const { setNodeRef, isOver } = Platform.OS === 'web'
    ? useDroppable({ id: 'canvas-workspace' })
    : { setNodeRef: () => {}, isOver: false };
  const { dragState, widgets, addWidget, removeWidget, checkCollision } = useCanvasDragDrop();

  // Placed widgets state
  const [placedWidgets, setPlacedWidgets] = useState<
    Array<{ id: string; instanceId: string; position: { x: number; y: number }; size: { width: number; height: number } }>
  >([]);

  // Header entrance animation
  const headerAnim = useRef(new Animated.Value(0)).current;
  const canvasDepthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    headerAnim.setValue(0);
    canvasDepthAnim.setValue(0);

    Animated.spring(headerAnim, {
      toValue: 1,
      damping: 25,
      stiffness: 200,
      mass: 1.0,
      useNativeDriver: true,
    }).start();

    // 3D canvas entrance — scale up from slightly smaller
    Animated.spring(canvasDepthAnim, {
      toValue: 1,
      damping: 20,
      stiffness: 180,
      mass: 1.1,
      useNativeDriver: true,
    }).start();

    emitCanvasEvent('mode_change', { mode: 'canvas' });
  }, []);

  // Widget selection from dock
  const handleWidgetSelect = useCallback((widgetId: string) => {
    const instanceId = `${widgetId}-${Date.now()}`;
    let x = 80;
    let y = 120;
    const step = 40;

    for (const pw of placedWidgets) {
      if (Math.abs(pw.position.x - x) < 50 && Math.abs(pw.position.y - y) < 50) {
        x += step;
        y += step;
      }
    }

    setPlacedWidgets((prev) => [
      ...prev,
      { id: widgetId, instanceId, position: { x, y }, size: { ...defaultWidgetSize } },
    ]);
  }, [placedWidgets, defaultWidgetSize]);

  const handleWidgetClose = useCallback((instanceId: string) => {
    setPlacedWidgets((prev) => prev.filter((w) => w.instanceId !== instanceId));
  }, []);

  const handlePositionChange = useCallback((instanceId: string, position: { x: number; y: number }) => {
    setPlacedWidgets((prev) =>
      prev.map((w) => (w.instanceId === instanceId ? { ...w, position } : w))
    );
  }, []);

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

  // 3D canvas depth interpolation
  const canvasScale = canvasDepthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });
  const canvasOpacity = canvasDepthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Snap ghost validity
  const snapIsValid =
    dragState.previewPosition && dragState.activeWidgetId
      ? !checkCollision(
          dragState.previewPosition,
          defaultWidgetSize,
          dragState.activeWidgetId,
        )
      : true;

  // Responsive content max width
  const contentMaxWidth = isWide ? 1600 : isDesktop ? 1400 : isLaptop ? 1200 : undefined;

  return (
    <View ref={Platform.OS === 'web' ? (setNodeRef as any) : undefined} style={ws.root}>
      {/* Layer 0: Deep background (creates depth behind canvas) */}
      <View style={ws.deepBg} />

      {/* Layer 1: 3D Canvas surface — raised with perspective + thick shadow */}
      <Animated.View
        style={[
          ws.canvasSurface,
          {
            opacity: canvasOpacity,
            transform: [{ scale: canvasScale }],
            // Responsive margin — canvas doesn't touch edges
            margin: isWide ? 24 : isDesktop ? 20 : isLaptop ? 16 : 12,
          },
        ]}
      >
        {/* Inner shadow overlay — creates "sunken surface" 3D feel */}
        <View style={ws.innerShadowTop} pointerEvents="none" />
        <View style={ws.innerShadowLeft} pointerEvents="none" />
        <View style={ws.innerShadowRight} pointerEvents="none" />
        <View style={ws.innerShadowBottom} pointerEvents="none" />

        {/* Edge bevel — 1px bright top/left, dark bottom/right */}
        <View style={ws.bevelHighlight} pointerEvents="none" />

        {/* Dot grid on surface */}
        <CanvasGrid />

        {/* Layer 2: Edge vignette on canvas surface */}
        <View
          style={[
            ws.edgeVignetteLayer,
            Platform.OS === 'web'
              ? ({
                  backgroundImage:
                    'radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.2) 100%)',
                } as unknown as ViewStyle)
              : {},
          ]}
          pointerEvents="none"
        />

        {/* Layer 3: Vignette overlay */}
        <VignetteOverlay />

        {/* Layer 4: Content — responsive padding */}
        <View style={[
          ws.content,
          {
            paddingHorizontal: isWide ? 64 : isDesktop ? 48 : isLaptop ? 32 : 20,
            paddingTop: isDesktop ? 36 : 24,
            maxWidth: contentMaxWidth,
            alignSelf: contentMaxWidth ? 'center' : undefined,
            width: contentMaxWidth ? '100%' : undefined,
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
              Governed execution workspace
            </Text>
          </Animated.View>

          {/* Sub-mode content */}
          {subMode === 'chat' ? (
            <View style={[
              ws.chatCanvasContainer,
              { maxWidth: isWide ? 1200 : CanvasTokens.workspace.gridMaxWidth },
            ]}>
              <ChatCanvas
                webPreviewProps={{
                  activityEvents: activityEvents as any,
                  trustLevel: 'internal',
                }}
                personaElement={
                  <Persona
                    state={personaState}
                    variant={activeAgent}
                    showControls
                    onStateChange={(newState) => {
                      // Control bar interaction — toggle voice session
                      if (newState === 'listening' && !avaVoice.isListening) {
                        avaVoice.startSession();
                      } else if (newState === 'idle' || newState === 'asleep') {
                        avaVoice.endSession();
                      }
                    }}
                  />
                }
                streamEnabled
              />
            </View>
          ) : (
            /* Canvas mode — free-form widget placement */
            <View style={ws.canvasArea}>
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

              {/* Empty state */}
              {placedWidgets.length === 0 && (
                <View style={ws.emptyState}>
                  <View style={ws.emptyIcon}>
                    <View style={ws.emptyIconInner} />
                  </View>
                  <Text style={ws.emptyTitle}>Your workspace is empty</Text>
                  <Text style={ws.emptySub}>
                    {isTablet
                      ? 'Tap widgets from the dock below to get started'
                      : 'Drag or tap widgets from the dock below'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      {/* WidgetDock — macOS-style dock at bottom (canvas mode only) */}
      {subMode === 'canvas' && (
        <WidgetDock
          widgets={DEFAULT_WIDGETS}
          onWidgetSelect={handleWidgetSelect}
          position="bottom"
        />
      )}

      {/* Trash can for drag-to-delete */}
      {subMode === 'canvas' && dragState.isDragging && (
        <CanvasTrashCan />
      )}

      {/* Snap ghost */}
      {dragState.isDragging && dragState.previewPosition && (
        <SnapGhost
          position={dragState.previewPosition}
          size={defaultWidgetSize}
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
    backgroundColor: '#1A1A1A', // Deep background behind the canvas surface
  },

  // Deep background — darker than canvas surface to create depth illusion
  deepBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A1A',
    zIndex: 0,
  },

  // 3D Canvas surface — raised above deep background with thick shadow
  canvasSurface: {
    flex: 1,
    position: 'relative',
    backgroundColor: CanvasTokens.workspace.bg, // #2A2A2A
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: [
            // Thick physical depth shadow (3D feel)
            '0 8px 32px rgba(0, 0, 0, 0.6)',
            '0 4px 16px rgba(0, 0, 0, 0.4)',
            '0 2px 6px rgba(0, 0, 0, 0.3)',
            // Subtle outer rim highlight
            '0 0 0 1px rgba(255, 255, 255, 0.06)',
            // Faint blue ambient
            '0 0 60px rgba(59, 130, 246, 0.04)',
          ].join(', '),
        } as unknown as ViewStyle)
      : {
          elevation: 16,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 32,
        }),
  },

  // Inner shadows — creates the "sunken surface" 3D feel
  innerShadowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 30,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.02) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 30,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.08) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.1) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  // Bevel highlight — bright edge on top/left
  bevelHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 11,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {
          backgroundColor: 'rgba(255,255,255,0.06)',
        }),
  },

  edgeVignetteLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    pointerEvents: 'none',
  },

  content: {
    flex: 1,
    zIndex: 5,
    paddingHorizontal: CanvasTokens.workspace.contentPaddingH,
    paddingTop: CanvasTokens.workspace.contentPaddingV,
    paddingBottom: 80,
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

  chatCanvasContainer: {
    flex: 1,
    width: '100%',
    maxWidth: CanvasTokens.workspace.gridMaxWidth,
    alignSelf: 'center',
  },

  canvasArea: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  // Empty state animated icon
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.2)',
        } as unknown as ViewStyle)
      : {}),
  },

  emptyIconInner: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
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
    textAlign: 'center',
  },
});
