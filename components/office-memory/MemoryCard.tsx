/**
 * MemoryCard — the premium 3D-floating tile that represents a single memory.
 *
 * Visual contract per plan §8.2 (mockup-fidelity, no deviation):
 *   ┌───────────────────────────────────────────┐
 *   │  [LED gradient header — 132px]   [bookmark│   ← image asset + LinearGradient blend
 *   ├───────────────────────────────────────────┤
 *   │  Title (17/600, 2-line clamp)              │
 *   │  Summary (14/400, 3-line clamp)            │
 *   │                                            │
 *   │  [TYPE]   [📅 Date]   [🏢 Entity]          │   ← 3 pills, gap 8
 *   └───────────────────────────────────────────┘
 *
 * Wrapped in `<MemoryCardGlowHalo>` for the Aspire-blue ambient halo.
 *
 * Interactions:
 *   - Web hover: card lifts -2px (CSS class `.aspire-memory-card`),
 *     halo intensity bumps to 'strong' via state.
 *   - Native press: scale 0.98 via Animated.
 *   - Bookmark: separate Pressable inside header, prevents card press from
 *     firing when bookmark is tapped.
 *
 * `compact` prop: list-mode rendering with smaller header (88px), 1-line
 * summary, and inline pills. Keeps card identity but trims for density.
 *
 * Self-critique trail (per §12.1): the gradient header is the personality;
 * the bookmark must feel like a one-tap action; the pill row must read as
 * "tagged metadata" not "buttons." Each pill carries a tiny icon for optical
 * weight and the type pill alone gets a colored background.
 */

import React, { useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/tokens';
import type { MemorySummary } from './types';
import { MEMORY_TYPE_COLORS } from './types';
import { MemoryCardGlowHalo } from './MemoryCardGlowHalo';
import { injectMemoryKeyframes } from './cardAnimations';

// Lazy keyframe injection — covered first time any MemoryCard mounts on web
injectMemoryKeyframes();

export interface MemoryCardProps {
  memory: MemorySummary;
  onPress?: () => void;
  onBookmarkToggle?: () => void;
  /** Compact list-mode variant (height 120 vs 380) */
  compact?: boolean;
}

// ─── Date helper ─────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemoryCard({
  memory,
  onPress,
  onBookmarkToggle,
  compact = false,
}: MemoryCardProps) {
  const [hovered, setHovered] = useState(false);
  const pressAnim = React.useRef(new Animated.Value(1)).current;

  const typeStyle = MEMORY_TYPE_COLORS[memory.type];
  const dateLabel = formatDate(memory.date);

  const handlePressIn = () => {
    if (Platform.OS === 'web') return;
    Animated.spring(pressAnim, {
      toValue: 0.98,
      damping: 18,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (Platform.OS === 'web') return;
    Animated.spring(pressAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  const haloIntensity = hovered ? 'strong' : 'normal';
  const headerHeight = compact ? 88 : 132;

  // Press wrapper — uses Pressable, but on web also renders the className
  // so CSS `:hover` lift can engage without re-renders.
  const cardBody = (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        Platform.OS === 'web'
          ? ({} as ViewStyle)
          : {
              shadowColor: '#000',
              shadowOpacity: 0.5,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 6,
            },
      ]}
    >
      {/* Header — gradient image (top crop) + linear-gradient blend.
          The asset is the full mockup card; we crop to ~38% from top so
          only the LED gradient region renders. The header's overflow:hidden
          + image height = 100%/0.38 keeps the gradient sharp without stretching. */}
      <View style={[styles.header, { height: headerHeight }]}>
        <Image
          source={require('@/assets/images/memory-card-gradient.png')}
          style={styles.headerImage}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        {/* Soft fade-to-card-color blend at the bottom edge of the gradient */}
        <LinearGradient
          colors={['transparent', 'transparent', Colors.memory.cardBg]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill as ViewStyle}
          pointerEvents="none"
        />

        {/* Bookmark — small floating glassy button */}
        <Pressable
          onPress={(e) => {
            // Stop event from bubbling to card press (web)
            if (Platform.OS === 'web' && (e as any).stopPropagation) {
              (e as any).stopPropagation();
            }
            onBookmarkToggle?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={memory.bookmarked ? 'Remove bookmark' : 'Bookmark memory'}
          hitSlop={8}
          style={({ pressed }) => [
            styles.bookmark,
            pressed && styles.bookmarkPressed,
          ]}
          {...(Platform.OS === 'web'
            ? ({ className: 'aspire-memory-bookmark' } as any)
            : {})}
        >
          <Ionicons
            name={memory.bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={18}
            color={memory.bookmarked ? Colors.accent.cyan : Colors.text.primary}
          />
        </Pressable>
      </View>

      {/* Body */}
      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text
          style={styles.title}
          numberOfLines={2}
          accessibilityRole="header"
        >
          {memory.title}
        </Text>

        <Text
          style={[styles.summary, compact && styles.summaryCompact]}
          numberOfLines={compact ? 1 : 3}
        >
          {memory.summary}
        </Text>

        {/* Pill row — type / date / entity */}
        <View style={styles.pillRow}>
          {/* Type pill — colored per MEMORY_TYPE_COLORS */}
          <View
            style={[
              styles.pillBase,
              { backgroundColor: typeStyle.tintBg },
            ]}
          >
            <Text style={[styles.pillText, { color: typeStyle.tintFg }]}>
              {typeStyle.label}
            </Text>
          </View>

          {/* Date pill — neutral with calendar icon */}
          <View style={[styles.pillBase, styles.pillNeutral]}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={Colors.text.secondary}
              style={styles.pillIcon}
            />
            <Text style={[styles.pillText, styles.pillTextNeutral]}>
              {dateLabel}
            </Text>
          </View>

          {/* Entity pill — only if entity is set */}
          {memory.entity && (
            <View style={[styles.pillBase, styles.pillNeutral]}>
              <Ionicons
                name="business-outline"
                size={12}
                color={Colors.text.secondary}
                style={styles.pillIcon}
              />
              <Text
                style={[styles.pillText, styles.pillTextNeutral]}
                numberOfLines={1}
              >
                {memory.entity.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // Press wrapper — Animated for native scale, className for web hover
  return (
    <MemoryCardGlowHalo intensity={haloIntensity}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        accessibilityRole="button"
        accessibilityLabel={`${typeStyle.label}: ${memory.title}`}
        style={styles.pressable}
        {...(Platform.OS === 'web'
          ? ({ className: 'aspire-memory-card' } as any)
          : {})}
      >
        <Animated.View
          style={{
            transform: [{ scale: pressAnim }],
            borderRadius: 16,
          }}
        >
          {cardBody}
        </Animated.View>
      </Pressable>
    </MemoryCardGlowHalo>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_HEIGHT = 380;
const CARD_HEIGHT_COMPACT = 120;

const styles = StyleSheet.create({
  pressable: {
    width: '100%' as unknown as number,
    borderRadius: 16,
    // Web: outline removed — focus indicator is the halo intensity
    ...(Platform.OS === 'web'
      ? ({ outlineWidth: 0, outlineStyle: 'none', cursor: 'pointer' } as unknown as ViewStyle)
      : {}),
  },
  card: {
    height: CARD_HEIGHT,
    backgroundColor: Colors.memory.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    // Inset highlight — the "carved from glass" feel on web
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' } as unknown as ViewStyle)
      : {}),
  },
  cardCompact: {
    height: CARD_HEIGHT_COMPACT,
    flexDirection: 'row',
  },
  header: {
    width: '100%' as unknown as number,
    backgroundColor: '#1a1a1f',
    position: 'relative',
    overflow: 'hidden',
  },
  headerImage: {
    // Image is anchored to the top so only the LED gradient region (top ~38%
    // of the source asset) remains visible inside the 132px header crop.
    // We scale the image height larger than the container so the source's
    // own card body falls below the visible window.
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%' as unknown as number,
    // ~2.6x the 132px header height = enough vertical space for the gradient
    // band to be the only visible region. Scales naturally on different
    // card widths because objectFit:cover (resizeMode='cover') preserves aspect.
    height: 350,
    opacity: 0.95,
  },
  bookmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(8px)' } as unknown as ViewStyle)
      : {}),
  },
  bookmarkPressed: {
    transform: [{ scale: 0.92 }],
  },
  body: {
    flex: 1,
    padding: 16,
  },
  bodyCompact: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  summary: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.secondary,
    lineHeight: 20,
    marginTop: 8,
  },
  summaryCompact: {
    marginTop: 4,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  pillBase: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    maxWidth: '100%' as unknown as number,
  },
  pillNeutral: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pillIcon: {
    marginRight: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  pillTextNeutral: {
    color: Colors.text.secondary,
    fontWeight: '500',
  },
});

export default MemoryCard;
