import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/tokens';
import SourceBadge from './SourceBadge';

export interface LifecycleStep {
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  provider?: string;
  timestamp?: string | null;
  eventId?: string;
  amount?: number;
}

interface LifecycleChainProps {
  steps: LifecycleStep[];
  title?: string;
  onExplainStep?: (step: LifecycleStep) => void;
}

const CIRCLE_SIZE = 32;
const CIRCLE_INNER = 18;

const STATUS_COLORS: Record<string, string> = {
  completed: Colors.semantic.success,
  current: Colors.accent.cyan,
  pending: Colors.text.disabled,
  error: Colors.semantic.error,
};

const STATUS_BG: Record<string, string> = {
  completed: Colors.semantic.success,
  current: Colors.accent.cyanLight,
  pending: 'transparent',
  error: Colors.semantic.errorLight,
};

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function PulsingCircle() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        { transform: [{ scale: pulseAnim }] },
      ]}
    />
  );
}

function StepCircle({ status }: { status: string }) {
  const bgColor = STATUS_BG[status];
  const borderColor = STATUS_COLORS[status];

  return (
    <View style={styles.circleContainer}>
      {status === 'current' && <PulsingCircle />}
      <View
        style={[
          styles.circle,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: status === 'pending' ? 2 : status === 'current' ? 2 : 0,
          },
        ]}
      >
        {status === 'completed' && (
          <Ionicons name="checkmark" size={16} color="#fff" />
        )}
        {status === 'current' && (
          <View style={styles.currentDots}>
            <View style={[styles.currentDot, { backgroundColor: Colors.accent.cyan }]} />
            <View style={[styles.currentDot, { backgroundColor: Colors.accent.cyan }]} />
            <View style={[styles.currentDot, { backgroundColor: Colors.accent.cyan }]} />
          </View>
        )}
        {status === 'error' && (
          <Ionicons name="close" size={16} color={Colors.semantic.error} />
        )}
      </View>
    </View>
  );
}

function ConnectorLine({ fromStatus, toStatus }: { fromStatus: string; toStatus: string }) {
  const isCompleted = fromStatus === 'completed' && (toStatus === 'completed' || toStatus === 'current');
  const isCurrent = fromStatus === 'completed' && toStatus === 'current';
  const isError = toStatus === 'error' || fromStatus === 'error';

  let lineColor: string = Colors.text.disabled;
  let lineStyle: 'solid' | 'dashed' | 'dotted' = 'dotted';

  if (isCompleted && !isCurrent) {
    lineColor = Colors.semantic.success;
    lineStyle = 'solid';
  } else if (isCurrent) {
    lineColor = Colors.accent.cyan;
    lineStyle = 'dashed';
  } else if (isError) {
    lineColor = Colors.semantic.error;
    lineStyle = 'dashed';
  }

  if (Platform.OS === 'web') {
    return (
      <View style={styles.connectorWrapper}>
        <div
          style={{
            flex: 1,
            height: 2,
            borderTop: `2px ${lineStyle} ${lineColor}`,
          } as any}
        />
      </View>
    );
  }

  return (
    <View style={styles.connectorWrapper}>
      <View
        style={[
          styles.connectorLine,
          {
            backgroundColor: lineStyle === 'solid' ? lineColor : 'transparent',
            borderBottomColor: lineStyle !== 'solid' ? lineColor : 'transparent',
            borderBottomWidth: lineStyle !== 'solid' ? 2 : 0,
            borderStyle: lineStyle,
          },
        ]}
      />
    </View>
  );
}

export default function LifecycleChain({ steps, title, onExplainStep }: LifecycleChainProps) {
  return (
    <View style={styles.card}>
      {title && (
        <View style={styles.titleRow}>
          <Ionicons name="git-network-outline" size={16} color={Colors.text.muted} />
          <Text style={styles.titleText}>{title}</Text>
        </View>
      )}

      <View style={styles.chain}>
        {steps.map((step, index) => (
          <React.Fragment key={step.eventId || step.label}>
            <Pressable
              onPress={() => onExplainStep?.(step)}
              style={({ hovered }: any) => [
                styles.stepColumn,
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                Platform.OS === 'web' && hovered && styles.stepHovered,
              ]}
            >
              <StepCircle status={step.status} />

              <Text
                style={[
                  styles.stepLabel,
                  { color: STATUS_COLORS[step.status] },
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>

              {step.provider && (
                <SourceBadge
                  source={step.provider as any}
                  lastSyncAt={step.timestamp ?? null}
                  confidence="none"
                  compact
                />
              )}

              {step.timestamp && (
                <Text style={styles.timestamp}>{formatTimestamp(step.timestamp)}</Text>
              )}

              {step.amount != null && (
                <Text style={styles.amount}>
                  ${step.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              )}
            </Pressable>

            {index < steps.length - 1 && (
              <ConnectorLine
                fromStatus={step.status}
                toStatus={steps[index + 1].status}
              />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surface.cardBorder,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleText: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
  },
  chain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing.sm,
  },
  stepColumn: {
    alignItems: 'center',
    gap: Spacing.xs,
    minWidth: 72,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  stepHovered: {
    backgroundColor: Colors.surface.cardHover,
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 8,
    height: CIRCLE_SIZE + 8,
    borderRadius: (CIRCLE_SIZE + 8) / 2,
    borderWidth: 2,
    borderColor: Colors.accent.cyanLight,
  },
  currentDots: {
    flexDirection: 'row',
    gap: 3,
  },
  currentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  stepLabel: {
    ...Typography.captionMedium,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  timestamp: {
    ...Typography.micro,
    color: Colors.text.muted,
    textAlign: 'center',
  },
  amount: {
    ...Typography.micro,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  connectorWrapper: {
    flex: 1,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    minWidth: 24,
  },
  connectorLine: {
    height: 2,
    flex: 1,
  },
});
