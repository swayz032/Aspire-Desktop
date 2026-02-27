import React, { useRef, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Colors, Typography, Shadows } from '@/constants/tokens';
import { getStepIndex, type RunwayState } from '@/lib/runwayMachine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RunwayDisplayProps {
  currentState: RunwayState;
}

// ---------------------------------------------------------------------------
// Step definitions — 5 visual pipeline stages
// ---------------------------------------------------------------------------

interface StepDef {
  label: string;
  index: number; // maps to getStepIndex range
}

const STEPS: StepDef[] = [
  { label: 'Preflight', index: 1 },
  { label: 'Draft', index: 3 },
  { label: 'Authority', index: 4 },
  { label: 'Execute', index: 6 },
  { label: 'Receipt', index: 7 },
];

type StepStatus = 'complete' | 'active' | 'pending' | 'error';

function getStepStatus(stepDef: StepDef, runwayState: RunwayState): StepStatus {
  const current = getStepIndex(runwayState);

  // Error states
  if (current === -1) {
    // Steps before the error point are complete, the rest are error
    // For simplicity, mark all as error when in error state
    return 'error';
  }

  if (current > stepDef.index) return 'complete';
  if (current === stepDef.index) return 'active';
  // For draft states that span a range (index 2-3), check if we're in range
  if (stepDef.index === 3 && (current === 2 || current === 3)) return 'active';
  if (stepDef.index === 4 && (current === 4 || current === 5)) return 'active';
  return 'pending';
}

function getStepColor(status: StepStatus): string {
  switch (status) {
    case 'complete': return Canvas.runway.completeColor;
    case 'active': return Canvas.runway.activeColor;
    case 'error': return Canvas.runway.errorColor;
    case 'pending': return Canvas.runway.pendingColor;
  }
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function StepCircle({ status, staggerDelay }: { status: StepStatus; staggerDelay: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Staggered entrance
  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      delay: staggerDelay,
      damping: Canvas.motion.spring.damping,
      stiffness: Canvas.motion.spring.stiffness,
      mass: Canvas.motion.spring.mass,
      useNativeDriver: true,
    }).start();
  }, [scale, staggerDelay]);

  // Pulse animation for active step
  useEffect(() => {
    if (status !== 'active') {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulseAnim]);

  const color = getStepColor(status);
  const size = Canvas.runway.stepSize;

  return (
    <Animated.View
      style={[
        styles.stepCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale: Animated.multiply(scale, pulseAnim) }],
        },
        status === 'complete' && { backgroundColor: color },
        status === 'active' && [
          { backgroundColor: color },
          Shadows.glow(color),
        ],
        status === 'pending' && {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: color,
        },
        status === 'error' && { backgroundColor: color },
      ]}
      accessibilityLabel={`Step ${status}`}
    >
      {status === 'complete' && (
        <Ionicons name="checkmark" size={14} color={Colors.background.primary} />
      )}
      {status === 'active' && (
        <View style={[styles.activeDot, { backgroundColor: Colors.background.primary }]} />
      )}
      {status === 'error' && (
        <Ionicons name="close" size={14} color={Colors.background.primary} />
      )}
    </Animated.View>
  );
}

function Connector({ filled, staggerDelay }: { filled: boolean; staggerDelay: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: filled ? 1 : 0,
      duration: Canvas.motion.runwayStep,
      delay: staggerDelay,
      useNativeDriver: false, // width animation can't use native driver
    }).start();
  }, [filled, widthAnim, staggerDelay]);

  return (
    <View style={styles.connectorTrack}>
      <Animated.View
        style={[
          styles.connectorFill,
          {
            width: widthAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }) as unknown as number,
            backgroundColor: Canvas.runway.completeColor,
          },
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RunwayDisplay({ currentState }: RunwayDisplayProps): React.ReactElement {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={`Execution pipeline: ${currentState}`}
    >
      {STEPS.map((step, idx) => {
        const status = getStepStatus(step, currentState);
        const stagger = idx * Canvas.motion.stagger;
        const showConnector = idx < STEPS.length - 1;
        const nextStatus = idx < STEPS.length - 1
          ? getStepStatus(STEPS[idx + 1], currentState)
          : 'pending';
        const connectorFilled = status === 'complete';

        return (
          <React.Fragment key={step.label}>
            <View style={styles.stepWrapper}>
              <StepCircle status={status} staggerDelay={stagger} />
              <Text
                style={[
                  styles.stepLabel,
                  { color: getStepColor(status) },
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
            {showConnector && (
              <Connector filled={connectorFilled} staggerDelay={stagger + 25} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  stepWrapper: {
    alignItems: 'center',
    width: Canvas.runway.stepSize + 16,
  },
  stepCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    fontSize: Typography.micro.fontSize,
    fontWeight: Typography.micro.fontWeight,
    lineHeight: Typography.micro.lineHeight,
    marginTop: 6,
    textAlign: 'center',
  },
  connectorTrack: {
    height: Canvas.runway.connectorHeight,
    flex: 1,
    backgroundColor: Canvas.runway.pendingColor,
    borderRadius: 1,
    marginTop: Canvas.runway.stepSize / 2 - 1,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  connectorFill: {
    height: '100%',
    borderRadius: 1,
  },
});
