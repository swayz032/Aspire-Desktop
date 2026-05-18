/**
 * SheetThumbnailGrid — Wave 6.5.
 *
 * Premium flat-card grid of blueprint sheets. Replaces the canvas-area empty
 * state and the legacy <SheetRoster /> list once INGEST completes.
 *
 * Composition:
 *   - Top: summary stat row (sheets · disciplines · revisions) with tick
 *     animation on count change (200ms cross-fade, CLS=0).
 *   - Discipline filter chip strip — All · A · S · M · E · P · FP · C · L
 *     (counts reflect the filtered population).
 *   - Grid: each card = thumbnail + sheet number + discipline chip + revision
 *     badge. Click a "current" card with predecessors to expand a vertical
 *     timeline of the revision chain.
 *   - Empty/loading states: shimmer placeholders.
 *
 * Data: consumes `BlueprintSheetRead[]` + `RevisionChain[]` from
 * `useBlueprintProjectPoll`.
 *
 * Visual locks:
 *   - Card shell uses flat-premium tokens (rgba(255,255,255,0.025) bg,
 *     rgba(255,255,255,0.08) border) consistent with BottomChipStrip.
 *   - Active chip uses the locked amber-gold `#fbbf24` accent.
 *   - Revision timeline uses hairline rules + CURRENT pill (same accent).
 *
 * Law #7: render layer only — no autonomous decisions.
 */
import React, { useMemo, useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintSheetRead } from '@/lib/api/blueprintsApi';
import type { RevisionChain } from '@/hooks/useBlueprintProjectPoll';
import { getDisciplineStyle } from './disciplines';

// ---------------------------------------------------------------------------
// Animated count primitive (200ms cross-fade on value change)
// ---------------------------------------------------------------------------

function AnimatedCount({
  value,
  style,
  testID,
}: {
  value: number;
  style?: any;
  testID?: string;
}): React.ReactElement {
  const [displayed, setDisplayed] = useState(value);
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (value === displayed) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setDisplayed(value);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [value, displayed, opacity]);

  return (
    <Animated.Text style={[style, { opacity }]} testID={testID}>
      {displayed}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// Filter strip — "All" + the 8 canonical AIA discipline codes
// ---------------------------------------------------------------------------

const DISCIPLINE_FILTERS: Array<{ key: string | null; code: string; label: string }> = [
  { key: null, code: 'All', label: 'All' },
  { key: 'architectural', code: 'A', label: 'Architectural' },
  { key: 'structural', code: 'S', label: 'Structural' },
  { key: 'mechanical', code: 'M', label: 'Mechanical' },
  { key: 'electrical', code: 'E', label: 'Electrical' },
  { key: 'plumbing', code: 'P', label: 'Plumbing' },
  { key: 'fire_protection', code: 'FP', label: 'Fire Protection' },
  { key: 'civil', code: 'C', label: 'Civil' },
  { key: 'landscape', code: 'L', label: 'Landscape' },
];

function _normalizeDisc(disc: string | null | undefined): string | null {
  if (!disc) return null;
  return disc.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

// ---------------------------------------------------------------------------
// Shimmer skeleton
// ---------------------------------------------------------------------------

function ShimmerCard({ index }: { index: number }): React.ReactElement {
  const pulse = React.useRef(new Animated.Value(0.35)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 900,
          useNativeDriver: true,
          delay: (index % 4) * 120,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, index]);

  return (
    <View style={styles.cardHost} testID={`sheet-thumb-skeleton-${index}`}>
      <Animated.View style={[styles.thumbSlot, styles.skelThumb, { opacity: pulse }]} />
      <View style={styles.cardMeta}>
        <Animated.View style={[styles.skelLine, styles.skelLineWide, { opacity: pulse }]} />
        <Animated.View style={[styles.skelLine, { opacity: pulse }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single sheet thumbnail card
// ---------------------------------------------------------------------------

interface SheetCardProps {
  sheet: BlueprintSheetRead;
  index: number;
  chain: RevisionChain | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function SheetCard({
  sheet,
  index,
  chain,
  isExpanded,
  onToggleExpand,
}: SheetCardProps): React.ReactElement {
  const discStyle = getDisciplineStyle(sheet.discipline);
  const hasChain = chain != null;
  const isSuperseded = false; // top-level grid only renders current sheets
  const revisionNum = sheet.revision ?? null;

  return (
    <View style={styles.cardHost} testID={`sheet-thumb-card-${sheet.id}`}>
      <Pressable
        onPress={hasChain ? onToggleExpand : undefined}
        disabled={!hasChain}
        accessibilityRole={hasChain ? 'button' : undefined}
        accessibilityLabel={
          hasChain
            ? `Sheet ${sheet.sheet_number ?? index + 1} — ${
                chain!.sheets.length
              } revisions. Tap to ${isExpanded ? 'collapse' : 'expand'} chain.`
            : `Sheet ${sheet.sheet_number ?? index + 1}`
        }
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.card,
          hovered && hasChain && styles.cardHover,
          pressed && hasChain && styles.cardPressed,
        ]}
      >
        <View style={styles.thumbSlot}>
          {sheet.thumbnail_url ? (
            <Image
              source={{ uri: sheet.thumbnail_url }}
              style={styles.thumbImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons
                name="document-text-outline"
                size={28}
                color="rgba(255,255,255,0.35)"
              />
            </View>
          )}

          {/* Top-left: revision badge */}
          {revisionNum != null && revisionNum > 0 ? (
            <View style={styles.revBadge} testID={`sheet-rev-badge-${sheet.id}`}>
              <Text style={styles.revBadgeText}>REV {revisionNum}</Text>
            </View>
          ) : null}

          {/* Top-right: chain indicator */}
          {hasChain ? (
            <View style={styles.chainBadge}>
              <Ionicons name="git-branch-outline" size={11} color="#fbbf24" />
              <Text style={styles.chainBadgeText}>{chain!.sheets.length}</Text>
            </View>
          ) : null}

          {/* Bottom-left: discipline pill */}
          <View
            style={[
              styles.discPill,
              { backgroundColor: discStyle.fg + '22', borderColor: discStyle.fg + '55' },
            ]}
            testID={`sheet-disc-pill-${sheet.id}`}
          >
            <Text style={[styles.discPillText, { color: discStyle.fg }]}>
              {discStyle.code}
            </Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.cardSheetNum} numberOfLines={1}>
            {sheet.sheet_number ?? `Sheet ${index + 1}`}
          </Text>
          <Text style={[styles.cardDisc, { color: discStyle.fg }]} numberOfLines={1}>
            {discStyle.label}
            {isSuperseded ? ' · superseded' : ''}
          </Text>
        </View>
      </Pressable>

      {/* Revision chain timeline (in-flow expansion) */}
      {isExpanded && hasChain ? (
        <RevisionTimeline chain={chain!} />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Revision chain timeline
// ---------------------------------------------------------------------------

function RevisionTimeline({ chain }: { chain: RevisionChain }): React.ReactElement {
  return (
    <View style={styles.timelineHost} testID={`revision-timeline-${chain.currentSheetId}`}>
      <View style={styles.timelineHeader}>
        <Ionicons name="git-branch-outline" size={12} color="#fbbf24" />
        <Text style={styles.timelineTitle}>Revision Chain</Text>
        <Text style={styles.timelineCount}>{chain.sheets.length} versions</Text>
      </View>

      <View style={styles.timelineList}>
        {chain.sheets.map((s, idx) => {
          const isCurrent = s.id === chain.currentSheetId;
          const isFirst = idx === 0;
          const isLast = idx === chain.sheets.length - 1;
          const label = isFirst
            ? 'Predecessor'
            : isLast
              ? 'Current'
              : `Addendum ${idx}`;
          return (
            <View key={s.id} style={styles.timelineRow}>
              <View style={styles.timelineSpine}>
                {!isFirst ? <View style={styles.timelineRule} /> : <View style={styles.timelineRuleEmpty} />}
                <View
                  style={[
                    styles.timelineDot,
                    isCurrent ? styles.timelineDotCurrent : null,
                  ]}
                />
                {!isLast ? <View style={styles.timelineRule} /> : <View style={styles.timelineRuleEmpty} />}
              </View>
              <View style={styles.timelineBody}>
                <View style={styles.timelineRowHead}>
                  <Text style={styles.timelineSheetNum}>
                    {s.sheet_number ?? s.id.slice(0, 8)}
                  </Text>
                  {isCurrent ? (
                    <View style={styles.currentPill}>
                      <Text style={styles.currentPillText}>CURRENT</Text>
                    </View>
                  ) : (
                    <Text style={styles.timelineRole}>{label}</Text>
                  )}
                </View>
                <Text style={styles.timelineMeta}>
                  {s.revision != null && s.revision > 0 ? `Rev ${s.revision}` : 'Original'} ·{' '}
                  {_relativeISO(s.created_at)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function _relativeISO(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const delta = Date.now() - t;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return `${Math.floor(delta / 86_400_000)}d ago`;
  } catch {
    return '—';
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <View style={styles.emptyHost} testID="sheet-thumb-grid-empty">
      <View style={styles.emptyIconCircle}>
        <Ionicons name="documents-outline" size={28} color="rgba(255,255,255,0.45)" />
      </View>
      <Text style={styles.emptyTitle}>No sheets to show</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface SheetThumbnailGridProps {
  /** Full sheet list, including superseded (active_only=false). */
  sheets: BlueprintSheetRead[];
  /** Derived revision chains (one per current sheet that has predecessors). */
  revisions: RevisionChain[];
  /** True while the first poll is still in flight and we have no data yet. */
  isLoading: boolean;
  /** Total sheet count for the stat row (may include yet-unrendered sheets). */
  sheetCount?: number;
  testID?: string;
}

export function SheetThumbnailGrid({
  sheets,
  revisions,
  isLoading,
  sheetCount,
  testID,
}: SheetThumbnailGridProps): React.ReactElement {
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Index chains by currentSheetId for O(1) lookup.
  const chainByCurrentId = useMemo(() => {
    const m = new Map<string, RevisionChain>();
    for (const c of revisions) m.set(c.currentSheetId, c);
    return m;
  }, [revisions]);

  // Filter to "current" sheets only (i.e. those NOT superseded by another).
  const successorIds = useMemo(() => {
    const s = new Set<string>();
    for (const sh of sheets) if (sh.supersedes_id) s.add(sh.supersedes_id);
    return s;
  }, [sheets]);

  const currentSheets = useMemo(
    () => sheets.filter((s) => !successorIds.has(s.id)),
    [sheets, successorIds],
  );

  // Counts per discipline (across current sheets).
  const disciplineCounts = useMemo(() => {
    const m = new Map<string | null, number>();
    m.set(null, currentSheets.length);
    for (const s of currentSheets) {
      const k = _normalizeDisc(s.discipline);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [currentSheets]);

  const filteredSheets = useMemo(() => {
    if (filterKey == null) return currentSheets;
    return currentSheets.filter((s) => _normalizeDisc(s.discipline) === filterKey);
  }, [currentSheets, filterKey]);

  const totalSheetCount = sheetCount ?? currentSheets.length;
  const totalDisciplineCount = useMemo(() => {
    const present = new Set<string>();
    for (const s of currentSheets) {
      const k = _normalizeDisc(s.discipline);
      if (k) present.add(k);
    }
    return present.size;
  }, [currentSheets]);

  // Loading: no sheets yet, but a fetch is in flight.
  if (isLoading && sheets.length === 0) {
    return (
      <View style={styles.host} testID={testID ?? 'sheet-thumb-grid'}>
        <View style={styles.statRow} accessibilityRole="summary">
          <SkeletonStat label="sheets" />
          <View style={styles.statDivider} />
          <SkeletonStat label="disciplines" />
          <View style={styles.statDivider} />
          <SkeletonStat label="revisions" />
        </View>
        <View style={styles.filterStrip}>
          {DISCIPLINE_FILTERS.slice(0, 4).map((f) => (
            <View key={f.code} style={[styles.filterChip, styles.filterChipSkel]}>
              <Text style={styles.filterChipLabel}>{f.code}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <ShimmerCard key={i} index={i} />
          ))}
        </View>
      </View>
    );
  }

  if (currentSheets.length === 0) {
    return (
      <View style={styles.host} testID={testID ?? 'sheet-thumb-grid'}>
        <EmptyState message="Drew hasn't classified any sheets yet. Hang tight — INGEST is running." />
      </View>
    );
  }

  return (
    <View style={styles.host} testID={testID ?? 'sheet-thumb-grid'}>
      {/* Stat row */}
      <View style={styles.statRow} accessibilityRole="summary">
        <View style={styles.statBlock}>
          <AnimatedCount
            value={totalSheetCount}
            style={styles.statValue}
            testID="grid-stat-sheets"
          />
          <Text style={styles.statLabel}>sheets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <AnimatedCount
            value={totalDisciplineCount}
            style={styles.statValue}
            testID="grid-stat-disciplines"
          />
          <Text style={styles.statLabel}>disciplines</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <AnimatedCount
            value={revisions.length}
            style={styles.statValue}
            testID="grid-stat-revisions"
          />
          <Text style={styles.statLabel}>revisions</Text>
        </View>
      </View>

      {/* Discipline filter strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterStripScroll}
        contentContainerStyle={styles.filterStrip}
      >
        {DISCIPLINE_FILTERS.map((f) => {
          const count = disciplineCounts.get(f.key) ?? 0;
          const isActive = filterKey === f.key;
          const isEmpty = count === 0 && f.key !== null;
          return (
            <Pressable
              key={f.code}
              disabled={isEmpty}
              onPress={() => setFilterKey(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled: isEmpty }}
              testID={`discipline-filter-${f.code}`}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.filterChip,
                isActive && styles.filterChipActive,
                hovered && !isActive && !isEmpty && styles.filterChipHover,
                isEmpty && styles.filterChipDisabled,
              ]}
            >
              <Text
                style={[
                  styles.filterChipLabel,
                  isActive && styles.filterChipLabelActive,
                ]}
              >
                {f.code}
              </Text>
              <Text
                style={[
                  styles.filterChipCount,
                  isActive && styles.filterChipCountActive,
                ]}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grid */}
      <ScrollView
        style={styles.gridScroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {filteredSheets.map((s, idx) => (
          <SheetCard
            key={s.id}
            sheet={s}
            index={idx}
            chain={chainByCurrentId.get(s.id) ?? null}
            isExpanded={expandedId === s.id}
            onToggleExpand={() =>
              setExpandedId((cur) => (cur === s.id ? null : s.id))
            }
          />
        ))}
        {filteredSheets.length === 0 ? (
          <View style={styles.gridEmpty}>
            <Text style={styles.gridEmptyText}>
              No sheets match this discipline. Try "All".
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function SkeletonStat({ label }: { label: string }): React.ReactElement {
  const pulse = React.useRef(new Animated.Value(0.35)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.65,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.statBlock}>
      <Animated.View
        style={[styles.skelLine, styles.skelStatLine, { opacity: pulse }]}
      />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    gap: 14,
    // Lock #16 (Wave 6.5): grid host must flex and keep a >= 320 floor so
    // canvas swaps are CLS=0 and the thumbnail rail never collapses on
    // narrow viewports.
    minHeight: 320,
  },
  // -- stat row ---------------------------------------------------------
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
  },
  statBlock: {
    alignItems: 'flex-start',
    gap: 1,
    minWidth: 48,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // -- filter strip -----------------------------------------------------
  filterStripScroll: {
    flexGrow: 0,
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 150ms ease, border-color 150ms ease',
        } as any)
      : {}),
  },
  filterChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  filterChipHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  filterChipDisabled: {
    opacity: 0.35,
  },
  filterChipSkel: {
    opacity: 0.45,
  },
  filterChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.3,
  },
  filterChipLabelActive: {
    color: '#fbbf24',
  },
  filterChipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  filterChipCountActive: {
    color: 'rgba(251,191,36,0.85)',
  },
  // -- grid -------------------------------------------------------------
  gridScroll: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  gridEmpty: {
    width: '100%',
    paddingVertical: 32,
    alignItems: 'center',
  },
  gridEmptyText: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.5)',
  },
  // -- card -------------------------------------------------------------
  cardHost: {
    // Responsive card width — tablet (768+) and up. On narrow viewports
    // the host flexes 1-up, on tablet 2-up, on laptop 3-up, on desktop+
    // 4-up. Achieved via min/max width caps that play nicely with flex
    // wrap on RN-web (no media queries needed).
    minWidth: 160,
    maxWidth: 240,
    flexGrow: 1,
    flexBasis: 180,
  },
  card: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          transition:
            'background-color 150ms ease, border-color 150ms ease, transform 150ms ease',
        } as any)
      : {}),
  },
  cardHover: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderColor: 'rgba(251,191,36,0.30)',
  },
  cardPressed: {
    opacity: 0.92,
  },
  thumbSlot: {
    aspectRatio: 8.5 / 11, // letter-page portrait
    backgroundColor: 'rgba(0,0,0,0.40)',
    position: 'relative',
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // top-left REV badge
  revBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  revBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.6,
  },
  // top-right chain indicator
  chainBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
  },
  chainBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  // bottom-left discipline pill
  discPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  discPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardMeta: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  cardSheetNum: {
    fontSize: 12.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.1,
  },
  cardDisc: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.05,
  },
  // -- skeleton shimmer -------------------------------------------------
  skelThumb: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  skelLine: {
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  skelLineWide: {
    width: '70%',
  },
  skelStatLine: {
    height: 18,
    width: 44,
  },
  // -- revision timeline ------------------------------------------------
  timelineHost: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    gap: 8,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineTitle: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timelineCount: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.65)',
    fontVariant: ['tabular-nums'],
  },
  timelineList: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    minHeight: 36,
  },
  timelineSpine: {
    width: 14,
    alignItems: 'center',
  },
  timelineRule: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  timelineRuleEmpty: {
    flex: 1,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  timelineDotCurrent: {
    backgroundColor: '#fbbf24',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  timelineBody: {
    flex: 1,
    paddingVertical: 4,
    gap: 1,
  },
  timelineRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timelineSheetNum: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
  },
  timelineRole: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  currentPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  currentPillText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.8,
  },
  timelineMeta: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
  },
  // -- empty state ------------------------------------------------------
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 28,
    minHeight: 320,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 16,
  },
});
