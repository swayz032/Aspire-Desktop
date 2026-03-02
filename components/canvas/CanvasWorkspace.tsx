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

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  Animated,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
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
import { useCanvasDragDrop } from '@/lib/canvasDragDrop';
import { playSound } from '@/lib/soundManager';
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
import { useSupabase } from '@/providers';

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
import { AgentWidget } from './widgets/AgentWidget';

// ---------------------------------------------------------------------------
// Widget content registry
// ---------------------------------------------------------------------------

interface WidgetDef {
  title: string;
  component: React.ComponentType<any>;
  accent: string;
  icon: string; // Ionicons name
}

const AvaAgentWidget = (props: any) => <AgentWidget {...props} agentId="ava" />;
const EliAgentWidget = (props: any) => <AgentWidget {...props} agentId="eli" />;
const FinnAgentWidget = (props: any) => <AgentWidget {...props} agentId="finn" />;

const WIDGET_CONTENT: Record<string, WidgetDef> = {
  email:    { title: 'Inbox',            component: EmailWidget,          accent: '#3B82F6', icon: 'mail' },
  invoice:  { title: 'Invoices',         component: InvoiceWidget,        accent: '#F59E0B', icon: 'receipt' },
  quote:    { title: 'Quotes',           component: QuoteWidget,          accent: '#06B6D4', icon: 'pricetag' },
  contract: { title: 'Contracts',        component: ContractWidget,       accent: '#EF4444', icon: 'document-text' },
  calendar: { title: 'Calendar',         component: CalendarWidget,       accent: '#10B981', icon: 'calendar' },
  finance:  { title: 'Finance Hub',      component: FinanceHubWidget,     accent: '#059669', icon: 'trending-up' },
  task:     { title: "Today's Plan",     component: TodaysPlanWidget,     accent: '#8B5CF6', icon: 'checkbox' },
  approval: { title: 'Authority Queue',  component: AuthorityQueueWidget, accent: '#F97316', icon: 'shield-checkmark' },
  note:     { title: 'Sticky Notes',     component: StickyNoteWidget,     accent: '#EAB308', icon: 'create' },
  receipt:  { title: 'Receipts',         component: ReceiptsWidget,       accent: '#6366F1', icon: 'file-tray-full' },
  ava:      { title: 'Ava',             component: AvaAgentWidget,       accent: '#3B82F6', icon: 'person' },
  eli:      { title: 'Eli',             component: EliAgentWidget,       accent: '#F59E0B', icon: 'chatbubbles' },
  finn:     { title: 'Finn',            component: FinnAgentWidget,      accent: '#8B5CF6', icon: 'stats-chart' },
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
  const { suiteId } = useSupabase();
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

  const avaVoice = useCanvasVoice('ava');
  const eliVoice = useCanvasVoice('eli');
  const finnVoice = useCanvasVoice('finn');

  const voiceHooks = { ava: avaVoice, eli: eliVoice, finn: finnVoice } as const;

  const handleAgentSelect = useCallback((agentId: string) => {
    const hook = voiceHooks[agentId as keyof typeof voiceHooks];
    if (!hook) return;
    if (hook.status === 'idle') {
      Object.entries(voiceHooks).forEach(([id, h]) => {
        if (id !== agentId && h.status !== 'idle') h.endSession();
      });
      hook.startSession();
      playSound('dock_agent_start');
    } else {
      hook.endSession();
      playSound('dock_agent_end');
    }
  }, [avaVoice, eliVoice, finnVoice]);

  const activeAgentVoiceId = avaVoice.status !== 'idle'
    ? 'ava'
    : eliVoice.status !== 'idle'
      ? 'eli'
      : finnVoice.status !== 'idle'
        ? 'finn'
        : null;

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
    playSound('dock_drop');
  }, [placedWidgets, defaultWidgetSize]);

  const handleWidgetDrop = useCallback((widgetId: string, position: { x: number; y: number }) => {
    const hasCollision = checkCollision(position, defaultWidgetSize);
    if (hasCollision) {
      position = { x: position.x + 32, y: position.y + 32 };
    }
    const instanceId = `${widgetId}-${Date.now()}`;
    const maxZ = placedWidgets.reduce((z, w) => Math.max(z, 1), 1);
    addWidget({ id: instanceId, position, size: { ...defaultWidgetSize }, zIndex: maxZ + 1 });
    setPlacedWidgets((prev) => [
      ...prev,
      { id: widgetId, instanceId, position, size: { ...defaultWidgetSize } },
    ]);
    playSound('dock_drop');
  }, [defaultWidgetSize, checkCollision, addWidget, placedWidgets]);

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

  // Responsive margin for floating slab
  const slabMargin = isWide
    ? CanvasTokens.workspace.margin.wide
    : isDesktop
      ? CanvasTokens.workspace.margin.desktop
      : isLaptop
        ? CanvasTokens.workspace.margin.laptop
        : CanvasTokens.workspace.margin.tablet;

  // Cursor spotlight (web only)
  const spotlightRef = useRef<View>(null);
  const [spotlightPos, setSpotlightPos] = useState<{ x: number; y: number } | null>(null);

  const rafId = useRef<number>(0);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = spotlightRef.current as unknown as HTMLElement | null;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        setSpotlightPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });
    };
    const onLeave = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      setSpotlightPos(null);
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  const copyLatestDiagnostic = useCallback(async () => {
    if (!avaVoice.latestDiagnostic) return;
    const payload = JSON.stringify(avaVoice.latestDiagnostic, null, 2);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      } else {
        Alert.alert('Diagnostic', payload);
      }
    } catch {
      Alert.alert('Diagnostic', payload);
    }
  }, [avaVoice.latestDiagnostic]);

  const spotlightStyle = useMemo(() => {
    if (Platform.OS !== 'web' || !spotlightPos) return {};
    return {
      backgroundImage: `radial-gradient(circle ${CanvasTokens.workspace.spotlightRadius}px at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(255,255,255,${CanvasTokens.workspace.spotlightOpacity}), transparent)`,
    } as unknown as ViewStyle;
  }, [spotlightPos]);

  return (
    <View style={ws.root}>
      {/* Layer 0: Dark void behind the slab */}
      <View style={ws.deepBg} />

      {/* Layer 1: Perspective wrapper for 3D entrance */}
      <Animated.View
        style={[
          ws.slabOuter,
          {
            marginHorizontal: slabMargin,
            marginTop: slabMargin,
            marginBottom: slabMargin,
            opacity: canvasOpacity,
            transform: [{ scale: canvasScale }],
          },
          Platform.OS === 'web'
            ? ({
                perspective: `${CanvasTokens.workspace.perspective}px`,
              } as unknown as ViewStyle)
            : {},
        ]}
      >
        {/* 3D edge — bottom face (visible thickness) */}
        <View style={ws.edgeBottom} pointerEvents="none" />
        {/* 3D edge — right face */}
        <View style={ws.edgeRight} pointerEvents="none" />

        {/* Canvas surface — clipped inner layer */}
        <View ref={spotlightRef} style={ws.canvasSurface}>
          {/* Inner shadow overlay — sunken surface 3D feel */}
          <View style={ws.innerShadowTop} pointerEvents="none" />
          <View style={ws.innerShadowLeft} pointerEvents="none" />
          <View style={ws.innerShadowRight} pointerEvents="none" />
          <View style={ws.innerShadowBottom} pointerEvents="none" />

          {/* Top highlight bevel */}
          <View style={ws.bevelHighlight} pointerEvents="none" />

          {/* Dot grid on surface */}
          <CanvasGrid />

          {/* Edge vignette */}
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

          {/* Vignette overlay */}
          <VignetteOverlay />

          {/* Cursor spotlight (web only) */}
          {spotlightPos && (
            <View
              style={[ws.spotlightLayer, spotlightStyle]}
              pointerEvents="none"
            />
          )}

          {/* Content layer — ScrollView for chat, overflow visible for canvas drag */}
          {subMode === 'chat' ? (
            <ScrollView
              style={ws.scrollLayer}
              contentContainerStyle={[
                ws.scrollContent,
                { minHeight: CanvasTokens.workspace.minHeight },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
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
                      <View style={ws.personaVoiceWrap}>
                        <Pressable
                          onPress={() => {
                            if (avaVoice.status === 'idle') {
                              avaVoice.startSession();
                            } else {
                              avaVoice.endSession();
                            }
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={avaVoice.status === 'idle' ? 'Start talking to Ava' : 'End voice session'}
                        >
                          <Persona
                            state={personaState}
                            variant="obsidian"
                            style={{ width: 240, height: 240 }}
                          />
                        </Pressable>

                        {avaVoice.latestDiagnostic && (
                          <View style={ws.diagnosticBanner}>
                            <Text style={ws.diagnosticTitle}>
                              Voice issue: {avaVoice.latestDiagnostic.stage.toUpperCase()} • {avaVoice.latestDiagnostic.code}
                            </Text>
                            <Text style={ws.diagnosticMsg} numberOfLines={3}>
                              {avaVoice.latestDiagnostic.message}
                            </Text>
                            <Text style={ws.diagnosticTrace} numberOfLines={1}>
                              Trace: {avaVoice.latestDiagnostic.traceId}
                            </Text>
                            <View style={ws.diagnosticActions}>
                              <Pressable style={ws.diagBtn} onPress={copyLatestDiagnostic}>
                                <Text style={ws.diagBtnText}>Copy Debug</Text>
                              </Pressable>
                              {avaVoice.latestDiagnostic.stage === 'autoplay' && (
                                <Pressable
                                  style={[ws.diagBtn, ws.diagBtnPrimary]}
                                  onPress={() => { avaVoice.replayLastAudio(); }}
                                >
                                  <Text style={[ws.diagBtnText, ws.diagBtnPrimaryText]}>Retry Audio</Text>
                                </Pressable>
                              )}
                              <Pressable style={ws.diagBtn} onPress={avaVoice.clearDiagnostics}>
                                <Text style={ws.diagBtnText}>Dismiss</Text>
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    }
                    streamEnabled={false}
                    browserEvents={avaVoice.browserEvents}
                  />
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={[
              ws.contentCanvas,
              {
                paddingHorizontal: isWide ? 64 : isDesktop ? 48 : isLaptop ? 32 : 20,
                paddingTop: isDesktop ? 36 : 24,
                maxWidth: contentMaxWidth,
                alignSelf: contentMaxWidth ? 'center' : undefined,
                width: contentMaxWidth ? '100%' : undefined,
              },
            ]}>
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

              <View
                style={ws.canvasArea}
                {...(Platform.OS === 'web' ? { dataSet: { canvasDrop: 'true' } } as any : {})}
              >
                {placedWidgets.map((pw) => {
                  const widgetDef = WIDGET_CONTENT[pw.id];
                  if (!widgetDef) return null;
                  const WidgetContent = widgetDef.component;
                  return (
                    <WidgetContainer
                      key={pw.instanceId}
                      title={widgetDef.title}
                      accent={widgetDef.accent}
                      icon={widgetDef.icon}
                      position={pw.position}
                      size={pw.size}
                      onPositionChange={(pos) => handlePositionChange(pw.instanceId, pos)}
                      onSizeChange={(size) => handleSizeChange(pw.instanceId, size)}
                      onClose={() => handleWidgetClose(pw.instanceId)}
                    >
                      <WidgetContent suiteId={suiteId || ''} officeId="" />
                    </WidgetContainer>
                  );
                })}

                {placedWidgets.length === 0 && (
                  <View style={ws.emptyState}>
                    <View style={ws.emptyIcon}>
                      <View style={ws.emptyIconPulse} />
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
            </View>
          )}
        </View>
      </Animated.View>



      {/* WidgetDock — macOS-style dock at bottom (canvas mode only) */}
      {subMode === 'canvas' && (
        <WidgetDock
          widgets={DEFAULT_WIDGETS}
          onWidgetSelect={handleWidgetSelect}
          onWidgetDrop={handleWidgetDrop}
          onAgentSelect={handleAgentSelect}
          position="bottom"
          activeWidgetIds={placedWidgets.map(pw => pw.id)}
          activeAgentId={activeAgentVoiceId}
        />
      )}

      {/* Trash can for drag-to-delete */}
      {subMode === 'canvas' && dragState.isDragging && (
        <CanvasTrashCan state="active" />
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
    backgroundColor: CanvasTokens.workspace.behindBg,
  },

  deepBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: CanvasTokens.workspace.behindBg,
    zIndex: 0,
  },

  slabOuter: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },

  edgeBottom: {
    position: 'absolute',
    bottom: -CanvasTokens.workspace.edgeThickness,
    left: 2,
    right: -2,
    height: CanvasTokens.workspace.edgeThickness,
    backgroundColor: CanvasTokens.workspace.edgeColor,
    borderBottomLeftRadius: CanvasTokens.workspace.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 0,
  },

  edgeRight: {
    position: 'absolute',
    top: 2,
    right: -CanvasTokens.workspace.edgeThickness,
    bottom: -2,
    width: CanvasTokens.workspace.edgeThickness,
    backgroundColor: CanvasTokens.workspace.edgeShadowColor,
    borderTopRightRadius: CanvasTokens.workspace.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 0,
  },

  canvasSurface: {
    flex: 1,
    position: 'relative',
    backgroundColor: CanvasTokens.workspace.bg,
    borderRadius: CanvasTokens.workspace.surfaceRadius,
    overflow: 'hidden',
    minHeight: CanvasTokens.workspace.minHeight,
    zIndex: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: CanvasTokens.workspace.outerShadow,
        } as unknown as ViewStyle)
      : {}),
  },

  innerShadowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    borderTopLeftRadius: CanvasTokens.workspace.surfaceRadius,
    borderTopRightRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 35,
    borderTopLeftRadius: CanvasTokens.workspace.surfaceRadius,
    borderBottomLeftRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 35,
    borderTopRightRadius: CanvasTokens.workspace.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.14) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },
  innerShadowBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    borderBottomLeftRadius: CanvasTokens.workspace.surfaceRadius,
    borderBottomRightRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.18) 0%, transparent 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {}),
  },

  bevelHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    zIndex: 11,
    borderTopLeftRadius: CanvasTokens.workspace.surfaceRadius,
    borderTopRightRadius: CanvasTokens.workspace.surfaceRadius,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.1) 100%)',
          pointerEvents: 'none',
        } as unknown as ViewStyle)
      : {
          backgroundColor: CanvasTokens.workspace.topHighlight,
        }),
  },

  edgeVignetteLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 2,
    pointerEvents: 'none',
  },

  spotlightLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CanvasTokens.workspace.surfaceRadius,
    zIndex: 3,
    pointerEvents: 'none',
  },

  scrollLayer: {
    flex: 1,
    zIndex: 5,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    flex: 1,
    zIndex: 5,
    paddingHorizontal: CanvasTokens.workspace.contentPaddingH,
    paddingTop: CanvasTokens.workspace.contentPaddingV,
    paddingBottom: 100,
  },

  contentCanvas: {
    flex: 1,
    zIndex: 5,
    overflow: 'visible',
    paddingHorizontal: CanvasTokens.workspace.contentPaddingH,
    paddingTop: CanvasTokens.workspace.contentPaddingV,
    paddingBottom: 100,
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
  personaVoiceWrap: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 760,
  },
  diagnosticBanner: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 24px rgba(15,23,42,0.45), 0 0 18px rgba(59,130,246,0.18)',
        } as unknown as ViewStyle)
      : {}),
  },
  diagnosticTitle: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  diagnosticMsg: {
    color: '#BFDBFE',
    fontSize: 12,
    marginBottom: 4,
  },
  diagnosticTrace: {
    color: '#93C5FD',
    fontSize: 11,
    marginBottom: 8,
  },
  diagnosticActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  diagBtn: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer' } as unknown as ViewStyle)
      : {}),
  },
  diagBtnPrimary: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },
  diagBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  diagBtnPrimaryText: {
    color: '#DBEAFE',
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
    gap: 16,
    paddingVertical: 80,
  },

  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.25), 0 0 30px rgba(59,130,246,0.04)',
        } as unknown as ViewStyle)
      : {}),
  },

  emptyIconPulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.08)',
    ...(Platform.OS === 'web'
      ? ({
          animation: 'pulse 3s ease-in-out infinite',
        } as unknown as ViewStyle)
      : {}),
  },

  emptyIconInner: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.text.tertiary,
    letterSpacing: 0.3,
  },

  emptySub: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
