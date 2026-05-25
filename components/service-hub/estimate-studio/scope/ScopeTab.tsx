/**
 * ScopeTab — Wave 12 (canvas-on-stage refactor).
 *
 * Owner of the Scope UX. Mirrors the Wave 11o Plans & Photos canvas pattern:
 *
 *   - Top: project breadcrumb (address + last-updated timestamp)
 *   - Optional: Wave 2.7 backend-deferred banner (when GET endpoints return 404)
 *   - Canvas: CanvasCardSwitcher hosts ONE focused card at a time
 *   - Bottom: BottomChipStrip with 7 chips
 *       (Story / Included / Not in Base / Missing Inputs / Alternates /
 *        Tariff Exposure / Truth Distribution)
 *
 * Wave 12 changes from Wave 7:
 *   - activeCard moved from local useState into `scopeUiStore` so the Tim Rail
 *     Context payload can drive chip selection from "Jump to Missing Inputs"
 *     and "Jump to Truth" affordances without prop-drilling.
 *   - Added Truth Distribution chart as the 7th chip (visual confidence story).
 *   - Chip keys re-normalised to snake_case to match the store API.
 *
 * Empty state (no project uploaded yet): big illustration + CTA back to
 * Plans & Photos. Pixel-stable: minHeight floors the canvas at 320 so it
 * never collapses (CLS=0).
 *
 * Law #7: render layer only. Data fetching lives in useBlueprintStory();
 * mutations live in useBlueprintActions().
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';
import { useBlueprintActions } from '@/hooks/useBlueprintActions';
import { scopeUiActions, useScopeUi, type ScopeCardKey } from '@/lib/scopeUiStore';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { StoryPanelV2 } from './StoryPanelV2';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsApi';
// 2026-05-25 — Legacy StoryPanel removed. V2 owns story mode end-to-end;
// the empty-chapters branch of StoryPanelV2 renders the "Drew is reading
// your blueprint" loading state so there's no flash between an empty V2
// state and a populated one. See `StoryPanelV2.tsx` line 99-111.
import { IncludedWorkCard } from './IncludedWorkCard';
import { NotInBaseCard } from './NotInBaseCard';
import { MissingInputsList } from './MissingInputsList';
import { AlternatesCard } from './AlternatesCard';
import { TariffExposureCard } from './TariffExposureCard';
import { TruthDistributionChart } from './TruthDistributionChart';
import { useAdvancedMode } from '@/hooks/useAdvancedMode';

const EMPTY_STATE_COPY = 'Drop a plan set in Plans & Photos to see the story here.';

// Wave 18b contractor-simple: default view shows only these 3 chips.
// Advanced/admin view (?advanced=1) shows the full 7.
const CONTRACTOR_CHIP_KEYS: ReadonlyArray<ScopeCardKey> = [
  'story',
  'included',      // re-labeled "The Buy List" below
  'missing_inputs', // re-labeled "Need to Confirm" below
];

export function ScopeTab(): React.ReactElement {
  const upload = useBlueprintUploadSnapshot();
  const { address } = useProjectAddress();
  const advancedMode = useAdvancedMode();
  const router = useRouter();
  // Wave 18e fix: after Wave 11n's projectId-clobber repair, upload.response is
  // deliberately null on the dedup path. The actual projectId lives at
  // upload.projectId. Match the same 3-way fallback PlansPhotosTab uses so
  // Scope doesn't render its empty state when a project IS loaded.
  const projectId =
    upload.response?.ingest?.project_id ??
    upload.response?.project_id ??
    upload.projectId ??
    null;
  const story = useBlueprintStory(projectId);
  const actions = useBlueprintActions();
  const ui = useScopeUi();
  const { setActiveCard, setActiveChapterKey } = scopeUiActions();

  // Wave 18l: defensive — backend may return null/undefined arrays during
  // hydration or schema drift. Coalesce before reading .length / .filter.
  const _assemblies = story.assemblies ?? [];
  const _missingInputs = story.missingInputs ?? [];
  const _materials = story.materials ?? [];
  const includedCount = useMemo(
    () => _assemblies.filter((a) => a.in_base_scope).length,
    [_assemblies],
  );
  const excludedCount = _assemblies.length - includedCount;
  const openMissing = useMemo(
    () => _missingInputs.filter((m) => m.status === 'open').length,
    [_missingInputs],
  );
  const alternateCount = useMemo(
    () => _assemblies.filter((a) => a.alternate_note != null).length,
    [_assemblies],
  );
  const tariffCount = useMemo(
    () => _materials.filter((m) => m.tariff_flagged).length,
    [_materials],
  );

  // Empty state — no upload yet. Stage a clear path back to Plans & Photos.
  if (!projectId) {
    return (
      <View style={styles.tab} testID="scope-tab-empty">
        <View style={styles.emptyHost}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="document-text-outline"
              size={32}
              color="rgba(255,255,255,0.55)"
            />
          </View>
          <Text style={styles.emptyTitle}>No story yet</Text>
          <Text style={styles.emptyBody}>{EMPTY_STATE_COPY}</Text>
          <Pressable
            onPress={() => router.push('/service-hub/estimate-studio/plans-photos')}
            accessibilityRole="button"
            accessibilityLabel="Go to Plans & Photos"
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.emptyCta,
              hovered && styles.emptyCtaHover,
              pressed && styles.emptyCtaPressed,
            ]}
            testID="scope-tab-empty-cta"
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#0b1220" />
            <Text style={styles.emptyCtaText}>Go to Plans &amp; Photos</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Confirmed share — for the truth chip stat.
  const truthCounts = story.story?.truth_distribution;
  const truthTotal = truthCounts
    ? Object.values(truthCounts).reduce((sum, n) => sum + (n ?? 0), 0)
    : 0;
  const confirmedShare =
    truthTotal > 0 && truthCounts
      ? Math.round(
          (((truthCounts.observed ?? 0) +
            (truthCounts.field_confirmed ?? 0) +
            (truthCounts.vendor_confirmed ?? 0) +
            (truthCounts.permit_confirmed ?? 0)) /
            truthTotal) *
            100,
        )
      : null;

  // Wave 18b — contractor-simple labels in default mode; technical labels in
  // advanced. Default = "The Buy List" / "Need to Confirm" — speaks the way a
  // contractor reads a job, not the way an estimator writes a spec.
  const allChips: BottomChip<ScopeCardKey>[] = [
    {
      key: 'story',
      icon: 'book-outline',
      label: 'Story',
      stat: story.story
        ? `${Math.round(story.story.mean_confidence * 100)}% confidence`
        : story.isPolling
          ? 'Composing…'
          : 'Waiting on REASON',
    },
    {
      key: 'included',
      icon: 'checkmark-done-outline',
      label: advancedMode ? 'Included Work' : 'The Buy List',
      stat: `${includedCount} ${advancedMode ? (includedCount === 1 ? 'assembly' : 'assemblies') : 'items'}`,
    },
    {
      key: 'not_in_base',
      icon: 'close-circle-outline',
      label: 'Not in Base',
      stat: `${excludedCount} excluded`,
    },
    {
      key: 'missing_inputs',
      icon: 'help-circle-outline',
      label: advancedMode ? 'Missing Inputs' : 'Need to Confirm',
      stat: `${openMissing} open`,
      badge: openMissing > 0 ? String(openMissing) : undefined,
    },
    {
      key: 'alternates',
      icon: 'swap-horizontal-outline',
      label: 'Alternates',
      stat: `${alternateCount} option${alternateCount === 1 ? '' : 's'}`,
    },
    {
      key: 'tariff',
      icon: 'pricetag-outline',
      label: 'Tariff Exposure',
      stat: `${tariffCount} flagged`,
    },
    {
      key: 'truth',
      icon: 'analytics-outline',
      label: 'Truth Distribution',
      stat:
        confirmedShare != null
          ? `${confirmedShare}% confirmed`
          : story.isPolling
            ? 'Counting…'
            : 'No facts yet',
    },
  ];
  // Contractor view: filter to 3 chips. Admin view: show all 7.
  const chips: BottomChip<ScopeCardKey>[] = advancedMode
    ? allChips
    : allChips.filter((c) => CONTRACTOR_CHIP_KEYS.includes(c.key));

  // If active card is filtered out (e.g. user was on Truth Distribution then
  // switched to contractor view), redirect to Story so canvas doesn't blank.
  React.useEffect(() => {
    if (!advancedMode && !CONTRACTOR_CHIP_KEYS.includes(ui.activeCard)) {
      setActiveCard('story');
    }
    // setActiveCard is module-stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedMode, ui.activeCard]);

  const storyV2Chapters = story.storyV2?.chapters ?? [];
  // 2026-05-25 — Always render StoryPanelV2. When `story.storyV2` is null
  // (pre-load) or has 0 chapters, StoryPanelV2's empty branch renders the
  // "Drew is reading your blueprint" loading state. This kills the brief
  // flash where the legacy StoryPanel rendered first then was replaced by
  // V2 once chapters arrived.
  const storyV2Safe: BlueprintStoryV2 =
    story.storyV2 ??
    ({
      project_id: projectId ?? '',
      mean_confidence: 0,
      truth_distribution: { observed: 0, derived: 0, assumed: 0 },
      chapters: [],
      coverage: { sheets_total: 0, sheets_read: 0, pages_total: 0, pages_read: 0 },
      updated_at: null,
    } as unknown as BlueprintStoryV2);

  const cards: Record<ScopeCardKey, React.ReactNode> = {
    story: (
      <StoryPanelV2
        story={storyV2Safe}
        activeChapterKey={ui.activeChapterKey ?? storyV2Chapters[0]?.key ?? null}
        onSelectChapter={(key) => setActiveChapterKey(key)}
      />
    ),
    included: <IncludedWorkCard assemblies={story.assemblies} />,
    not_in_base: <NotInBaseCard assemblies={story.assemblies} />,
    missing_inputs: (
      <MissingInputsList
        projectId={projectId}
        inputs={story.missingInputs}
        actions={actions}
        onConfirmed={() => {
          void story.refetch();
        }}
      />
    ),
    alternates: (
      <AlternatesCard assemblies={story.assemblies} actions={actions} />
    ),
    tariff: <TariffExposureCard materials={story.materials} />,
    truth: (
      <TruthDistributionChart
        story={story.story}
        assemblies={story.assemblies}
        materials={story.materials}
        isPolling={story.isPolling}
      />
    ),
  };

  return (
    <View style={styles.tab} testID="scope-tab">
      {/* Project breadcrumb. */}
      <View style={styles.breadcrumb}>
        <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.55)" />
        <Text style={styles.breadcrumbAddress} numberOfLines={1}>
          {address || 'Untitled project'}
        </Text>
        {story.story?.updated_at ? (
          <Text style={styles.breadcrumbMeta}>
            · updated {_relativeTime(story.story.updated_at)}
          </Text>
        ) : null}
        {story.isPolling ? (
          <Text style={styles.breadcrumbLive}>· reading…</Text>
        ) : null}
      </View>

      {/* Wave 2.7 backend-not-deployed banner (honest localhost UX). */}
      {!story.backendDeployed ? (
        <View
          style={styles.banner}
          accessibilityRole="alert"
          testID="scope-tab-wave-banner"
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color="#fbbf24"
          />
          <Text style={styles.bannerText}>
            Story rendering requires Wave 2.7 backend reads (PR pending merge).
          </Text>
        </View>
      ) : null}

      <View style={styles.canvas}>
        <CanvasCardSwitcher
          activeCardKey={ui.activeCard}
          cards={cards}
          testID="scope-canvas-switcher"
        />
      </View>

      {ui.activeCard !== 'story' ? (
        <BottomChipStrip
          chips={chips}
          activeKey={ui.activeCard}
          onChange={setActiveCard}
          testID="scope-chip-strip"
        />
      ) : null}
    </View>
  );
}

function _relativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const delta = Date.now() - date.getTime();
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    padding: 18,
    gap: 12,
    minHeight: 320, // CLS=0 — canvas never collapses across transitions.
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    flexWrap: 'wrap',
  },
  breadcrumbAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  breadcrumbMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: -0.05,
  },
  breadcrumbLive: {
    fontSize: 11,
    color: '#fbbf24',
    fontStyle: 'italic',
    letterSpacing: -0.05,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
  },
  bannerText: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: -0.05,
    lineHeight: 14,
  },
  canvas: {
    flex: 1,
    minHeight: 320,
  },
  emptyHost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: -0.25,
  },
  emptyBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.60)',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 19,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
    marginTop: 4,
  },
  emptyCtaHover: {
    opacity: 0.92,
  },
  emptyCtaPressed: {
    opacity: 0.78,
  },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1220',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
