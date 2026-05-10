/**
 * InsightCardBase — shared chrome for the four Visuals tab insight cards
 * (PropertyInsights · TotalBuildingArea · MaterialSignals · QuickCostInt).
 *
 * Provides:
 *   - Identical card silhouette (radius, border, bg) — flat Service Hub pattern.
 *   - Top row: icon tile (24×24 in rounded square) + title (12px uppercase
 *     letter-spaced).
 *   - Body slot (children).
 *   - Bottom CTA link with chevron.
 *   - Loading skeleton with sheen sweep — premium placeholder, never raw grey.
 *
 * Aspire Law #7: pure render — no fetches, no autonomous mutations.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface InsightCardBaseProps {
  icon: IoniconsName;
  title: string;
  ctaLabel?: string;
  ctaIcon?: IoniconsName;
  onCtaPress?: () => void;
  loading: boolean;
  children?: React.ReactNode;
  /** Optional accent color (icon tile + CTA hover). Default amber. */
  accent?: string;
  testID?: string;
}

export function InsightCardBase({
  icon,
  title,
  ctaLabel,
  ctaIcon = 'chevron-forward',
  onCtaPress,
  loading,
  children,
  accent = '#fbbf24',
  testID,
}: InsightCardBaseProps) {
  if (loading) {
    return <SkeletonInsightCard testID={testID ? `${testID}-skeleton` : undefined} />;
  }

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconTile,
            { backgroundColor: hexA(accent, 0.12), borderColor: hexA(accent, 0.22) },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name={icon} size={14} color={accent} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>

      <View style={styles.body}>{children}</View>

      {ctaLabel && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={ctaLabel}
          onPress={onCtaPress}
          style={({ hovered, pressed }: any) => [
            styles.cta,
            hovered && styles.ctaHover,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={[styles.ctaLabel, { color: accent }]} numberOfLines={1}>
            {ctaLabel}
          </Text>
          <Ionicons name={ctaIcon} size={12} color={accent} />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — sheen sweep, identical silhouette to loaded card.
// ---------------------------------------------------------------------------
export function SkeletonInsightCard({ testID }: { testID?: string }) {
  return (
    <View style={[styles.card, styles.cardSkeleton]} testID={testID}>
      <View style={styles.header}>
        <SheenBlock width={28} height={28} radius={8} />
        <SheenBlock width={120} height={11} radius={3} style={{ marginLeft: 10 }} />
      </View>
      <View style={styles.body}>
        <SheenBlock width="70%" height={14} radius={4} />
        <SheenBlock width="55%" height={12} radius={4} style={{ marginTop: 8 }} />
        <SheenBlock width="40%" height={12} radius={4} style={{ marginTop: 8 }} />
      </View>
      <SheenBlock width={90} height={12} radius={4} />
    </View>
  );
}

/**
 * SheenBlock — a single skeleton block with a left-to-right sheen sweep.
 *
 * Implementation:
 *   - Web: CSS `linear-gradient` background animated via translateX so the
 *     sheen reads as a moving highlight on top of a base grey.
 *   - Native: Animated.View with translateX for an overlay highlight bar.
 */
export function SheenBlock({
  width,
  height,
  radius = 6,
  style,
}: {
  width: number | `${number}%` | '100%';
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const translate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translate, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [translate]);

  if (Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            width: width as any,
            height,
            borderRadius: radius,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
          style,
        ]}
      >
        <View
          style={
            ({
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.06) 55%, rgba(255,255,255,0) 100%)',
              backgroundSize: '200% 100%',
              animation: 'aspire-sheen-sweep 1.8s linear infinite',
            } as unknown) as ViewStyle
          }
        />
      </View>
    );
  }

  const opacity = translate.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.04, 0.10, 0.04],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: 'rgba(255,255,255,0.04)',
          opacity,
        },
        style,
      ]}
    />
  );
}

// Inject the @keyframes once on web so SheenBlock can reference it.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const id = 'aspire-sheen-sweep-keyframes';
  if (!document.getElementById(id)) {
    const tag = document.createElement('style');
    tag.id = id;
    tag.textContent = `
@keyframes aspire-sheen-sweep {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;
    document.head.appendChild(tag);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function hexA(hex: string, alpha: number): string {
  // Accept #RRGGBB or rgb()/rgba() — only meaningful path is hex.
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 220,
    minHeight: 176,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardSkeleton: {
    backgroundColor: 'rgba(255,255,255,0.015)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    alignSelf: 'flex-start',
  },
  ctaHover: {
    opacity: 0.85,
  },
  ctaPressed: {
    opacity: 0.7,
  },
  ctaLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
