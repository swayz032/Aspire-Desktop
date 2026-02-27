import React, { useRef, useEffect, useMemo } from 'react';
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
import { getTile } from '@/lib/tileManifest';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';
import { Badge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Web keyframes (injected once)
// ---------------------------------------------------------------------------

const KEYFRAME_ID = 'aspire-dryrun-keyframes';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  if (!document.getElementById(KEYFRAME_ID)) {
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = `
      @keyframes dryrunBannerPulse {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }
      @keyframes dryrunSlideIn {
        from { opacity: 0; transform: translateX(12px); }
        to { opacity: 1; transform: translateX(0); }
      }
      .dryrun-container {
        animation: dryrunSlideIn 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .dryrun-banner {
        animation: dryrunBannerPulse 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

// ---------------------------------------------------------------------------
// Risk tier config
// ---------------------------------------------------------------------------

const RISK_CONFIG: Record<
  string,
  {
    borderColor: string;
    tintBg: string;
    bannerBg: string;
    bannerText: string;
    variant: 'success' | 'warning' | 'error';
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  green: {
    borderColor: Colors.semantic.success,
    tintBg: 'rgba(52,199,89,0.04)',
    bannerBg: 'rgba(52,199,89,0.12)',
    bannerText: Colors.semantic.success,
    variant: 'success',
    icon: 'shield-checkmark-outline',
  },
  yellow: {
    borderColor: Colors.semantic.warning,
    tintBg: 'rgba(212,160,23,0.04)',
    bannerBg: 'rgba(212,160,23,0.12)',
    bannerText: Colors.semantic.warning,
    variant: 'warning',
    icon: 'alert-circle-outline',
  },
  red: {
    borderColor: Colors.semantic.error,
    tintBg: 'rgba(255,59,48,0.04)',
    bannerBg: 'rgba(255,59,48,0.12)',
    bannerText: Colors.semantic.error,
    variant: 'error',
    icon: 'warning-outline',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DryRunDisplayProps {
  tileId: string;
  verbId: string;
  riskTier: 'green' | 'yellow' | 'red';
  onProceed: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wc(cls: string): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return { className: cls } as unknown as ViewStyle;
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DryRunDisplay({
  tileId,
  verbId,
  riskTier,
  onProceed,
  onCancel,
}: DryRunDisplayProps): React.ReactElement | null {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const config = RISK_CONFIG[riskTier] ?? RISK_CONFIG.yellow;

  // Resolve tile + verb
  const tile = useMemo(() => getTile(tileId), [tileId]);
  const verb = useMemo(() => {
    if (!tile) return null;
    return tile.verbs.find((v) => v.id === verbId) ?? null;
  }, [tile, verbId]);

  const isIrreversible = riskTier === 'red';

  // Emit telemetry on mount
  useEffect(() => {
    emitCanvasEvent('dry_run_start', { tileId, verbId, riskTier });

    Animated.spring(slideAnim, {
      toValue: 1,
      damping: Canvas.motion.spring.damping,
      stiffness: Canvas.motion.spring.stiffness,
      mass: Canvas.motion.spring.mass,
      useNativeDriver: true,
    }).start();

    return () => {
      emitCanvasEvent('dry_run_end', { tileId, verbId });
    };
  }, [slideAnim, tileId, verbId, riskTier]);

  if (!tile || !verb) return null;

  // Animation transforms
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  // Web glass
  const webGlass: ViewStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${config.borderColor}33`,
        } as unknown as ViewStyle)
      : {};

  return (
    <Animated.View
      style={[
        styles.container,
        webGlass,
        wc('dryrun-container'),
        {
          backgroundColor: config.tintBg,
          borderColor: config.borderColor,
          opacity: slideAnim,
          transform: [{ translateX }],
        },
      ]}
    >
      {/* Preview-only banner */}
      <View
        style={[styles.banner, wc('dryrun-banner'), { backgroundColor: config.bannerBg }]}
        accessibilityRole="alert"
      >
        <Ionicons name="eye-outline" size={14} color={config.bannerText} />
        <Text style={[styles.bannerText, { color: config.bannerText }]}>
          THIS IS A PREVIEW — No action has been taken
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Action summary */}
        <View style={styles.summaryRow}>
          <Ionicons
            name={tile.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={Colors.accent.cyan}
          />
          <View style={styles.summaryText}>
            <Text style={styles.actionLabel}>{verb.label}</Text>
            <Text style={styles.deskLabel}>via {tile.desk}</Text>
          </View>
          <Badge label={`${riskTier} tier`} variant={config.variant} size="sm" />
        </View>

        {/* Detail rows */}
        <View style={styles.detailsSection}>
          <DetailRow
            icon="documents-outline"
            label="Affected Records"
            value="1 record will be affected"
          />
          <DetailRow
            icon="cash-outline"
            label="Estimated Cost"
            value="$0.00"
          />
          <DetailRow
            icon={config.icon}
            label="Risk Tier"
            value={`${riskTier.charAt(0).toUpperCase()}${riskTier.slice(1)} — ${
              riskTier === 'green'
                ? 'Auto-approved'
                : riskTier === 'yellow'
                ? 'Requires confirmation'
                : 'Requires explicit authority'
            }`}
            valueColor={config.bannerText}
          />
          <DetailRow
            icon={isIrreversible ? 'lock-closed-outline' : 'refresh-outline'}
            label="Reversibility"
            value={isIrreversible ? 'Irreversible' : 'Reversible'}
            valueColor={isIrreversible ? Colors.semantic.error : Colors.semantic.success}
          />
          <DetailRow
            icon="time-outline"
            label="Preview Generated"
            value={formatTimestamp()}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.cancelBtn]}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel dry run"
          >
            <Ionicons name="close" size={16} color={Colors.text.secondary} />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.proceedBtn]}
            onPress={onProceed}
            accessibilityRole="button"
            accessibilityLabel="Proceed to authority"
          >
            <Ionicons name="arrow-forward" size={16} color="#fff" />
            <Text style={styles.proceedBtnText}>Proceed to Authority</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Detail row sub-component
// ---------------------------------------------------------------------------

function DetailRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}): React.ReactElement {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={14} color={Colors.text.muted} style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, valueColor ? { color: valueColor } : undefined]}
      >
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderRadius: Canvas.stage.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },

  // -- Banner ----------------------------------------------------------------

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },

  bannerText: {
    ...Typography.smallMedium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // -- Content ---------------------------------------------------------------

  content: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },

  // -- Summary row -----------------------------------------------------------

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },

  summaryText: {
    flex: 1,
  },

  actionLabel: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },

  deskLabel: {
    ...Typography.micro,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // -- Details ---------------------------------------------------------------

  detailsSection: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
  },

  detailIcon: {
    width: 20,
    textAlign: 'center',
  },

  detailLabel: {
    ...Typography.small,
    color: Colors.text.tertiary,
    width: 130,
    marginLeft: Spacing.sm,
  },

  detailValue: {
    ...Typography.small,
    color: Colors.text.secondary,
    flex: 1,
  },

  // -- Actions ---------------------------------------------------------------

  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'flex-end',
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },

  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },

  cancelBtnText: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },

  proceedBtn: {
    backgroundColor: Colors.accent.cyan,
  },

  proceedBtnText: {
    ...Typography.captionMedium,
    color: '#ffffff',
  },
});
