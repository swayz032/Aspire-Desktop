/**
 * ResearchModal -- Full-page overlay for Ava Presents research results.
 *
 * Visual signature: Ambient radial glow behind the active card that breathes
 * slowly (3-4s pulse) and shifts color based on the card's SafetyBadge tier:
 *   - Blue (#3B82F6)  -- default / neutral
 *   - Green (#10B981) -- "Recommended" (verified, score >= 7.5)
 *   - Amber (#F59E0B) -- "Use Caution" (partial, score 3.5-7.4)
 *   - Red (#EF4444)   -- "Not Recommended" (unverified, score < 3.5)
 *
 * Two-level navigation:
 *   Level 1: Horizontal FlatList with snap pagination (summary cards)
 *   Level 2: Tap "Details" pushes into full dossier; "Back" returns
 *
 * Renders at ROOT level (overlays entire dashboard including sidebar).
 * Matches the Aspire "Command Center Glass" aesthetic.
 */

import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Platform,
  useWindowDimensions,
  type ViewStyle,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  runOnJS,
  useAnimatedReaction,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animation } from '@/constants/tokens';
import { playOpenSound, playClickSound } from '@/lib/sounds';
import { resolveCard, type CardProps } from './CardRegistry';
import { deriveTier, tierToGlowColor, type SafetyTier } from './SafetyBadge';
import type { AvaPresentsState, AvaPresentsActions } from '@/hooks/useAvaPresents';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_GLOW_COLOR = '#3B82F6';
const GLOW_BREATH_DURATION = 3500; // 3.5s full cycle
const BACKDROP_FADE_MS = 220;
const MODAL_SPRING = { damping: 22, stiffness: 260, mass: 0.9 };
const CARD_WIDTH = 500;
const CARD_GAP = 24;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResearchModalProps extends AvaPresentsState, AvaPresentsActions {}

// ─── Glow Color Helpers ──────────────────────────────────────────────────────

function getGlowColorForRecord(record: Record<string, unknown>): string {
  const score = typeof record.score === 'number' ? record.score : null;
  if (score === null) return DEFAULT_GLOW_COLOR;
  return tierToGlowColor(deriveTier(score));
}

// ─── Web-only CSS for backdrop-filter + radial glow ──────────────────────────

function injectResearchModalStyles() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('ava-presents-styles')) return;
  const style = document.createElement('style');
  style.id = 'ava-presents-styles';
  style.textContent = `
    .ava-presents-backdrop {
      backdrop-filter: blur(24px) saturate(1.4);
      -webkit-backdrop-filter: blur(24px) saturate(1.4);
    }
    .ava-presents-glow {
      transition: background 0.6s ease-out;
      pointer-events: none;
    }
    .ava-presents-close:hover {
      background-color: rgba(255,255,255,0.12) !important;
      transform: scale(1.08);
    }
    .ava-presents-close:active { transform: scale(0.94); }
    .ava-presents-nav:hover {
      background-color: rgba(255,255,255,0.1) !important;
    }
    .ava-presents-nav:active { transform: scale(0.92); }
    .ava-presents-dot:hover { opacity: 1 !important; }
    .ava-presents-back:hover {
      background-color: rgba(255,255,255,0.08) !important;
    }
    /* Hide scrollbar on the card list */
    .ava-presents-list::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(style);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResearchModal(props: ResearchModalProps) {
  const {
    visible,
    artifactType,
    records,
    summary,
    confidence,
    activeIndex,
    detailMode,
    detailRecord,
    dismiss,
    nextCard,
    prevCard,
    goToCard,
    openDetail,
    closeDetail,
  } = props;

  const { width: screenW, height: screenH } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);

  // ── Inject web styles once ──
  useEffect(() => { injectResearchModalStyles(); }, []);

  // ── Play open sound ──
  useEffect(() => { if (visible) playOpenSound(); }, [visible]);

  // ── Animation values ──
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.94);
  const modalOpacity = useSharedValue(0);
  const breathe = useSharedValue(0);

  // Glow color index: 0 = blue, 1 = green, 2 = amber, 3 = red
  const glowColorProgress = useSharedValue(0);

  // ── Derive glow color target from active record ──
  const activeGlowColor = useMemo(() => {
    if (!records.length) return DEFAULT_GLOW_COLOR;
    return getGlowColorForRecord(records[activeIndex] ?? {});
  }, [records, activeIndex]);

  // Map color hex to index for interpolation
  const COLOR_MAP: Record<string, number> = {
    '#3B82F6': 0,
    '#10B981': 1,
    '#F59E0B': 2,
    '#EF4444': 3,
  };

  useEffect(() => {
    const target = COLOR_MAP[activeGlowColor] ?? 0;
    glowColorProgress.value = withTiming(target, { duration: 600 });
  }, [activeGlowColor]);

  // ── Entry / exit animations ──
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: BACKDROP_FADE_MS });
      modalScale.value = withSpring(1, MODAL_SPRING);
      modalOpacity.value = withTiming(1, { duration: 200 });
      // Start glow breathing loop
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, { duration: GLOW_BREATH_DURATION / 2 }),
          withTiming(0, { duration: GLOW_BREATH_DURATION / 2 }),
        ),
        -1, // infinite
        true,
      );
    } else {
      backdropOpacity.value = withTiming(0, { duration: 160 });
      modalScale.value = withTiming(0.94, { duration: 140 });
      modalOpacity.value = withTiming(0, { duration: 140 });
    }
  }, [visible]);

  // ── Scroll FlatList when activeIndex changes ──
  useEffect(() => {
    if (flatListRef.current && !detailMode) {
      flatListRef.current.scrollToOffset({
        offset: activeIndex * (CARD_WIDTH + CARD_GAP),
        animated: true,
      });
    }
  }, [activeIndex, detailMode]);

  // ── Animated styles ──
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const modalContainerStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(breathe.value, [0, 1], [0.25, 0.55], Extrapolation.CLAMP);
    const scale = interpolate(breathe.value, [0, 1], [0.85, 1.15], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  // ── Derived glow color for web radial gradient ──
  const glowBgColor = useMemo(() => activeGlowColor, [activeGlowColor]);

  // ── Keyboard handler ──
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailMode) closeDetail();
        else dismiss();
      } else if (e.key === 'ArrowRight' && !detailMode) {
        nextCard();
      } else if (e.key === 'ArrowLeft' && !detailMode) {
        prevCard();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, detailMode, dismiss, closeDetail, nextCard, prevCard]);

  // ── Snapshot handler ──
  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const newIndex = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
      if (newIndex !== activeIndex && newIndex >= 0 && newIndex < records.length) {
        goToCard(newIndex);
      }
    },
    [activeIndex, records.length, goToCard],
  );

  // ── Card renderer ──
  const CardComponent = useMemo(() => resolveCard(artifactType), [artifactType]);

  const renderCard = useCallback(
    ({ item, index }: ListRenderItemInfo<Record<string, unknown>>) => (
      <View style={[styles.cardSlide, { width: CARD_WIDTH }]}>
        <CardComponent
          record={item}
          index={index}
          total={records.length}
          onOpenDetail={openDetail}
        />
      </View>
    ),
    [CardComponent, records.length, openDetail],
  );

  const keyExtractor = useCallback(
    (_item: Record<string, unknown>, index: number) => `card-${index}`,
    [],
  );

  // ── Don't render if not visible ──
  if (!visible) return null;

  const isFirstCard = activeIndex === 0;
  const isLastCard = activeIndex === records.length - 1;

  // ── Compute content padding to center the card list ──
  const listPaddingH = Math.max(0, (screenW - CARD_WIDTH) / 2);

  return (
    <View style={styles.root} testID="research-modal">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={detailMode ? closeDetail : dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close research results"
          // @ts-expect-error -- web className for backdrop-filter
          className="ava-presents-backdrop"
        />
      </Animated.View>

      {/* Ambient Glow */}
      <Animated.View
        style={[styles.glowOrb, glowStyle, { backgroundColor: glowBgColor }]}
        pointerEvents="none"
        // @ts-expect-error -- web className
        className="ava-presents-glow"
      />

      {/* Modal Content */}
      <Animated.View style={[styles.modalContainer, modalContainerStyle]}>
        {/* Header: Summary + Close */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {detailMode && (
              <Pressable
                onPress={() => { playClickSound(); closeDetail(); }}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Back to card list"
                // @ts-expect-error -- web className
                className="ava-presents-back"
              >
                <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            {!detailMode && summary ? (
              <Text style={styles.summary} numberOfLines={2}>{summary}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => { playClickSound(); dismiss(); }}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Dismiss research results"
            // @ts-expect-error -- web className
            className="ava-presents-close"
          >
            <Ionicons name="close" size={22} color={Colors.text.secondary} />
          </Pressable>
        </View>

        {/* Level 2: Detail View */}
        {detailMode && detailRecord ? (
          <Animated.View
            entering={SlideInRight.duration(200)}
            exiting={SlideOutRight.duration(160)}
            style={styles.detailContainer}
          >
            <CardComponent
              record={detailRecord}
              index={activeIndex}
              total={records.length}
            />
          </Animated.View>
        ) : (
          /* Level 1: Card Carousel */
          <>
            <View style={styles.carouselArea}>
              <FlatList
                ref={flatListRef}
                data={records}
                renderItem={renderCard}
                keyExtractor={keyExtractor}
                horizontal
                pagingEnabled={false}
                snapToInterval={CARD_WIDTH + CARD_GAP}
                snapToAlignment="center"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                contentContainerStyle={{
                  paddingHorizontal: listPaddingH,
                  gap: CARD_GAP,
                  alignItems: 'center',
                }}
                style={styles.flatList}
                // @ts-expect-error -- web className
                className="ava-presents-list"
              />

              {/* Nav Arrows */}
              {!isFirstCard && (
                <Pressable
                  onPress={() => { playClickSound(); prevCard(); }}
                  style={[styles.navArrow, styles.navArrowLeft]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous card"
                  // @ts-expect-error -- web className
                  className="ava-presents-nav"
                >
                  <Ionicons name="chevron-back" size={24} color={Colors.text.primary} />
                </Pressable>
              )}
              {!isLastCard && (
                <Pressable
                  onPress={() => { playClickSound(); nextCard(); }}
                  style={[styles.navArrow, styles.navArrowRight]}
                  accessibilityRole="button"
                  accessibilityLabel="Next card"
                  // @ts-expect-error -- web className
                  className="ava-presents-nav"
                >
                  <Ionicons name="chevron-forward" size={24} color={Colors.text.primary} />
                </Pressable>
              )}
            </View>

            {/* Pagination: Dots + Counter */}
            <View style={styles.pagination}>
              <View style={styles.dots}>
                {records.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => goToCard(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Go to card ${i + 1}`}
                    // @ts-expect-error -- web className
                    className="ava-presents-dot"
                  >
                    <View
                      style={[
                        styles.dot,
                        i === activeIndex ? styles.dotActive : styles.dotInactive,
                      ]}
                    />
                  </Pressable>
                ))}
              </View>
              <Text style={styles.counter}>
                {activeIndex + 1} of {records.length}
              </Text>
            </View>
          </>
        )}

        {/* Confidence footer (when available) */}
        {confidence && !detailMode && (
          <View style={styles.confidenceBar}>
            <Ionicons
              name={confidence.status === 'verified' ? 'shield-checkmark' : 'alert-circle'}
              size={14}
              color={confidence.status === 'verified' ? '#10B981' : Colors.text.muted}
            />
            <Text style={styles.confidenceText}>
              {confidence.status === 'verified' ? 'Verified' : 'Partially verified'} research
              {confidence.score > 0 ? ` \u00B7 ${(confidence.score * 100).toFixed(0)}% confidence` : ''}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background.overlay,
  },
  glowOrb: {
    position: 'absolute',
    width: 480,
    height: 480,
    borderRadius: 240,
    alignSelf: 'center',
    // Web blur for the radial glow effect
    ...(Platform.OS === 'web'
      ? { filter: 'blur(120px)' } as unknown as ViewStyle
      : {}),
  },
  modalContainer: {
    flex: 1,
    width: '100%' as unknown as number,
    maxWidth: 1200,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
    minHeight: 48,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  summary: {
    ...Typography.headline,
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  backText: {
    ...Typography.captionMedium,
    color: Colors.text.secondary,
  },

  // Carousel
  carouselArea: {
    flex: 1,
    justifyContent: 'center',
  },
  flatList: {
    flexGrow: 0,
  },
  cardSlide: {
    justifyContent: 'center',
  },

  // Nav arrows
  navArrow: {
    position: 'absolute',
    top: '50%' as unknown as number,
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  navArrowLeft: {
    left: Spacing.lg,
  },
  navArrowRight: {
    right: Spacing.lg,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: Colors.text.primary,
  },
  dotInactive: {
    backgroundColor: Colors.text.muted,
    opacity: 0.4,
  },
  counter: {
    ...Typography.small,
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },

  // Detail mode
  detailContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Confidence bar
  confidenceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  confidenceText: {
    ...Typography.small,
    color: Colors.text.muted,
  },
});
