/**
 * EstimateTab — Wave 15.
 *
 * Final tab in the Estimate Studio arc. The bid lives here. Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ breadcrumb · address · last updated                         │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │                                                             │
 *   │                                                             │
 *   │                   CANVAS SCREEN (full)                      │
 *   │                                                             │
 *   │              ↳ BidSummaryCanvas (default)                   │
 *   │              ↳ LineItemsTable                               │
 *   │              ↳ MarkupMarginsCanvas                          │
 *   │              ↳ TariffDrilldown                              │
 *   │              ↳ AlternatesBundles                            │
 *   │              ↳ ExportSendCanvas                             │
 *   │                                                             │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ ⬛ Bid Summary  ⬛ Line Items  ⬛ Markup  ⬛ Tariff  ⬛ Alts │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Aspire Laws:
 *   - Law #7: pure render orchestrator — fetches via useBlueprintStory, no
 *     decisions, no mutations except via estimateUiStore.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useProjectAddress } from '@/hooks/useProjectAddress';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';
import { CanvasCardSwitcher } from '../shell/CanvasCardSwitcher';
import { BottomChipStrip, type BottomChip } from '../shell/BottomChipStrip';
import { estimateUiActions, useEstimateUi, type EstimateCardKey } from '@/lib/estimateUiStore';
import {
  buildLineItems,
  computeBidHealth,
  computeMoneyStack,
  formatUsd,
} from '@/lib/estimate/bidMath';
import { BidSummaryCanvas } from './BidSummaryCanvas';
import { LineItemsTable } from './LineItemsTable';
import { MarkupMarginsCanvas } from './MarkupMarginsCanvas';
import { TariffDrilldown } from './TariffDrilldown';
import { AlternatesBundles } from './AlternatesBundles';
import { ExportSendCanvas } from './ExportSendCanvas';

const EMPTY_STATE_COPY =
  'Drop a plan set in Plans & Photos to assemble a bid here.';

export function EstimateTab(): React.ReactElement {
  const upload = useBlueprintUploadSnapshot();
  const { address } = useProjectAddress();
  const router = useRouter();
  // Wave 18e fix: after Wave 11n's projectId-clobber repair, upload.response is
  // deliberately null on the dedup path. Use the 3-way fallback PlansPhotosTab
  // + TakeoffTab use so Estimate doesn't render its empty state when a project
  // IS loaded.
  const projectId =
    upload.response?.ingest?.project_id ??
    upload.response?.project_id ??
    upload.projectId ??
    null;
  const story = useBlueprintStory(projectId);
  const ui = useEstimateUi();
  const { setActiveCard } = estimateUiActions();

  // Build totals once for the chip-strip stat labels. The canvas screens
  // compute their own to stay self-contained.
  const stat = useMemo(() => {
    const built = buildLineItems({
      materials: story.materials,
      assemblies: story.assemblies,
      baseScopeOnly: true,
      qtyOverrides: ui.qtyOverrides,
      priceOverrides: ui.priceOverrides,
      hiddenLineItemIds: ui.hiddenLineItemIds,
    });
    const money = computeMoneyStack({
      lines: built.all,
      markup: ui.markup,
      perMaterialAbsorb: ui.perMaterialAbsorb,
    });
    const health = computeBidHealth(built.all);
    const lineCount = built.all.filter((l) => !l.hidden).length;
    const tariffCount = built.all.filter(
      (l) => l.tariffFlagged && !l.hidden,
    ).length;
    return { money, health, lineCount, tariffCount };
  }, [
    story.materials,
    story.assemblies,
    ui.qtyOverrides,
    ui.priceOverrides,
    ui.hiddenLineItemIds,
    ui.markup,
    ui.perMaterialAbsorb,
  ]);

  // ============== Empty state ==============
  if (!projectId) {
    return (
      <View style={styles.tab} testID="estimate-tab-empty">
        <View style={styles.emptyHost}>
          <View style={styles.emptyIconCircle}>
            <Ionicons
              name="calculator-outline"
              size={32}
              color="rgba(255,255,255,0.55)"
            />
          </View>
          <Text style={styles.emptyTitle}>No bid yet</Text>
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
            testID="estimate-tab-empty-cta"
          >
            <Ionicons name="cloud-upload-outline" size={14} color="#0b1220" />
            <Text style={styles.emptyCtaText}>Go to Plans &amp; Photos</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const chips: BottomChip<EstimateCardKey>[] = [
    {
      key: 'bid_summary',
      icon: 'newspaper-outline',
      label: 'Bid Summary',
      stat: formatUsd(stat.money.total),
    },
    {
      key: 'line_items',
      icon: 'list-outline',
      label: 'Line Items',
      stat: `${stat.lineCount} line${stat.lineCount === 1 ? '' : 's'}`,
      badge: stat.money.rfqNeededCount > 0 ? `${stat.money.rfqNeededCount} RFQ` : undefined,
    },
    {
      key: 'markup_margins',
      icon: 'options-outline',
      label: 'Markup & Margins',
      stat: `${ui.markup.laborPct}% / ${ui.markup.materialsPct}%`,
    },
    {
      key: 'tariff_exposure',
      icon: 'pricetag-outline',
      label: 'Tariff Exposure',
      stat:
        stat.tariffCount === 0
          ? 'none flagged'
          : `${stat.tariffCount} flagged`,
    },
    {
      key: 'alternates_bundles',
      icon: 'swap-horizontal-outline',
      label: 'Alternates',
      stat: 'Premium · Standard · Economy',
    },
    {
      key: 'export_send',
      icon: 'send-outline',
      label: 'Export & Send',
      stat:
        stat.health.level === 'green'
          ? 'ship-ready'
          : stat.health.level === 'yellow'
            ? 'review'
            : 'blocked',
      badge:
        stat.health.level === 'red'
          ? '!'
          : stat.health.level === 'yellow'
            ? '·'
            : undefined,
    },
  ];

  const cards: Record<EstimateCardKey, React.ReactNode> = {
    bid_summary: (
      <BidSummaryCanvas
        address={address}
        materials={story.materials}
        assemblies={story.assemblies}
      />
    ),
    line_items: (
      <LineItemsTable
        materials={story.materials}
        assemblies={story.assemblies}
      />
    ),
    markup_margins: (
      <MarkupMarginsCanvas
        materials={story.materials}
        assemblies={story.assemblies}
      />
    ),
    tariff_exposure: (
      <TariffDrilldown
        materials={story.materials}
        assemblies={story.assemblies}
      />
    ),
    alternates_bundles: (
      <AlternatesBundles
        materials={story.materials}
        assemblies={story.assemblies}
      />
    ),
    export_send: (
      <ExportSendCanvas
        materials={story.materials}
        assemblies={story.assemblies}
        address={address}
      />
    ),
  };

  return (
    <View style={styles.tab} testID="estimate-tab">
      {/* Project breadcrumb */}
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
          <Text style={styles.breadcrumbLive}>· composing…</Text>
        ) : null}
      </View>

      {/* Wave 2.7 backend-not-deployed banner (honest localhost UX). */}
      {!story.backendDeployed ? (
        <View
          style={styles.banner}
          accessibilityRole="alert"
          testID="estimate-tab-wave-banner"
        >
          <Ionicons
            name="information-circle-outline"
            size={13}
            color="#fbbf24"
          />
          <Text style={styles.bannerText}>
            Estimate rendering uses Wave 2.7 backend reads (story / assemblies /
            materials). Once those land your numbers go live.
          </Text>
        </View>
      ) : null}

      <View style={styles.canvas}>
        <CanvasCardSwitcher
          activeCardKey={ui.activeCard}
          cards={cards}
          testID="estimate-canvas-switcher"
        />
      </View>

      <BottomChipStrip
        chips={chips}
        activeKey={ui.activeCard}
        onChange={setActiveCard}
        testID="estimate-chip-strip"
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
  tab: { flex: 1, padding: 18, gap: 12 },
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
  canvas: { flex: 1, minHeight: 320 },
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
  emptyCtaHover: { opacity: 0.92 },
  emptyCtaPressed: { opacity: 0.78 },
  emptyCtaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1220',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
