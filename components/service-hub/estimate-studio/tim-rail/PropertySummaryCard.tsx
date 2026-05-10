/**
 * PropertySummaryCard — premium estimate-ready property briefing for the
 * Tim rail Context tab.
 *
 * This is THE estimating brief. Everything a contractor needs to size up a
 * job sits here, single-pane, no clicks:
 *
 *   • Property identity   — formatted address + coords
 *   • Building dimensions — sqft, lot, stories, year, type, zoning
 *   • Total building area — large numeric reveal
 *   • Quick cost estimate — band (low–high)
 *   • Materials signals   — name + confidence bar
 *   • Roof + access       — roof type, pitch flag, access risk
 *   • Evidence gaps       — what's missing before we can quote tighter
 *   • Photo coverage      — counts by lane
 *   • Data sources health — provider status + freshness
 *
 * Aspire Law #7: pure render. Aspire Law #2: each source row is a receipt
 * mirror (status + fetchedAt). Aspire Law #3: empty data = explicit "—" or
 * "missing", never silent fabrication.
 */
import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SheenBlock } from '../visuals/InsightCardBase';
import type {
  PropertyData,
  SourceStatus,
} from '@/services/serviceHub/propertyDataApi';

interface Props {
  data?: PropertyData;
  loading: boolean;
}

const SOURCE_LABEL: Record<SourceStatus['name'], string> = {
  addressValidation: 'Address Valid.',
  geocoding: 'Geocoding',
  streetView: 'Street View',
  solar: 'Solar',
  adam: 'Adam (ATTOM + Zillow)',
  places: 'Places',
};

const STATUS_COLOR: Record<SourceStatus['status'], string> = {
  ok: '#34c759',
  partial: '#fbbf24',
  missing: 'rgba(255,255,255,0.30)',
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

const CONFIDENCE_PCT: Record<'high' | 'medium' | 'low', number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
};

const ACCESS_COLOR: Record<'low' | 'medium' | 'high', string> = {
  low: '#34c759',
  medium: '#fbbf24',
  high: '#ff6b6b',
};

function formatSqft(n?: number): string {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? n.toLocaleString('en-US')
    : '—';
}

function formatCurrency(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000).toLocaleString('en-US')}K`;
  return `$${n.toLocaleString('en-US')}`;
}

export function PropertySummaryCard({ data, loading }: Props) {
  if (loading) {
    return (
      <View style={styles.card} testID="property-summary-card-skeleton">
        <SkeletonSection lines={3} />
        <SkeletonSection lines={4} />
        <SkeletonSection lines={3} />
        <SkeletonSection lines={3} />
        <SkeletonSection lines={4} />
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
            Enter an address to populate the estimate brief.
          </Text>
        </View>
      </View>
    );
  }

  // -- Derived view models --------------------------------------------------
  const f = data.facts as PropertyData['facts'] & {
    bedrooms?: number;
    bathrooms?: number;
    constructionFrame?: string;
    quality?: string;
    ownerName?: string;
    ownerOccupied?: boolean;
    estimatedValue?: number;
    estimatedValueLow?: number;
    estimatedValueHigh?: number;
    lastSaleDate?: string;
    lastSaleAmount?: number;
    annualTax?: number;
    taxYear?: number;
  };
  const facts: { label: string; value: string }[] = [
    { label: 'Type', value: f.propertyType ?? '—' },
    { label: 'Year', value: f.yearBuilt ? String(f.yearBuilt) : '—' },
    { label: 'Beds', value: f.bedrooms ? String(f.bedrooms) : '—' },
    { label: 'Baths', value: f.bathrooms ? String(f.bathrooms) : '—' },
    { label: 'Stories', value: f.stories ? String(f.stories) : '—' },
    { label: 'Frame', value: f.constructionFrame ?? '—' },
    { label: 'Quality', value: f.quality ?? '—' },
    { label: 'Zoning', value: f.zoning ?? '—' },
    { label: 'Lot', value: f.lotSqft ? `${formatSqft(f.lotSqft)} sf` : '—' },
    {
      label: 'Coords',
      value: data.coords && Number.isFinite(data.coords.lat) && Number.isFinite(data.coords.lng)
        ? `${data.coords.lat.toFixed(4)}, ${data.coords.lng.toFixed(4)}`
        : '—',
    },
  ];

  const ownerLine = f.ownerName
    ? `${f.ownerName}${f.ownerOccupied ? ' · owner-occupied' : ''}`
    : null;
  const hasAvm =
    typeof f.estimatedValue === 'number' && f.estimatedValue > 0;
  const hasLastSale = !!f.lastSaleDate && typeof f.lastSaleAmount === 'number';
  const hasTax = typeof f.annualTax === 'number' && f.annualTax > 0;
  const showOwnerSection = !!ownerLine || hasAvm || hasLastSale || hasTax;

  const sqftFmt = formatSqft(data.facts.sqft);
  const hasSqft = sqftFmt !== '—';
  const cb = data.costBand;
  const hasCostBand =
    cb && Number.isFinite(cb.low) && Number.isFinite(cb.high) && cb.high >= cb.low && cb.high > 0;

  const materials = data.signals.materials.slice(0, 6);
  const evidenceGaps = data.evidenceGaps ?? [];
  const sources = data.sources;

  const photoCounts = {
    interior: data.photos.interior.count ?? 0,
    exterior: data.photos.exterior.count ?? 0,
    roof: data.photos.roof.count ?? 0,
    streetView: data.photos.streetView.count ?? 0,
  };
  const totalPhotos =
    photoCounts.interior + photoCounts.exterior + photoCounts.roof + photoCounts.streetView;

  return (
    <View style={styles.card} testID="property-summary-card">
      {/* PROPERTY IDENTITY */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Property</Text>
        </View>
        <View style={styles.sectionBody}>
          <Text style={styles.addressLine1} numberOfLines={2}>
            {data.address.street ?? data.address.formatted}
          </Text>
          {(data.address.city || data.address.state || data.address.zip) && (
            <Text style={styles.addressLine2}>
              {[data.address.city, data.address.state, data.address.zip]
                .filter(Boolean)
                .join(', ')}
            </Text>
          )}
        </View>
      </View>

      {/* TOTAL BUILDING AREA — hero numeric */}
      <View style={[styles.section, styles.heroSection]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="resize-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Total Building Area</Text>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroNumber} numberOfLines={1} adjustsFontSizeToFit>
            {sqftFmt}
          </Text>
          <Text style={styles.heroUnit}>{hasSqft ? 'sq ft' : 'no facts resolved'}</Text>
        </View>
      </View>

      {/* QUICK COST ESTIMATE */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trending-up-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Quick Cost Estimate</Text>
        </View>
        <View style={styles.sectionBody}>
          {hasCostBand ? (
            <Text style={styles.costBand} numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(cb!.low)} – {formatCurrency(cb!.high)}
            </Text>
          ) : (
            <Text style={styles.muted}>
              Add square footage and material details to surface a band.
            </Text>
          )}
        </View>
      </View>

      {/* PROPERTY FACTS — 2-column grid */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="information-circle-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Property Facts</Text>
        </View>
        <View style={styles.factsGrid}>
          {facts.map((f) => (
            <View style={styles.factTile} key={f.label}>
              <Text style={styles.factTileLabel}>{f.label}</Text>
              <Text style={styles.factTileValue} numberOfLines={1}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* OWNER & VALUATION (ATTOM-derived contractor context) */}
      {showOwnerSection && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-circle-outline" size={11} color="rgba(255,255,255,0.45)" />
            <Text style={styles.sectionLabel}>Owner &amp; Valuation</Text>
          </View>
          <View style={styles.sectionBody}>
            {ownerLine && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Owner</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {ownerLine}
                </Text>
              </View>
            )}
            {hasAvm && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>AVM</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {formatCurrency(f.estimatedValue!)}
                  {typeof f.estimatedValueLow === 'number' &&
                  typeof f.estimatedValueHigh === 'number'
                    ? ` (${formatCurrency(f.estimatedValueLow)}–${formatCurrency(f.estimatedValueHigh)})`
                    : ''}
                </Text>
              </View>
            )}
            {hasLastSale && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Last sale</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {formatCurrency(f.lastSaleAmount!)} · {f.lastSaleDate}
                </Text>
              </View>
            )}
            {hasTax && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Annual tax</Text>
                <Text style={styles.factValue} numberOfLines={1}>
                  {formatCurrency(f.annualTax!)}
                  {f.taxYear ? ` (${f.taxYear})` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ROOF + ACCESS */}
      {(data.signals.roofType || data.signals.accessRisk) && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="construct-outline" size={11} color="rgba(255,255,255,0.45)" />
            <Text style={styles.sectionLabel}>Roof &amp; Access</Text>
          </View>
          <View style={styles.sectionBody}>
            {data.signals.roofType && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Roof type</Text>
                <Text style={styles.factValue}>{data.signals.roofType}</Text>
              </View>
            )}
            {data.signals.accessRisk && (
              <View style={styles.factRow}>
                <Text style={styles.factLabel}>Access risk</Text>
                <View style={styles.pillRow}>
                  <View
                    style={[
                      styles.riskDot,
                      { backgroundColor: ACCESS_COLOR[data.signals.accessRisk] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.factValue,
                      { color: ACCESS_COLOR[data.signals.accessRisk], textTransform: 'capitalize' },
                    ]}
                  >
                    {data.signals.accessRisk}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* MATERIAL SIGNALS — confidence bars */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="layers-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Material Signals</Text>
        </View>
        <View style={styles.sectionBody}>
          {materials.length === 0 ? (
            <Text style={styles.muted}>No signals detected yet.</Text>
          ) : (
            materials.map((m) => (
              <View style={styles.materialRow} key={m.name}>
                <View style={styles.materialNameRow}>
                  <Text style={styles.materialName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={[styles.materialConfidenceText, { color: CONFIDENCE_COLOR[m.confidence] }]}>
                    {m.confidence.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${CONFIDENCE_PCT[m.confidence] * 100}%`,
                        backgroundColor: CONFIDENCE_COLOR[m.confidence],
                      },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* EVIDENCE GAPS */}
      {evidenceGaps.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="alert-circle-outline" size={11} color="#fbbf24" />
            <Text style={[styles.sectionLabel, { color: 'rgba(251,191,36,0.85)' }]}>
              Evidence Gaps
            </Text>
          </View>
          <View style={styles.sectionBody}>
            {evidenceGaps.slice(0, 4).map((gap, idx) => (
              <View key={`${gap}-${idx}`} style={styles.gapRow}>
                <Text style={styles.gapBullet}>•</Text>
                <Text style={styles.gapText}>{gap}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* PHOTO COVERAGE */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="images-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>
            Photo Coverage <Text style={styles.sectionLabelMeta}>· {totalPhotos} total</Text>
          </Text>
        </View>
        <View style={styles.photoGrid}>
          <PhotoChip label="Interior" count={photoCounts.interior} />
          <PhotoChip label="Exterior" count={photoCounts.exterior} />
          <PhotoChip label="Roof" count={photoCounts.roof} />
          <PhotoChip label="Street" count={photoCounts.streetView} />
        </View>
      </View>

      {/* DATA SOURCES */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="git-network-outline" size={11} color="rgba(255,255,255,0.45)" />
          <Text style={styles.sectionLabel}>Data Sources</Text>
        </View>
        <View style={styles.sectionBody}>
          {sources.length === 0 ? (
            <Text style={styles.muted}>No sources reporting.</Text>
          ) : (
            sources.map((src) => <SourceRow key={src.name} source={src} />)
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inner pieces
// ---------------------------------------------------------------------------

function PhotoChip({ label, count }: { label: string; count: number }) {
  const has = count > 0;
  return (
    <View style={[styles.photoChip, has ? styles.photoChipFilled : styles.photoChipEmpty]}>
      <Text style={[styles.photoChipCount, has ? styles.photoChipCountFilled : styles.photoChipCountEmpty]}>
        {count}
      </Text>
      <Text style={styles.photoChipLabel}>{label}</Text>
    </View>
  );
}

function SourceRow({ source }: { source: SourceStatus }) {
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
          <SheenBlock
            key={i}
            width="90%"
            height={11}
            radius={4}
            style={{ marginTop: i === 0 ? 0 : 6 }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  heroSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionLabelMeta: {
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.4,
    textTransform: 'none',
  },
  sectionBody: {
    gap: 6,
  },

  // PROPERTY IDENTITY
  addressLine1: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  addressLine2: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.1,
  },

  // HERO (Total Building Area)
  heroBody: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  heroNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.2,
  },

  // COST BAND
  costBand: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },

  // FACTS GRID (2 columns)
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  factTile: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  factTileLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  factTileValue: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.1,
    fontVariant: ['tabular-nums'],
  },

  // ROOF & ACCESS rows
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  factLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
  factValue: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // MATERIAL SIGNALS — bars
  materialRow: {
    gap: 4,
  },
  materialNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  materialName: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
  materialConfidenceText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  confidenceTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },

  // EVIDENCE GAPS
  gapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gapBullet: {
    fontSize: 12,
    color: 'rgba(251,191,36,0.85)',
    lineHeight: 16,
  },
  gapText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16,
    letterSpacing: -0.1,
  },

  // PHOTO COVERAGE
  photoGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  photoChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  photoChipFilled: {
    backgroundColor: 'rgba(52,199,89,0.06)',
    borderColor: 'rgba(52,199,89,0.20)',
  },
  photoChipEmpty: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  photoChipCount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  photoChipCountFilled: {
    color: '#34c759',
  },
  photoChipCountEmpty: {
    color: 'rgba(255,255,255,0.35)',
  },
  photoChipLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // DATA SOURCES
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

  // EMPTY STATE
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
    lineHeight: 16,
  },
});
