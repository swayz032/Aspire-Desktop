/**
 * MemoryResultsGrid — 3×3 grid of `MemoryCard` (web), responsive FlatList
 * (native), with shimmering skeletons, an orb-anchored empty state, and a
 * compact pagination footer.
 *
 * 9 cards per page is locked (plan §13 + types.ts MEMORY_PAGE_SIZE).
 *
 * Stagger entrance: Reanimated FadeInUp delayed per card index by
 * `Motion.gridStagger.interval` (60ms). A new entrance choreography fires
 * whenever the page or viewMode changes — handled by remounting via a
 * `key` derived from `${page}-${viewMode}`.
 *
 * Loading skeleton: 9 placeholder cards matching final card dimensions
 * (height ~380px, gradient header band ~132px). Native uses a fixed-size
 * fallback view; web uses CSS keyframes for shimmer to avoid Reanimated
 * loops on placeholder content.
 *
 * Empty state: muted AvaOrb (size 120) + a single line of body copy. No
 * sad text dump per plan §13.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Dimensions,
  Pressable,
  Animated,
  Easing,
  type ListRenderItemInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedAnim, { FadeInUp } from 'react-native-reanimated';
import { Colors, BorderRadius, Motion } from '@/constants/tokens';
import { MemoryCard } from './MemoryCard';
import { AvaOrb } from '@/components/AvaOrb';
import type { MemorySummary, MemoryViewMode } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface MemoryResultsGridProps {
  items: MemorySummary[];
  loading?: boolean;
  page: number;
  pageSize: number;
  total: number;
  viewMode: MemoryViewMode;
  onPageChange: (n: number) => void;
  onCardPress: (memoryId: string) => void;
  onBookmarkToggle: (memoryId: string) => void;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const GRID_GAP = 20;
const GRID_COLUMNS_WEB = 3;
const TABLET_BREAKPOINT = 768;
const CARD_PLACEHOLDER_HEIGHT = 380;
const CARD_PLACEHOLDER_HEADER = 132;

// Web grid styles can't be expressed via React Native StyleSheet; we rely on
// `display: grid` inline (cast to any) on the outer View when running on web.
const webGridContainerStyle = (columns: number) =>
  Platform.OS === 'web'
    ? ({
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: GRID_GAP,
        width: '100%',
      } as object)
    : null;

// ---------------------------------------------------------------------------
// Skeleton card (matches MemoryCard dimensions)
// ---------------------------------------------------------------------------

function SkeletonCard() {
  // Web uses CSS keyframes for shimmer (defined once below). Native uses
  // an Animated.Value loop on opacity.
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (Platform.OS === 'web') return; // CSS handles it
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  if (Platform.OS === 'web') {
    return (
      <View style={skeletonStyles.outer}>
        <View
          style={[
            skeletonStyles.header,
            { animationName: 'memoryShimmer', animationDuration: '1800ms', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' } as any,
          ]}
        />
        <View style={skeletonStyles.body}>
          <View style={[skeletonStyles.line, { width: '70%' }]} />
          <View style={[skeletonStyles.line, { width: '90%' }]} />
          <View style={[skeletonStyles.line, { width: '50%' }]} />
          <View style={skeletonStyles.spacer} />
          <View style={skeletonStyles.metaRow}>
            <View style={[skeletonStyles.pill, { width: 70 }]} />
            <View style={[skeletonStyles.pill, { width: 40 }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[skeletonStyles.outer, { opacity }]}>
      <View style={skeletonStyles.header} />
      <View style={skeletonStyles.body}>
        <View style={[skeletonStyles.line, { width: '70%' }]} />
        <View style={[skeletonStyles.line, { width: '90%' }]} />
        <View style={[skeletonStyles.line, { width: '50%' }]} />
        <View style={skeletonStyles.spacer} />
        <View style={skeletonStyles.metaRow}>
          <View style={[skeletonStyles.pill, { width: 70 }]} />
          <View style={[skeletonStyles.pill, { width: 40 }]} />
        </View>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Empty state — muted orb + single body line
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.orbHalo}>
        <AvaOrb state="idle" size={120} />
      </View>
      <Text style={emptyStyles.body}>
        No memories yet — your office history will appear here.
      </Text>
      <Text style={emptyStyles.sub}>
        Try adjusting your filters or asking Ava about a recent project.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pagination footer
// ---------------------------------------------------------------------------

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (n: number) => void;
}

/**
 * Build a list of page tokens for compact pagination:
 *   [1, 2, 3, '...', 10]
 *
 * Always shows first + last; window of (cur-1, cur, cur+1); ellipses fill the
 * gaps.
 */
function buildPageTokens(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const tokens: (number | 'ellipsis')[] = [];
  const window = new Set<number>([1, total, current - 1, current, current + 1]);
  let last: number | null = null;
  for (let p = 1; p <= total; p++) {
    if (!window.has(p)) continue;
    if (last !== null && p - last > 1) tokens.push('ellipsis');
    tokens.push(p);
    last = p;
  }
  return tokens;
}

function Pagination({ page, pageCount, total, pageSize, onPageChange }: PaginationProps) {
  const tokens = useMemo(() => buildPageTokens(page, pageCount), [page, pageCount]);
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <View style={paginationStyles.wrap}>
      <View style={paginationStyles.controls}>
        <PaginationButton
          icon="chevron-back"
          disabled={page <= 1}
          onPress={() => onPageChange(page - 1)}
          accessibilityLabel="Previous page"
        />
        {tokens.map((tok, i) =>
          tok === 'ellipsis' ? (
            <View key={`ellipsis-${i}`} style={paginationStyles.ellipsis}>
              <Text style={paginationStyles.ellipsisText}>…</Text>
            </View>
          ) : (
            <PaginationButton
              key={tok}
              label={String(tok)}
              active={tok === page}
              onPress={() => onPageChange(tok)}
              accessibilityLabel={`Go to page ${tok}`}
            />
          ),
        )}
        <PaginationButton
          icon="chevron-forward"
          disabled={page >= pageCount}
          onPress={() => onPageChange(page + 1)}
          accessibilityLabel="Next page"
        />
      </View>

      <Text style={paginationStyles.summary}>
        Showing {startIdx}–{endIdx} of {total} memories
      </Text>
    </View>
  );
}

interface PaginationButtonProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function PaginationButton({ label, icon, active, disabled, onPress, accessibilityLabel }: PaginationButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ hovered }: { hovered?: boolean }) => [
        paginationStyles.button,
        active && paginationStyles.buttonActive,
        hovered && !disabled && !active && paginationStyles.buttonHover,
        disabled && paginationStyles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={
            disabled
              ? (Colors.text.disabled as string)
              : active
                ? '#FFFFFF'
                : (Colors.text.secondary as string)
          }
        />
      ) : (
        <Text
          style={[
            paginationStyles.buttonLabel,
            active && paginationStyles.buttonLabelActive,
            disabled && paginationStyles.buttonLabelDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// MemoryResultsGrid
// ---------------------------------------------------------------------------

export function MemoryResultsGrid({
  items,
  loading = false,
  page,
  pageSize,
  total,
  viewMode,
  onPageChange,
  onCardPress,
  onBookmarkToggle,
}: MemoryResultsGridProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isList = viewMode === 'list';

  // Native uses Dimensions to switch 1-col / 2-col layouts.
  const winWidth = Platform.OS === 'web' ? 1280 : Dimensions.get('window').width;
  const nativeColumns = isList ? 1 : winWidth >= TABLET_BREAKPOINT ? 2 : 1;

  // ---- Loading state -----------------------------------------------------
  if (loading) {
    const skeletonColumns = isList ? 1 : Platform.OS === 'web' ? GRID_COLUMNS_WEB : nativeColumns;
    return (
      <View>
        {Platform.OS === 'web' ? (
          <View style={webGridContainerStyle(skeletonColumns) as any}>
            {Array.from({ length: pageSize }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </View>
        ) : (
          <View style={[styles.nativeGrid, { gap: GRID_GAP }]}>
            {Array.from({ length: pageSize }, (_, i) => (
              <View
                key={i}
                style={{
                  width: nativeColumns === 1 ? '100%' : '48%',
                }}
              >
                <SkeletonCard />
              </View>
            ))}
          </View>
        )}
        {Platform.OS === 'web' ? <ShimmerKeyframes /> : null}
      </View>
    );
  }

  // ---- Empty state -------------------------------------------------------
  if (total === 0) {
    return <EmptyState />;
  }

  // ---- Web grid ----------------------------------------------------------
  if (Platform.OS === 'web') {
    const columns = isList ? 1 : GRID_COLUMNS_WEB;
    return (
      <View>
        {/* `key` forces remount when paging or toggling view, replaying the stagger */}
        <View
          key={`${page}-${viewMode}`}
          style={webGridContainerStyle(columns) as any}
        >
          {items.map((item, idx) => (
            <ReanimatedAnim.View
              key={item.id}
              entering={FadeInUp.delay(idx * Motion.gridStagger.interval)
                .duration(Motion.gridStagger.duration)
                .springify()
                .damping(Motion.spring.damping)
                .stiffness(Motion.spring.stiffness)}
            >
              <MemoryCard
                memory={item}
                compact={isList}
                onPress={() => onCardPress(item.id)}
                onBookmarkToggle={() => onBookmarkToggle(item.id)}
              />
            </ReanimatedAnim.View>
          ))}
        </View>

        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </View>
    );
  }

  // ---- Native (FlatList) -------------------------------------------------
  const renderItem = ({ item, index }: ListRenderItemInfo<MemorySummary>) => (
    <ReanimatedAnim.View
      entering={FadeInUp.delay(index * Motion.gridStagger.interval)
        .duration(Motion.gridStagger.duration)
        .springify()}
      style={[
        styles.nativeItemWrap,
        nativeColumns === 2 && { width: '48%' },
        nativeColumns === 1 && { width: '100%' },
      ]}
    >
      <MemoryCard
        memory={item}
        compact={isList}
        onPress={() => onCardPress(item.id)}
        onBookmarkToggle={() => onBookmarkToggle(item.id)}
      />
    </ReanimatedAnim.View>
  );

  return (
    <View>
      <FlatList
        key={`${nativeColumns}-${page}-${viewMode}`}
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        numColumns={nativeColumns}
        columnWrapperStyle={
          nativeColumns > 1
            ? { justifyContent: 'space-between', gap: GRID_GAP }
            : undefined
        }
        contentContainerStyle={{ gap: GRID_GAP }}
        scrollEnabled={false}
      />

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Web shimmer keyframes — injected once
// ---------------------------------------------------------------------------

let _shimmerInjected = false;

function ShimmerKeyframes() {
  useEffect(() => {
    if (Platform.OS !== 'web' || _shimmerInjected) return;
    _shimmerInjected = true;
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes memoryShimmer {
        0% { opacity: 0.45; }
        50% { opacity: 0.85; }
        100% { opacity: 0.45; }
      }
    `;
    document.head.appendChild(style);
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  nativeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nativeItemWrap: {},
});

const skeletonStyles = StyleSheet.create({
  outer: {
    height: CARD_PLACEHOLDER_HEIGHT,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.memory.cardBg as string,
    borderWidth: 1,
    borderColor: Colors.border.default as string,
    overflow: 'hidden',
  },
  header: {
    height: CARD_PLACEHOLDER_HEADER,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle as string,
  },
  body: {
    padding: 18,
    flex: 1,
    gap: 10,
  },
  line: {
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  spacer: {
    flex: 1,
    minHeight: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  orbHalo: {
    opacity: 0.55,
  },
  body: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text.secondary as string,
    textAlign: 'center',
    maxWidth: 460,
  },
  sub: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 420,
  },
});

const paginationStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 32,
    flexWrap: 'wrap',
    gap: 16,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 140ms ease-out',
          cursor: 'pointer',
        } as object)
      : {}),
  } as any,
  buttonHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  buttonActive: {
    backgroundColor: Colors.accent.cyan as string,
  },
  buttonDisabled: {
    opacity: 0.4,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as object) : {}),
  } as any,
  buttonLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text.secondary as string,
    minWidth: 16,
    textAlign: 'center',
  },
  buttonLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  buttonLabelDisabled: {
    color: Colors.text.disabled as string,
  },
  ellipsis: {
    paddingHorizontal: 6,
  },
  ellipsisText: {
    color: Colors.text.tertiary as string,
    fontSize: 13,
  },
  summary: {
    fontSize: 13,
    color: Colors.text.tertiary as string,
  },
});
