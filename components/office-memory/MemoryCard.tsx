/**
 * MemoryCard — the premium 3D-floating tile that represents a single memory.
 *
 * Visual contract per plan §19 Pass 13.E (post-walkthrough redesign):
 *   ┌───────────────────────────────────────────┐
 *   │  Title (17/600, 2-line clamp)   [bookmark]│   ← flat-black surface
 *   │  Summary (14/400, 3-line clamp)            │
 *   │                                            │
 *   │  [TYPE]   [📅 Date]   [🏢 Entity]          │   ← 3 pills, gap 8
 *   └───────────────────────────────────────────┘
 *
 * Surface: flat black (#0c0c10), 1px hairline border (rgba(255,255,255,0.06)),
 * 14px radius. NO LED gradient header asset — that read as "loud". The personality
 * comes from the always-on subtle Aspire-blue glow + intensify on hover.
 *
 * Glow:
 *   - Web: CSS `.aspire-memory-card` in cardAnimations.ts — always-on
 *     `box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 0 14px 0 rgba(59,130,246,0.12)`.
 *     Hover bumps to `0.45 / 0.30` and lifts -2px.
 *   - Native: shadow stack on the card View — opacity 0.18 idle, 0.32 hover,
 *     plus inner ring border opacity 0.20 idle, 0.40 hover.
 *
 * Interactions:
 *   - Web hover: lift -2px + glow intensifies.
 *   - Native press: scale 0.98 via Animated spring.
 *   - Bookmark: floating Pressable top-right, stops event bubbling.
 *
 * `compact` prop: list-mode rendering with smaller height (96px), 1-line
 * summary, and inline pills. Same surface treatment.
 */

import React, { useState } from 'react';
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
import { Colors } from '@/constants/tokens';
import type { MemorySummary } from './types';
import { MEMORY_TYPE_COLORS } from './types';
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

  // Native-side shadow stack — always-on subtle blue glow + intensify on hover.
  // On web, the glow lives entirely in the .aspire-memory-card CSS class
  // (cardAnimations.ts) so :hover transitions feel fluid without re-renders.
  const nativeShadowStyle =
    Platform.OS === 'web'
      ? null
      : {
          shadowColor: '#3B82F6',
          shadowOpacity: hovered ? 0.32 : 0.18,
          shadowRadius: hovered ? 14 : 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: hovered ? 6 : 4,
          borderColor: hovered ? 'rgba(59,130,246,0.40)' : 'rgba(59,130,246,0.20)',
        };

  // Press wrapper — uses Pressable, but on web also renders the className
  // so CSS `:hover` glow + lift can engage without re-renders.
  const cardBody = (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        nativeShadowStyle as any,
      ]}
    >
      {/* Bookmark — small floating glassy button, top-right of the card */}
      <Pressable
        onPress={(e) => {
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

  // Glow now lives directly on the card surface (web: CSS .aspire-memory-card;
  // native: shadow stack on the card View). No more MemoryCardGlowHalo wrapper —
  // it was making the glow read as "loud" per user feedback.
  return (
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
          borderRadius: 14,
        }}
      >
        {cardBody}
      </Animated.View>
    </Pressable>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
//
// Card surface: flat black + 1px hairline + always-on subtle blue glow.
// Glow is in the CSS class for web (cardAnimations.ts) and in the View's
// native shadow stack for iOS/Android (set inline above based on hovered).

const CARD_HEIGHT = 220;
const CARD_HEIGHT_COMPACT = 96;

const styles = StyleSheet.create({
  pressable: {
    width: '100%' as unknown as number,
    borderRadius: 14,
    // Web: outline removed — focus indicator is the glow intensity
    ...(Platform.OS === 'web'
      ? ({ outlineWidth: 0, outlineStyle: 'none', cursor: 'pointer' } as unknown as ViewStyle)
      : {}),
  },
  card: {
    height: CARD_HEIGHT,
    backgroundColor: '#0c0c10',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardCompact: {
    height: CARD_HEIGHT_COMPACT,
    flexDirection: 'row',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(6px)' } as unknown as ViewStyle)
      : {}),
  },
  bookmarkPressed: {
    transform: [{ scale: 0.92 }],
  },
  body: {
    flex: 1,
    padding: 18,
    paddingRight: 56, // leave room for the bookmark icon
  },
  bodyCompact: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    paddingRight: 56,
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
