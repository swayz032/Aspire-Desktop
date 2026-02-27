import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Canvas,
} from '@/constants/tokens';
import {
  useImmersion,
  setStageOpen,
} from '@/lib/immersionStore';
import { getTile, type TileEntry, type TileVerb } from '@/lib/tileManifest';
import {
  getStepIndex,
  isTerminal,
  type RunwayState,
} from '@/lib/runwayMachine';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { playSound } from '@/lib/soundManager';
import { Badge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Web keyframes (injected once)
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-stage-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes stagePanelGlow {
        0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 rgba(59,130,246,0); }
        50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 0 20px rgba(59,130,246,0.06); }
      }
      @keyframes stageFieldPulse {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.8; }
      }
      @keyframes stageReceiptShimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .stage-panel { animation: stagePanelGlow 4s ease-in-out infinite; }
      .stage-panel:hover { box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 0 30px rgba(59,130,246,0.08) !important; }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Risk tier colors
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: 'rgba(52,199,89,0.15)', text: '#34c759', label: 'Green' },
  yellow: { bg: 'rgba(212,160,23,0.15)', text: '#d4a017', label: 'Yellow' },
  red: { bg: 'rgba(255,59,48,0.15)', text: '#ff3b30', label: 'Red' },
};

// ---------------------------------------------------------------------------
// Runway progress labels
// ---------------------------------------------------------------------------

const STEP_LABELS: readonly string[] = [
  'Idle',
  'Preflight',
  'Drafting',
  'Draft Ready',
  'Submitting',
  'Pending',
  'Approved',
  'Executing',
  'Receipt Ready',
];

function getRunwayLabel(state: RunwayState): string {
  if (state === 'ERROR') return 'Error';
  if (state === 'CANCELLED') return 'Cancelled';
  if (state === 'TIMEOUT') return 'Timed Out';
  const idx = getStepIndex(state);
  return STEP_LABELS[idx] ?? 'Unknown';
}

function getRunwayColor(state: RunwayState): string {
  if (state === 'ERROR' || state === 'TIMEOUT') return Canvas.runway.errorColor;
  if (state === 'CANCELLED') return Colors.text.muted;
  if (state === 'RECEIPT_READY') return Canvas.runway.completeColor;
  return Canvas.runway.activeColor;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RunwayProgress({ runwayState }: { runwayState: RunwayState }): React.ReactElement {
  const stepIdx = getStepIndex(runwayState);
  const color = getRunwayColor(runwayState);
  const label = getRunwayLabel(runwayState);
  const total = 8; // steps 0-7

  return (
    <View style={styles.runwayBar}>
      <View style={styles.runwaySteps}>
        {Array.from({ length: total }, (_, i) => {
          const filled = stepIdx >= 0 && i <= stepIdx;
          return (
            <View
              key={i}
              style={[
                styles.runwayDot,
                {
                  backgroundColor: filled ? color : Colors.border.default,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.runwayLabel, { color }]}>{label}</Text>
    </View>
  );
}

function DraftPanel({ tile, verb }: { tile: TileEntry; verb: TileVerb }): React.ReactElement {
  const risk = RISK_COLORS[verb.riskTier] ?? RISK_COLORS.green;

  return (
    <View style={styles.panelInner}>
      <View style={styles.panelHeader}>
        <Ionicons
          name={tile.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={Colors.accent.cyan}
        />
        <Text style={styles.panelTitle}>{verb.label}</Text>
      </View>

      <View style={styles.riskRow}>
        <Badge
          label={`${risk.label} Tier`}
          variant={verb.riskTier === 'green' ? 'success' : verb.riskTier === 'yellow' ? 'warning' : 'error'}
          size="sm"
        />
        <Text style={styles.deskLabel}>{tile.desk}</Text>
      </View>

      <View style={styles.fieldsContainer}>
        {verb.lensFields.map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <View style={styles.fieldPlaceholder}>
              <Text style={styles.fieldPlaceholderText}>
                {field.type === 'currency' ? '$0.00' : field.type === 'date' ? 'Select date' : 'Enter value'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function AuthorityPanel({ verb }: { verb: TileVerb }): React.ReactElement {
  const risk = RISK_COLORS[verb.riskTier] ?? RISK_COLORS.green;
  const needsApproval = verb.riskTier === 'yellow' || verb.riskTier === 'red';

  return (
    <View style={styles.panelInner}>
      <View style={styles.panelHeader}>
        <Ionicons name="shield-checkmark-outline" size={18} color={risk.text} />
        <Text style={styles.panelTitle}>Authority</Text>
      </View>

      {needsApproval ? (
        <View style={styles.authorityContent}>
          <View style={[styles.authorityBadge, { backgroundColor: risk.bg }]}>
            <Ionicons name="time-outline" size={20} color={risk.text} />
            <Text style={[styles.authorityText, { color: risk.text }]}>
              Awaiting Approval
            </Text>
          </View>

          <Text style={styles.authorityDesc}>
            This action requires {verb.riskTier === 'red' ? 'explicit authority confirmation' : 'your confirmation'} before execution.
          </Text>

          <View style={styles.authorityButtons}>
            <Pressable
              style={[styles.authorityBtn, styles.approveBtn]}
              accessibilityRole="button"
              accessibilityLabel="Approve action"
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={styles.approveBtnText}>Approve</Text>
            </Pressable>
            <Pressable
              style={[styles.authorityBtn, styles.denyBtn]}
              accessibilityRole="button"
              accessibilityLabel="Deny action"
            >
              <Ionicons name="close" size={16} color={Colors.semantic.error} />
              <Text style={styles.denyBtnText}>Deny</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.authorityContent}>
          <View style={[styles.authorityBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.semantic.success} />
            <Text style={[styles.authorityText, { color: Colors.semantic.success }]}>
              Auto-Approved
            </Text>
          </View>
          <Text style={styles.authorityDesc}>
            Green tier actions execute automatically with receipt logging.
          </Text>
        </View>
      )}
    </View>
  );
}

function ReceiptPanel(): React.ReactElement {
  return (
    <View style={styles.panelInner}>
      <View style={styles.panelHeader}>
        <Ionicons name="receipt-outline" size={18} color={Colors.text.muted} />
        <Text style={styles.panelTitle}>Receipt</Text>
      </View>

      <View style={styles.receiptEmpty}>
        <Ionicons name="document-text-outline" size={40} color={Colors.border.default} />
        <Text style={styles.receiptEmptyTitle}>Receipt will appear here</Text>
        <Text style={styles.receiptEmptyDesc}>
          An immutable receipt is generated for every action — success or failure.
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Focus trap helpers (web only)
// ---------------------------------------------------------------------------

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Stage(): React.ReactElement | null {
  const { stageOpen, stagedTileId, runwayState, mode } = useImmersion();

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const containerRef = useRef<View>(null);
  const isVisible = useRef(false);

  // Resolve tile (deny-by-default)
  const tile = useMemo(() => {
    if (!stagedTileId) return null;
    return getTile(stagedTileId);
  }, [stagedTileId]);

  const defaultVerb = useMemo(() => {
    if (!tile) return null;
    return tile.verbs.find((v) => v.id === tile.defaultVerb) ?? tile.verbs[0] ?? null;
  }, [tile]);

  // Should the stage be visible?
  const shouldShow = stageOpen && mode !== 'off' && tile !== null && defaultVerb !== null;

  // ---------------------------------------------------------------------------
  // Enter / exit animation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (shouldShow && !isVisible.current) {
      isVisible.current = true;
      playSound('stage_open');
      emitCanvasEvent('stage_open', { tileId: stagedTileId ?? '' });

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: Canvas.motion.stageEnter,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: Canvas.motion.stageEnter,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!shouldShow && isVisible.current) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: Canvas.motion.stageExit,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: Canvas.motion.stageExit,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isVisible.current = false;
      });

      playSound('stage_close');
      emitCanvasEvent('stage_close', { tileId: stagedTileId ?? '' });
    }
  }, [shouldShow, slideAnim, opacityAnim, stagedTileId]);

  // ---------------------------------------------------------------------------
  // Focus trap + Escape (web only)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (Platform.OS !== 'web' || !shouldShow) return;

    function handleKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setStageOpen(false);
        return;
      }

      if (e.key === 'Tab') {
        // Focus trap within the stage
        const container = document.querySelector('[data-stage-root]') as HTMLElement | null;
        if (!container) return;

        const focusable = getFocusableElements(container);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeydown, true); // capture phase
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
    };
  }, [shouldShow]);

  // Auto-focus first element on open
  useEffect(() => {
    if (Platform.OS !== 'web' || !shouldShow) return;

    const timer = setTimeout(() => {
      const container = document.querySelector('[data-stage-root]') as HTMLElement | null;
      if (container) {
        const focusable = getFocusableElements(container);
        if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, Canvas.motion.stageEnter + 20);

    return () => clearTimeout(timer);
  }, [shouldShow]);

  // ---------------------------------------------------------------------------
  // Early return — nothing to render
  // ---------------------------------------------------------------------------

  if (!shouldShow && !isVisible.current) return null;
  if (!tile || !defaultVerb) return null;

  // ---------------------------------------------------------------------------
  // Animated transforms
  // ---------------------------------------------------------------------------

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  // ---------------------------------------------------------------------------
  // Web glass styles
  // ---------------------------------------------------------------------------

  const webBackdropStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: `blur(${Canvas.stage.backdropBlur}px)`,
          WebkitBackdropFilter: `blur(${Canvas.stage.backdropBlur}px)`,
        } as unknown as ViewStyle)
      : {};

  const webPanelStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.3s ease',
        } as unknown as ViewStyle)
      : {};

  const webPanelClass: ViewStyle =
    Platform.OS === 'web'
      ? ({ className: 'stage-panel' } as unknown as ViewStyle)
      : {};

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={shouldShow ? 'auto' : 'none'}
    >
      {/* Backdrop overlay */}
      <Animated.View
        style={[
          styles.backdrop,
          webBackdropStyle,
          { opacity: opacityAnim },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setStageOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close stage"
        />
      </Animated.View>

      {/* Stage container */}
      <Animated.View
        ref={containerRef}
        style={[
          styles.stageContainer,
          {
            opacity: opacityAnim,
            transform: [{ translateY }],
          },
        ]}
        accessibilityRole="none"
        accessibilityLabel={`Stage: ${defaultVerb.label} via ${tile.desk}`}
        {...(Platform.OS === 'web' ? { 'data-stage-root': true } as Record<string, unknown> : {})}
      >
        {/* Runway progress bar */}
        <RunwayProgress runwayState={runwayState} />

        {/* Three-column panel layout */}
        <View style={styles.panelsRow}>
          {/* Draft panel — 35% */}
          <View style={[styles.panel, styles.panelDraft, webPanelStyle, webPanelClass]}>
            <DraftPanel tile={tile} verb={defaultVerb} />
          </View>

          {/* Authority panel — 30% */}
          <View style={[styles.panel, styles.panelAuthority, webPanelStyle, webPanelClass]}>
            <AuthorityPanel verb={defaultVerb} />
          </View>

          {/* Receipt panel — 35% */}
          <View style={[styles.panel, styles.panelReceipt, webPanelStyle, webPanelClass]}>
            <ReceiptPanel />
          </View>
        </View>

        {/* Close hint */}
        <View style={styles.closeHint}>
          <Text style={styles.closeHintText}>
            Press <Text style={styles.closeHintKey}>Esc</Text> to close
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Canvas.stage.overlayBg,
  },

  stageContainer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    top: 80,
    flexDirection: 'column',
  },

  // -- Runway progress bar --------------------------------------------------

  runwayBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },

  runwaySteps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Canvas.runway.stepGap,
  },

  runwayDot: {
    width: Canvas.runway.stepSize / 3,
    height: Canvas.runway.stepSize / 3,
    borderRadius: Canvas.runway.stepSize / 6,
  },

  runwayLabel: {
    ...Typography.small,
    fontWeight: '600',
  },

  // -- Panel layout ----------------------------------------------------------

  panelsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Canvas.stage.panelGap,
  },

  panel: {
    backgroundColor: 'rgba(20,20,22,0.85)',
    borderRadius: Canvas.stage.borderRadius,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },

  panelDraft: {
    flex: 35,
  },

  panelAuthority: {
    flex: 30,
  },

  panelReceipt: {
    flex: 35,
  },

  panelInner: {
    flex: 1,
    padding: Spacing.xl,
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },

  panelTitle: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },

  // -- Draft panel -----------------------------------------------------------

  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },

  deskLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  fieldsContainer: {
    gap: Spacing.md,
  },

  fieldRow: {
    gap: Spacing.xs,
  },

  fieldLabel: {
    ...Typography.small,
    color: Colors.text.tertiary,
  },

  fieldPlaceholder: {
    backgroundColor: Colors.surface.input,
    borderWidth: 1,
    borderColor: Colors.surface.inputBorder,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },

  fieldPlaceholderText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },

  // -- Authority panel -------------------------------------------------------

  authorityContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },

  authorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },

  authorityText: {
    ...Typography.captionMedium,
  },

  authorityDesc: {
    ...Typography.small,
    color: Colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  authorityButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },

  authorityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },

  approveBtn: {
    backgroundColor: Colors.accent.cyan,
  },

  approveBtnText: {
    ...Typography.captionMedium,
    color: '#ffffff',
  },

  denyBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.semantic.errorLight,
  },

  denyBtnText: {
    ...Typography.captionMedium,
    color: Colors.semantic.error,
  },

  // -- Receipt panel ---------------------------------------------------------

  receiptEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },

  receiptEmptyTitle: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },

  receiptEmptyDesc: {
    ...Typography.small,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },

  // -- Close hint ------------------------------------------------------------

  closeHint: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },

  closeHintText: {
    ...Typography.micro,
    color: Colors.text.muted,
  },

  closeHintKey: {
    ...Typography.micro,
    color: Colors.text.tertiary,
    fontWeight: '700',
  },
});
