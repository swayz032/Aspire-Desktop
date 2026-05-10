/**
 * PropertySummaryCard — compact property snapshot shown in the Tim rail
 * Context tab.
 *
 * Sections:
 *   PROPERTY        — formatted address (multi-line)
 *   PROPERTY FACTS  — type / sqft / built / zoning rows
 *   MATERIAL SIGNALS— up to 5 with confidence dots
 *   DATA SOURCES    — Adam / Address Valid. / Solar / etc, status + freshness
 *
 * Aspire Law #7: pure render. Aspire Law #2: each source row reflects a
 * receipt of the upstream call (status + fetchedAt).
 */
import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from '../visuals/InsightCardBase';
import type { PropertyData, SourceStatus } from '@/services/serviceHub/propertyDataApi';

interface Props {
  data?: PropertyData;
  loading: boolean;
}

const SOURCE_LABEL: Record<SourceStatus['name'], string> = {
  addressValidation: 'Address Valid.',
  geocoding: 'Geocoding',
  streetView: 'Street View',
  solar: 'Solar',
  adam: 'Adam',
  places: 'Places',
};

const STATUS_COLOR: Record<SourceStatus['status'], string> = {
  ok: '#34c759',
  partial: '#fbbf24',
  missing: 'rgba(255,255,255,0.35)',
  api_failure: '#ff6b6b',
};

const STATUS_LABEL: Record<SourceStatus['status'], string> = {
  ok: 'ok',
  partial: 'partial',
  missing: 'missing',
  api_failure: 'failed',
};

const CONFIDENCE_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#fbbf24',
  medium: '#60a5fa',
  low: 'rgba(255,255,255,0.35)',
};

const CONFIDENCE_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

export function PropertySummaryCard({ data, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.card} testID="property-summary-card-skeleton">
        <SkeletonSection lines={3} />
        <SkeletonSection lines={4} />
        <SkeletonSection lines={3} />
        <SkeletonSection lines={3} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.card} testID="property-summary-card-empty">
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={20} color="rgba(255,255,255,0.45)" />
          <Text style={styles.emptyTitle}>No property loaded</Text>
          <Text style={styles.emptySubtitle}>
            Enter an address to populate the Context tab.
          </Text>
        </View>
      </View>
    );
  }

  const factRows: { label: string; value: string }[] = [];
  if (data.facts.propertyType) factRows.push({ label: 'Type', value: data.facts.propertyType });
  if (data.facts.sqft) factRows.push({ label: 'Sqft', value: data.facts.sqft.toLocaleString('en-US') });
  if (data.facts.yearBuilt) factRows.push({ label: 'Built', value: String(data.facts.yearBuilt) });
  if (data.facts.zoning) factRows.push({ label: 'Zoning', value: data.facts.zoning });

  const materials = data.signals.materials.slice(0, 5);
  const sources = data.sources;

  return (
    <View style={styles.card} testID="property-summary-card">
      {/* PROPERTY */}
      <Section label="Property">
        <Text style={styles.addressLine1}>{data.address.street ?? data.address.formatted}</Text>
        {data.address.city && (data.address.state || data.address.zip) && (
          <Text style={styles.addressLine2}>
            {[data.address.city, data.address.state, data.address.zip]
              .filter(Boolean)
              .join(', ')}
          </Text>
        )}
      </Section>

      {/* PROPERTY FACTS */}
      <Section label="Property Facts">
        {factRows.length === 0 ? (
          <Text style={styles.muted}>No facts resolved.</Text>
        ) : (
          factRows.map((row) => (
            <View style={styles.factRow} key={row.label}>
              <Text style={styles.factLabel}>{row.label}</Text>
              <Text style={styles.factValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))
        )}
      </Section>

      {/* MATERIAL SIGNALS */}
      <Section label="Material Signals">
        {materials.length === 0 ? (
          <Text style={styles.muted}>No signals detected.</Text>
        ) : (
          materials.map((m) => (
            <View style={styles.signalRow} key={m.name}>
              <View
                style={[
                  styles.signalDot,
                  { backgroundColor: CONFIDENCE_COLOR[m.confidence] },
                ]}
              />
              <Text style={styles.signalName} numberOfLines={1}>
                {m.name}
              </Text>
              <Text
                style={[styles.signalConfidence, { color: CONFIDENCE_COLOR[m.confidence] }]}
              >
                {CONFIDENCE_LABEL[m.confidence]}
              </Text>
            </View>
          ))
        )}
      </Section>

      {/* DATA SOURCES */}
      <Section label="Data Sources">
        {sources.length === 0 ? (
          <Text style={styles.muted}>No sources reporting.</Text>
        ) : (
          sources.map((src) => (
            <SourceRow key={src.name} source={src} />
          ))
        )}
      </Section>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inner pieces
// ---------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} accessibilityRole="header">
        {label}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SourceRow({ source }: { source: SourceStatus }) {
  // Soft pulse on the status dot when status changes.
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.4,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [source.status, pulse]);

  return (
    <View style={styles.sourceRow}>
      <Animated.View
        style={[
          styles.sourceDot,
          { backgroundColor: STATUS_COLOR[source.status], opacity: pulse },
        ]}
      />
      <Text style={styles.sourceName} numberOfLines={1}>
        {SOURCE_LABEL[source.name] ?? source.name}
      </Text>
      <Text style={[styles.sourceStatus, { color: STATUS_COLOR[source.status] }]}>
        {STATUS_LABEL[source.status]}
      </Text>
      <Text style={styles.sourceTime}>{relativeTime(source.fetchedAt)}</Text>
    </View>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function SkeletonSection({ lines }: { lines: number }) {
  return (
    <View style={styles.section}>
      <SheenBlock width={80} height={9} radius={3} />
      <View style={[styles.sectionBody, { marginTop: 8 }]}>
        {Array.from({ length: lines }).map((_, i) => (
          <SheenBlock key={i} width="90%" height={11} radius={4} style={{ marginTop: i === 0 ? 0 : 6 }} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 16,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionBody: {
    gap: 4,
  },
  // PROPERTY
  addressLine1: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  addressLine2: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.1,
  },
  // FACTS
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  factLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    width: 56,
  },
  factValue: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  // SIGNALS
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  signalName: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  signalConfidence: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  // SOURCES
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceName: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: -0.1,
  },
  sourceStatus: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    width: 50,
    textAlign: 'right',
  },
  sourceTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.1,
    width: 48,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  emptySubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 16,
  },
  muted: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
});
