/**
 * ThinkingIndicator -- Shared "thinking" state display for all agent chat panels.
 *
 * Replaces duplicated ThinkingDots implementations in:
 *   - AvaDeskPanel (~lines 179-206)
 *   - FinnDeskPanel (~lines 247-274)
 *   - EliVoiceChatPanel (inline ShimmeringText usage)
 *
 * On web: Uses ShimmeringText with agent-colored shimmer.
 * On native: Animated dots fallback (3 pulsing circles).
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/tokens';
import { ShimmeringText } from '@/components/ui/ShimmeringText';
import type { AgentId } from './types';
import { AGENT_COLORS } from './types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThinkingIndicatorProps {
  /** Agent identity for accent-colored shimmer. */
  agent?: AgentId;
  /** Display text (default: "Thinking..."). */
  text?: string;
  /** Additional container style. */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Native Fallback: Animated Dots
// ---------------------------------------------------------------------------

function AnimatedDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: false,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dotsRow} accessibilityLabel="Loading" accessibilityRole="none">
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: dot1 }]}
      />
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: dot2 }]}
      />
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity: dot3 }]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const ThinkingIndicator = React.memo(function ThinkingIndicator({
  agent,
  text = 'Thinking...',
  style,
}: ThinkingIndicatorProps) {
  const agentColor = agent ? AGENT_COLORS[agent] : Colors.accent.cyan;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="none"
      accessibilityLabel={text}
    >
      {Platform.OS === 'web' ? (
        <ShimmeringText
          text={text}
          duration={1.8}
          color={Colors.text.muted}
          shimmerColor={agentColor}
          style={{ fontSize: 13, fontWeight: '500' }}
        />
      ) : (
        <View style={styles.nativeRow}>
          <Text style={styles.nativeText}>{text}</Text>
          <AnimatedDots color={agentColor} />
        </View>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nativeText: {
    ...Typography.small,
    color: Colors.text.muted,
    fontStyle: 'italic',
  },
});
