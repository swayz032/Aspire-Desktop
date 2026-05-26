/**
 * MaterialInstanceCard — a single material binding row (DV Pass 4).
 *
 * Renders one MaterialInstance (a symbol legend binding + count + receipt).
 * Designed for progressive enhancement: optional props for PROV (§9), CSI
 * (§10), and ANOM (§11) waves render extra footer chips/badges only when
 * present, without re-architecting the component.
 *
 * Pure render layer. The only side effect is the optional onReceiptClick
 * callback for opening a receipt drawer.
 *
 * Law #7: tools/components are hands — no fetching, no orchestrator calls.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MaterialInstance, ConfidenceTier } from '@/lib/api/blueprintsStoryV2';

export type MaterialProvenanceSource =
  | 'legend_total'
  | 'addendum_delta'
  | 'field_observed'
  | 'assumed_typical'
  | 'derived_count';

export interface MaterialInstanceCardProps {
  instance: MaterialInstance;

  /** PROV wave (§9). When present, replaces the resolution-source chip. */
  provenance?: {
    source: MaterialProvenanceSource;
    base_count?: number;
    delta?: number;
    delta_reason?: string;
  };

  /** CSI wave (§10). When present, adds a MasterFormat chip in the footer. */
  csi_refs?: {
    masterformat_section: string;
    masterformat_title: string;
  };

  /** ANOM wave (§11). When non-empty, renders a red warning badge top-right. */
  anomaly_ids?: string[];

  /** Optional callback when the receipt chip is tapped. */
  onReceiptClick?: (receiptId: string) => void;

  testID?: string;
}

const TIER_BORDER: Record<ConfidenceTier, string> = {
  GREEN: '#22c55e',
  YELLOW: '#fbbf24',
  RED: '#ef4444',
};

const RESOLUTION_COLOR: Record<string, string> = {
  topology_match: '#22c55e',
  cluster_propagation: '#fbbf24',
  vlm_verified: '#8b5cf6',
  unknown: '#ef4444',
};

function provenanceLabel(p: NonNullable<MaterialInstanceCardProps['provenance']>): string {
  switch (p.source) {
    case 'legend_total':
      return 'from legend';
    case 'addendum_delta': {
      const sign = (p.delta ?? 0) >= 0 ? '+' : '';
      const reason = p.delta_reason ? ` · ${p.delta_reason}` : '';
      return `${sign}${p.delta ?? 0}${reason}`;
    }
    case 'field_observed':
      return 'field-observed';
    case 'assumed_typical':
      return 'assumed typical';
    case 'derived_count':
      return `derived from ${p.base_count ?? 0}`;
    default:
      return 'unknown';
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function MaterialInstanceCard(
  props: MaterialInstanceCardProps,
): React.ReactElement {
  const {
    instance,
    provenance,
    csi_refs,
    anomaly_ids,
    onReceiptClick,
    testID,
  } = props;

  const tier: ConfidenceTier = instance.tier ?? 'GREEN';
  const borderColor = TIER_BORDER[tier] ?? TIER_BORDER.GREEN;

  const resolutionChipColor =
    RESOLUTION_COLOR[instance.resolution_source as string] ?? '#6b7280';
  const resolutionLabel = provenance
    ? provenanceLabel(provenance)
    : `via ${instance.resolution_source}`;

  const anomalyCount = anomaly_ids?.length ?? 0;
  const receiptShort = instance.receipt_id
    ? truncate(instance.receipt_id, 12)
    : null;
  const handleReceipt = (): void => {
    if (onReceiptClick && instance.receipt_id) {
      onReceiptClick(instance.receipt_id);
    }
  };

  return (
    <View
      style={[styles.card, { borderLeftColor: borderColor }]}
      testID={testID ?? `material-instance-card-${instance.instance_id}`}
    >
      <View style={styles.topRow}>
        <Ionicons name="cube-outline" size={14} color="rgba(255,255,255,0.65)" />
        <View style={styles.legendBadge}>
          <Text style={styles.legendBadgeText}>{instance.legend_label}</Text>
        </View>
        <Text style={styles.symbolName} numberOfLines={1}>
          {instance.symbol_name}
        </Text>
        <View style={styles.spacer} />
        {anomalyCount > 0 ? (
          <View style={styles.anomalyBadge} testID="anomaly-badge">
            <Text style={styles.anomalyBadgeText}>⚠ {anomalyCount}</Text>
          </View>
        ) : null}
        <Text style={styles.count} testID="instance-count">
          × {instance.instance_count}
        </Text>
      </View>

      {instance.legend_specification ? (
        <Text style={styles.spec} numberOfLines={2}>
          {instance.legend_specification}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <View
          style={[
            styles.chip,
            { backgroundColor: `${resolutionChipColor}26`, borderColor: `${resolutionChipColor}66` },
          ]}
          testID="resolution-chip"
        >
          <Text style={[styles.chipText, { color: resolutionChipColor }]}>
            {resolutionLabel}
          </Text>
        </View>

        {csi_refs ? (
          <View style={styles.csiChip} testID="csi-chip">
            <Text style={styles.csiChipText}>
              {csi_refs.masterformat_section} · {truncate(csi_refs.masterformat_title, 24)}
            </Text>
          </View>
        ) : null}

        {receiptShort ? (
          <Pressable
            onPress={handleReceipt}
            disabled={!onReceiptClick}
            style={({ pressed }) => [
              styles.receiptChip,
              pressed && onReceiptClick ? styles.receiptChipPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open receipt ${instance.receipt_id}`}
            testID="receipt-chip"
          >
            <Text style={styles.receiptChipText}>receipt {receiptShort}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderLeftWidth: 3,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBadge: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  legendBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 0.4,
  },
  symbolName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  anomalyBadge: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.55)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  anomalyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  spec: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 16,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  csiChip: {
    backgroundColor: 'rgba(139,92,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  csiChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#a78bfa',
  },
  receiptChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  receiptChipPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  receiptChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.70)',
    fontVariant: ['tabular-nums'],
  },
});
