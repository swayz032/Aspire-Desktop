/**
 * EstimateContextPayload — Wave 15.
 *
 * Right-rail Context tab payload for the Estimate route. Surfaces the bid
 * intelligence the contractor needs to make the final call:
 *
 *   - Bid health light (red / yellow / green dot)
 *   - Confidence % (avg across line items)
 *   - Blocking missing inputs counter + "Resolve before sending" CTA →
 *     routes to Scope > Missing Inputs
 *   - Suggested next step (computed)
 *   - "View source story" link → routes to Scope > Story
 *
 * Aspire Laws:
 *   - Law #7: pure render — hook reads, no decisions.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintStory } from '@/hooks/useBlueprintStory';
import { ContextTabPayload, type ContextSection } from '../shell/ContextTabPayload';
import {
  buildLineItems,
  computeBidHealth,
  computeMoneyStack,
  formatPct,
  formatUsd,
} from '@/lib/estimate/bidMath';
import { useEstimateUi } from '@/lib/estimateUiStore';

interface Props {
  projectId?: string | null;
}

export function EstimateContextPayload({
  projectId,
}: Props): React.ReactElement {
  const router = useRouter();
  const snap = useBlueprintUploadSnapshot();
  const ui = useEstimateUi();
  const effectiveProjectId = projectId ?? snap.response?.project_id ?? null;
  const story = useBlueprintStory(effectiveProjectId);

  const { health, money, lineCount } = useMemo(() => {
    const built = buildLineItems({
      materials: story.materials,
      assemblies: story.assemblies,
      baseScopeOnly: true,
      qtyOverrides: ui.qtyOverrides,
      priceOverrides: ui.priceOverrides,
      hiddenLineItemIds: ui.hiddenLineItemIds,
    });
    return {
      health: computeBidHealth(built.all),
      money: computeMoneyStack({
        lines: built.all,
        markup: ui.markup,
        perMaterialAbsorb: ui.perMaterialAbsorb,
      }),
      lineCount: built.all.filter((l) => !l.hidden).length,
    };
  }, [
    story.materials,
    story.assemblies,
    ui.qtyOverrides,
    ui.priceOverrides,
    ui.hiddenLineItemIds,
    ui.markup,
    ui.perMaterialAbsorb,
  ]);

  const openMissing = story.missingInputs.filter((m) => m.status === 'open').length;

  // Suggested next step — pick the highest-leverage action.
  const nextStep = useMemo<{ label: string; route?: string }>(() => {
    if (health.missingCount > 0 || openMissing > 0) {
      return {
        label: `Resolve ${openMissing} missing input${openMissing === 1 ? '' : 's'}`,
        route: '/service-hub/estimate-studio/scope',
      };
    }
    if (money.rfqNeededCount > 0) {
      return {
        label: `Confirm ${money.rfqNeededCount} supplier quote${money.rfqNeededCount === 1 ? '' : 's'}`,
        route: '/service-hub/estimate-studio/materials',
      };
    }
    if (health.assumedCount > 0) {
      return {
        label: 'Review assumed line items',
        route: '/service-hub/estimate-studio/scope',
      };
    }
    return { label: 'Add a cover note and send' };
  }, [
    health.missingCount,
    health.assumedCount,
    openMissing,
    money.rfqNeededCount,
  ]);

  const sections: ContextSection[] = [
    {
      key: 'bid-health',
      title: 'Bid Health',
      render: () => (
        <View style={styles.healthRow} testID="estimate-context-health">
          <View
            style={[
              styles.healthDot,
              health.level === 'green' && styles.dotGreen,
              health.level === 'yellow' && styles.dotYellow,
              health.level === 'red' && styles.dotRed,
            ]}
          />
          <View style={styles.healthBody}>
            <Text style={styles.healthLevel}>
              {health.level === 'green'
                ? 'Ship-ready'
                : health.level === 'yellow'
                  ? 'Review recommended'
                  : 'Blocked'}
            </Text>
            <Text style={styles.healthHint}>
              {health.level === 'green'
                ? 'All lines pass truth gate.'
                : health.level === 'yellow'
                  ? `${health.assumedCount} assumed line${health.assumedCount === 1 ? '' : 's'}.`
                  : `${health.missingCount + money.rfqNeededCount} blocker${
                      health.missingCount + money.rfqNeededCount === 1 ? '' : 's'
                    }.`}
            </Text>
          </View>
          <Text style={styles.healthTotal}>{formatUsd(money.total)}</Text>
        </View>
      ),
    },
    {
      key: 'confidence',
      title: 'Confidence',
      render: () => (
        <View style={styles.confidenceRow} testID="estimate-context-confidence">
          <Text style={styles.confidenceValue}>
            {lineCount === 0 ? '—' : formatPct(health.confidence, 0)}
          </Text>
          <Text style={styles.confidenceLabel}>avg across {lineCount} lines</Text>
        </View>
      ),
    },
    {
      key: 'missing',
      title: 'Blocking Missing Inputs',
      render: () => (
        <View style={styles.missingWrap} testID="estimate-context-missing">
          <View style={styles.missingTop}>
            <Text
              style={[
                styles.missingValue,
                openMissing > 0 && styles.missingValueAlert,
              ]}
            >
              {openMissing}
            </Text>
            <Text style={styles.missingLabel}>open</Text>
          </View>
          {openMissing > 0 ? (
            <Pressable
              onPress={() =>
                router.push('/service-hub/estimate-studio/scope?card=missing')
              }
              accessibilityRole="button"
              accessibilityLabel="Resolve missing inputs before sending"
              style={({ hovered, pressed }: any) => [
                styles.resolveCta,
                hovered && styles.resolveCtaHover,
                pressed && styles.resolveCtaPressed,
              ]}
              testID="estimate-context-resolve-cta"
            >
              <Ionicons name="alert-circle-outline" size={12} color="#fb923c" />
              <Text style={styles.resolveCtaText}>Resolve before sending</Text>
            </Pressable>
          ) : (
            <Text style={styles.missingClear}>All resolved — ready to send.</Text>
          )}
        </View>
      ),
    },
    {
      key: 'next-step',
      title: 'Suggested Next Step',
      render: () => (
        <Pressable
          onPress={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (nextStep.route) router.push(nextStep.route as any);
          }}
          accessibilityRole={nextStep.route ? 'button' : undefined}
          accessibilityLabel={nextStep.label}
          disabled={!nextStep.route}
          style={({ hovered, pressed }: any) => [
            styles.nextStep,
            nextStep.route && hovered && styles.nextStepHover,
            nextStep.route && pressed && styles.nextStepPressed,
          ]}
          testID="estimate-context-next-step"
        >
          <Ionicons name="arrow-forward" size={13} color="#fbbf24" />
          <Text style={styles.nextStepText}>{nextStep.label}</Text>
        </Pressable>
      ),
    },
    {
      key: 'source',
      title: 'Source of Truth',
      render: () => (
        <Pressable
          onPress={() =>
            router.push('/service-hub/estimate-studio/scope?card=story')
          }
          accessibilityRole="button"
          accessibilityLabel="View source story"
          style={({ hovered, pressed }: any) => [
            styles.sourceBtn,
            hovered && styles.sourceBtnHover,
            pressed && styles.sourceBtnPressed,
          ]}
          testID="estimate-context-view-story"
        >
          <Ionicons
            name="book-outline"
            size={13}
            color="rgba(255,255,255,0.78)"
          />
          <Text style={styles.sourceBtnText}>View source story</Text>
        </Pressable>
      ),
    },
  ];

  return (
    <ContextTabPayload sections={sections} testID="estimate-context-payload" />
  );
}

const styles = StyleSheet.create({
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  dotGreen: { backgroundColor: '#4ade80' },
  dotYellow: { backgroundColor: '#fbbf24' },
  dotRed: { backgroundColor: '#fb7185' },
  healthBody: { flex: 1, gap: 2 },
  healthLevel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  healthHint: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  healthTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 4,
  },
  confidenceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  confidenceLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.2,
  },
  missingWrap: { gap: 8, paddingHorizontal: 4 },
  missingTop: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  missingValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
  },
  missingValueAlert: { color: '#fb923c' },
  missingLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.2,
  },
  missingClear: {
    fontSize: 10.5,
    color: 'rgba(74,222,128,0.85)',
    letterSpacing: -0.05,
  },
  resolveCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(251,146,60,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.35)',
    alignSelf: 'flex-start',
  },
  resolveCtaHover: { backgroundColor: 'rgba(251,146,60,0.10)' },
  resolveCtaPressed: { opacity: 0.85 },
  resolveCtaText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#fb923c',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  nextStepHover: { backgroundColor: 'rgba(251,191,36,0.10)' },
  nextStepPressed: { opacity: 0.85 },
  nextStepText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#fbbf24',
    letterSpacing: -0.05,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignSelf: 'flex-start',
  },
  sourceBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sourceBtnPressed: { opacity: 0.82 },
  sourceBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
