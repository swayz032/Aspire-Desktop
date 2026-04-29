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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  interpolate,
  Extrapolation,
  SlideInRight,
  SlideOutRight,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/tokens';
import { AnimatedDot } from './AnimatedDot';
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

/** Map raw artifact_type to a clean, user-friendly display name for the modal header. */
const DISPLAY_NAMES: Record<string, string> = {
  HotelShortlist: 'Hotels Found',
  PriceComparison: 'Price Results',
  VendorShortlist: 'Vendors',
  ProspectList: 'Prospects',
  CompetitorBrief: 'Competitors',
  EstimateResearchPack: 'Estimate Research',
  LandlordPropertyPack: 'Property Details',
  PropertyFactPack: 'Property Details',
  RentCompPack: 'Rental Comps',
  PermitContextPack: 'Permits & Renovation',
  NeighborhoodDemandBrief: 'Neighborhood Analysis',
  ScreeningComplianceBrief: 'Screening Compliance',
  InvestmentOpportunityPack: 'Investment Opportunities',
  GenericResearch: 'Research Results',
};

function displayName(artifactType: string): string {
  return DISPLAY_NAMES[artifactType] || 'Research Results';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResearchModalProps extends AvaPresentsState, AvaPresentsActions {}

// ─── Glow Color Helpers ──────────────────────────────────────────────────────

/** Convert hex color to rgba() string for CSS box-shadow */
function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// Section-specific glow colors for split property cards
const SECTION_GLOW: Record<string, string> = {
  overview: '#3B82F6',      // Blue
  ownership: '#A78BFA',     // Purple
  mortgage: '#10B981',      // Green
  valuation: '#F59E0B',     // Amber
  sale_history: '#EC4899',  // Pink
  rental: '#06B6D4',        // Cyan
  permits: '#F97316',       // Orange
  schools: '#6366F1',       // Indigo
  foreclosure: '#EF4444',   // Red
};

function getGlowColorForRecord(record: Record<string, unknown>, artifactType?: string): string {
  // Split property cards: glow matches section
  const cardSection = record._cardSection as string | undefined;
  if (cardSection && SECTION_GLOW[cardSection]) {
    return SECTION_GLOW[cardSection];
  }

  // Hotels use safety_score
  const raw = record.safety_score ?? record.score;
  const score = typeof raw === 'number' ? raw : null;
  if (score !== null) return tierToGlowColor(deriveTier(score));

  // Property/landlord types → blue glow
  const at = artifactType || '';
  if (at.includes('Property') || at.includes('Landlord') || at.includes('Rent') || at.includes('Permit') || at.includes('Neighborhood') || at.includes('Screening')) {
    return '#3B82F6';
  }
  if (at.includes('Investment')) return '#F59E0B';
  if (at.includes('Price') || at.includes('Estimate')) return '#06B6D4';
  if (at.includes('Vendor') || at.includes('Prospect') || at.includes('Competitor')) return '#A78BFA';

  return DEFAULT_GLOW_COLOR;
}

// ─── Web-only CSS for backdrop-filter + radial glow ──────────────────────────

function injectResearchModalStyles() {
  if (Platform.OS !== 'web') return;
  if (document.getElementById('ava-presents-styles')) return;
  const style = document.createElement('style');
  style.id = 'ava-presents-styles';
  style.textContent = `
    .ava-presents-backdrop {
      backdrop-filter: blur(28px) brightness(0.45);
      -webkit-backdrop-filter: blur(28px) brightness(0.45);
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
    /* Card hover lift on desktop */
    .ava-card {
      transition: transform 200ms ease, box-shadow 200ms ease;
    }
    .ava-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;
    }
    /* Nora-style card glow aura on active card — 3-layer box-shadow */
    .ava-card-glow {
      transition: box-shadow 600ms ease-out;
    }
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

  // Delayed unmount — keep rendering during exit animation
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      // Delay unmount until exit animation completes
      const timer = setTimeout(() => setMounted(false), BACKDROP_FADE_MS);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // ── Inject web styles once ──
  useEffect(() => { injectResearchModalStyles(); }, []);

  // ── Play open sound ──
  useEffect(() => { if (visible) playOpenSound(); }, [visible]);

  // ── Animation values ──
  const backdropOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.94);
  const modalOpacity = useSharedValue(0);
  const breathe = useSharedValue(0);

  // ── Derive glow color target from active record ──
  // Color transition on web is handled by CSS: transition: background 0.6s ease-out
  const activeGlowColor = useMemo(() => {
    if (!records.length) return DEFAULT_GLOW_COLOR;
    return getGlowColorForRecord(records[activeIndex] ?? {}, artifactType);
  }, [records, activeIndex, artifactType]);

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

  const glowBgColor = activeGlowColor;

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

  // ── Card renderer ──
  const CardComponent = useMemo(() => resolveCard(artifactType), [artifactType]);

  const handleCardAction = useCallback(
    (action: 'call' | 'visit' | 'book' | 'details' | 'tell_more', record: Record<string, unknown>) => {
      if (action === 'details') {
        openDetail(record);
      }
      // call/visit/book handled inside card components via Linking.openURL
    },
    [openDetail],
  );

  /**
   * Render a single card in the perspective carousel.
   * offset = index - activeIndex.
   *  -  0: active card on stage (full size, full opacity, no rotation, z=10)
   *  - ±1: side peek (scale 0.86, translateX ±70%, translateZ -90, rotateY ∓6deg, opacity 0.55)
   *  - |≥|2: hidden (opacity 0, pointerEvents none)
   */
  const renderPerspectiveCard = useCallback(
    (item: Record<string, unknown>, index: number) => {
      const offset = index - activeIndex;
      const absOffset = Math.abs(offset);
      const isCardActive = offset === 0;
      const isPeek = absOffset === 1;
      const isVisible = absOffset <= 1;

      const scale = isCardActive ? 1.0 : 0.86;
      // ±88% of card own-width keeps peeks visually clear of the active card so clicks
      // on the peek don't get intercepted by the active card's hit area at higher z.
      const translateXPercent = isCardActive ? 0 : offset * 88;
      const translateZ = isCardActive ? 0 : -90;
      const rotateY = isCardActive ? 0 : -offset * 6; // peek tilts toward stage
      const opacity = isCardActive ? 1 : isPeek ? 0.55 : 0;
      const zIndex = isCardActive ? 10 : isPeek ? 5 : 0;

      // Nora-style 3-layer box-shadow glow on active card (web only)
      const glowColor = isCardActive
        ? getGlowColorForRecord(item, artifactType)
        : undefined;

      const webTransformStyle: React.CSSProperties =
        Platform.OS === 'web'
          ? {
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: CARD_WIDTH,
              transform: `translate(-50%, -50%) translateX(${translateXPercent}%) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
              transformStyle: 'preserve-3d',
              transition: 'transform 0.58s cubic-bezier(0.34,1.12,0.64,1), opacity 0.4s ease, box-shadow 0.6s ease-out',
              opacity,
              zIndex,
              pointerEvents: isVisible ? 'auto' : 'none',
              cursor: isCardActive ? 'default' : isPeek ? 'pointer' : 'default',
              boxShadow:
                isCardActive && glowColor
                  ? `0 0 30px ${hexToRgba(glowColor, 0.35)}, 0 0 60px ${hexToRgba(glowColor, 0.15)}, 0 0 90px ${hexToRgba(glowColor, 0.05)}`
                  : undefined,
              borderRadius: BorderRadius.xl,
              overflow: 'hidden',
            }
          : {
              // Native fallback: stack cards centered, only active visible.
              opacity,
              zIndex,
              width: CARD_WIDTH,
            };

      const handlePeekPress = () => {
        playClickSound();
        goToCard(index);
      };

      const cardInner = (
        <CardComponent
          record={item}
          artifactType={artifactType}
          index={index}
          total={records.length}
          confidence={confidence}
          onAction={handleCardAction}
          isActive={isCardActive}
          enterDelay={isCardActive ? 0 : 80}
        />
      );

      if (isPeek) {
        return (
          <Pressable
            key={`card-${index}`}
            onPress={handlePeekPress}
            style={[styles.cardSlide, webTransformStyle as unknown as ViewStyle]}
            className="ava-card"
            // @ts-expect-error dataSet is valid web prop for data-* attributes
            dataSet={{ cardOffset: String(offset), cardActive: 'false' }}
            testID={`research-modal-card-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`Card ${index + 1}, tap to focus`}
          >
            {cardInner}
          </Pressable>
        );
      }

      return (
        <View
          key={`card-${index}`}
          style={[styles.cardSlide, webTransformStyle as unknown as ViewStyle]}
          className={isCardActive ? 'ava-card ava-card-glow' : 'ava-card'}
          // @ts-expect-error dataSet is valid web prop for data-* attributes
          dataSet={{ cardOffset: String(offset), cardActive: String(isCardActive) }}
          testID={`research-modal-card-${index}`}
          accessibilityLabel={isCardActive ? `Card ${index + 1} of ${records.length}, active` : undefined}
        >
          {cardInner}
        </View>
      );
    },
    [CardComponent, artifactType, records.length, confidence, activeIndex, handleCardAction, goToCard],
  );

  // ── Don't render if fully unmounted (after exit animation completes) ──
  if (!mounted) return null;

  const isFirstCard = activeIndex === 0;
  const isLastCard = activeIndex === records.length - 1;

  // ── Responsive glow orb sizing (Item 7) ──
  const glowSize = Math.min(screenW * 0.5, 600);

  // ── 3D carousel: perspective container (web-only inline CSS for true depth) ──
  const perspectiveContainerStyle: ViewStyle | undefined =
    Platform.OS === 'web'
      ? ({
          perspective: '1600px',
          transformStyle: 'preserve-3d',
          position: 'relative',
        } as unknown as ViewStyle)
      : undefined;

  return (
    <View style={styles.root} testID="research-modal" pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={detailMode ? closeDetail : dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close research results"
          className="ava-presents-backdrop"
        />
      </Animated.View>

      {/* Scrim — solid dark layer above the blur, below the carousel. Guarantees a clean
          dark stage on browsers that don't fully honor backdrop-filter brightness. */}
      <Animated.View
        style={[styles.scrim, backdropStyle]}
        pointerEvents="none"
        testID="research-modal-scrim"
      />

      {/* Subtle ambient tint — very dim, just for atmosphere. Main glow is on the card. */}
      <Animated.View
        style={[
          styles.glowOrb,
          {
            backgroundColor: glowBgColor,
            width: glowSize * 0.4,
            height: glowSize * 0.4,
            borderRadius: (glowSize * 0.4) / 2,
            opacity: 0.12,
          },
        ]}
        pointerEvents="none"
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
        
                className="ava-presents-back"
              >
                <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            {!detailMode ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summary} numberOfLines={2}>
                  {(records[activeIndex]?._sectionLabel as string) || displayName(artifactType)}
                </Text>
                {records.length > 1 && (
                  <View style={styles.resultCountBadge} accessibilityLabel={`${records.length} results`}>
                    <Text style={styles.resultCountText}>{records.length} results</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={() => { playClickSound(); dismiss(); }}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Dismiss research results"
    
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
              artifactType={artifactType}
              index={activeIndex}
              total={records.length}
              confidence={confidence}
              onAction={handleCardAction}
              isActive
            />
          </Animated.View>
        ) : (
          /* Level 1: 3D Perspective Carousel */
          <>
            <View
              style={[styles.carouselArea, perspectiveContainerStyle]}
              testID="research-modal-carousel"
            >
              {records.map((item, index) => renderPerspectiveCard(item, index))}

              {/* Nav Arrows */}
              {!isFirstCard && (
                <Pressable
                  onPress={() => { playClickSound(); prevCard(); }}
                  style={[styles.navArrow, styles.navArrowLeft]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous card"
                  testID="research-modal-prev"
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
                  testID="research-modal-next"
                  className="ava-presents-nav"
                >
                  <Ionicons name="chevron-forward" size={24} color={Colors.text.primary} />
                </Pressable>
              )}
            </View>

            {/* Pagination: Animated Dots + Counter */}
            <View style={styles.pagination}>
              <View style={styles.dots}>
                {records.map((_, i) => (
                  <AnimatedDot
                    key={i}
                    isActive={i === activeIndex}
                    onPress={() => goToCard(i)}
                    index={i}
                  />
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
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  glowOrb: {
    position: 'absolute',
    // Width, height, borderRadius set dynamically for responsive sizing
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  summary: {
    ...Typography.headline,
    color: Colors.text.primary,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  resultCountBadge: {
    backgroundColor: Colors.accent.cyanLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    flexShrink: 0,
  },
  resultCountText: {
    ...Typography.smallMedium,
    color: Colors.accent.cyan,
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
    alignItems: 'center',
  },
  cardSlide: {
    justifyContent: 'center',
    height: 580, // Match BaseCard's fixed height — wrapper does not push card vertically.
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
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
