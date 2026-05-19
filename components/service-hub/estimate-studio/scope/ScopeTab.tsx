/**
 * ScopeTab — Wave 7 orchestrator.
 *
 * Owner of the Scope UX. Mirrors the Wave 6A shell pattern:
 *
 *   - Top: project breadcrumb (address + last-updated timestamp)
 *   - Optional: Wave 2.7 backend-deferred banner (when the GET endpoints
 *     return 404; honest localhost behavior per the plan)
 *   - Canvas: CanvasCardSwitcher hosts ONE focused card at a time
 *   - Bottom: BottomChipStrip with 6 chips (Story / Included / Not in Base /
 *     Missing Inputs / Alternates / Tariff Exposure)
 *
 * Empty state (no project uploaded yet): big illustration + CTA back to
 * Plans & Photos.
 *
 * Law #7: render layer only. Data fetching lives in useBlueprintStory();
 * mutations live in useBlueprintActions().
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';
import { useBlueprintActions } from '@/hooks/useBlueprintActions';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { StoryPanel } from './StoryPanel';
import { IncludedWorkCard } from './IncludedWorkCard';
import { NotInBaseCard } from './NotInBaseCard';
import { MissingInputsList } from './MissingInputsList';
import { AlternatesCard } from './AlternatesCard';
import { TariffExposureCard } from './TariffExposureCard';

type CardKey =
  | 'story'
  | 'included'
  | 'not-in-base'
  | 'missing'
  | 'alternates'
  | 'tariff';

const EMPTY_STATE_COPY = 'Drop a plan set in Plans & Photos to see the story here.';

export function ScopeTab(): React.ReactElement {
  const upload = useBlueprintUploadSnapshot();
  const { address } = useProjectAddress();
  const router = useRouter();
  const projectId = upload.response?.project_id ?? null;
  const story = useBlueprintStory(projectId);
  const actions = useBlueprintActions();

  const [activeCard, setActiveCard] = useState<CardKey>('story');

  const includedCount = useMemo(
    () => story.assemblies.filter((a) => a.in_base_scope).length,
    [story.assemblies],
  );
  const excludedCount = story.assemblies.length - includedCount;
  const openMissing = useMemo(
    () => story.missingInputs.filter((m) => m.status === 'open').length,
    [story.missingInputs],
  );
  const alternateCount = useMemo(
    () => story.assemblies.filter((a) => a.alternate_note != null).length,
    [story.assemblies],
  );
  const tariffCount = useMemo(
    () => story.materials.filter((m) => m.tariff_flagged).length,
    [story.materials],
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
            style={({ hovered, pressed }: any) => [
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

  const chips: BottomChip<CardKey>[] = [
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
      label: 'Included Work',
      stat: `${includedCount} assembl${includedCount === 1 ? 'y' : 'ies'}`,
    },
    {
      key: 'not-in-base',
      icon: 'close-circle-outline',
      label: 'Not in Base',
      stat: `${excludedCount} excluded`,
    },
    {
      key: 'missing',
      icon: 'help-circle-outline',
      label: 'Missing Inputs',
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
  ];

  const cards: Record<CardKey, React.ReactNode> = {
    story: (
      <StoryPanel
        story={story.story}
        isPolling={story.isPolling}
        onConfirmFact={(fact) => {
          // Jump to Missing Inputs and focus the matching row.
          if (fact.missing_input_id) {
            setActiveCard('missing');
          }
        }}
      />
    ),
    included: <IncludedWorkCard assemblies={story.assemblies} />,
    'not-in-base': <NotInBaseCard assemblies={story.assemblies} />,
    missing: (
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

      {/* Wave 2.7 backend-not-deployed banner (Tonio: honest localhost UX). */}
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
          activeCardKey={activeCard}
          cards={cards}
          testID="scope-canvas-switcher"
        />
      </View>

      <BottomChipStrip
        chips={chips}
        activeKey={activeCard}
        onChange={setActiveCard}
        testID="scope-chip-strip"
      />
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
