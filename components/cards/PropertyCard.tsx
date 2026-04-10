/**
 * PropertyCard — Section-based property intelligence cards.
 *
 * Each card renders ONE section of the property dossier based on
 * record._cardSection. The useAvaPresents hook splits a single property
 * record into multiple section cards so the user swipes through:
 *   Overview → Ownership → Mortgage → Valuation → Sale History → ...
 *
 * Each card has the same 200px hero with a section-specific gradient + icon,
 * the section label, and organized data rows below. Premium enterprise design.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL } from '@/lib/safeOpenURL';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import type { CardProps } from './CardRegistry';
import { fmtDollar, fmtSqft, fmtPercent } from './helpers';

/** Convert hex to rgba for cross-platform color opacity */
function rgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function DataRow({ label, value, color }: { label: string; value: string | number | undefined | null; color?: string }) {
  if (value == null || value === '') return null;
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.dataValue, color ? { color } : undefined]} numberOfLines={2}>{String(value)}</Text>
    </View>
  );
}

function Badge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'green' | 'amber' | 'red' }) {
  const bg = variant === 'green' ? Colors.semantic.successLight
    : variant === 'amber' ? Colors.semantic.warningLight
    : variant === 'red' ? Colors.semantic.errorLight
    : Colors.accent.cyanLight;
  const fg = variant === 'green' ? Colors.semantic.success
    : variant === 'amber' ? Colors.semantic.warning
    : variant === 'red' ? Colors.semantic.error
    : Colors.accent.cyan;
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function MetricChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View style={s.metricChip} accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon as any} size={14} color={Colors.text.muted} />
      <Text style={s.metricValue}>{String(value)}</Text>
      {label ? <Text style={s.metricLabel}>{label}</Text> : null}
    </View>
  );
}

function MiniRow({ left, right, sub }: { left: string; right?: string; sub?: string }) {
  return (
    <View style={s.miniRow}>
      <Text style={s.miniLeft} numberOfLines={1}>{left}</Text>
      {right ? <Text style={s.miniRight}>{right}</Text> : null}
      {sub ? <Text style={s.miniSub}>{sub}</Text> : null}
    </View>
  );
}

function ltvColor(ltv: number): string {
  if (ltv < 80) return Colors.semantic.success;
  if (ltv < 90) return Colors.semantic.warning;
  return Colors.semantic.error;
}

// Section hero config: icon, gradient, accent color
const HERO_CONFIG: Record<string, { icon: string; gradient: [string, string]; accent: string }> = {
  overview:     { icon: 'home-outline',       gradient: ['#1a2744', '#0f1923'], accent: '#3B82F6' },
  ownership:    { icon: 'person-outline',     gradient: ['#1a2744', '#1a1f2e'], accent: '#A78BFA' },
  mortgage:     { icon: 'cash-outline',       gradient: ['#1a2a1a', '#0f1f14'], accent: '#10B981' },
  valuation:    { icon: 'trending-up-outline', gradient: ['#2a2a1a', '#1f1a0f'], accent: '#F59E0B' },
  sale_history: { icon: 'swap-horizontal-outline', gradient: ['#2a1a2a', '#1f0f1a'], accent: '#EC4899' },
  rental:       { icon: 'key-outline',        gradient: ['#1a2a2a', '#0f1f1f'], accent: '#06B6D4' },
  permits:      { icon: 'construct-outline',  gradient: ['#2a2a1a', '#1f1f0f'], accent: '#F97316' },
  schools:      { icon: 'school-outline',     gradient: ['#1a1a2a', '#0f0f1f'], accent: '#6366F1' },
  foreclosure:  { icon: 'warning-outline',    gradient: ['#2a1a1a', '#1f0f0f'], accent: '#EF4444' },
};

function propTypeLabel(propType: string): string {
  const raw = String(propType || '').trim();
  if (!raw || raw.toLowerCase() === 'n/a' || raw.toLowerCase() === 'unknown') return 'Residential';
  const t = (propType || '').toLowerCase();
  if (t.includes('sfr') || t.includes('single')) return 'Single Family';
  if (t.includes('condo')) return 'Condo';
  if (t.includes('town')) return 'Townhouse';
  if (t.includes('multi') || t.includes('duplex')) return 'Multi-Family';
  if (t.includes('land') || t.includes('vacant')) return 'Vacant Land';
  return propType || 'Residential';
}

// ---------------------------------------------------------------------------
// Section Renderers
// ---------------------------------------------------------------------------

function OverviewSection({ r }: { r: Record<string, any> }) {
  const propertyValue = r.property_value || r.tax_market_value || r.estimated_value;
  const valueSource = r.property_value_source === 'county_tax_assessment' ? 'County Assessment'
    : r.property_value_source === 'avm_estimate' ? 'AVM Estimate'
    : r.tax_market_value ? 'County Assessment' : 'Estimated';

  return (
    <>
      {propertyValue != null && (
        <View style={s.valueBlock}>
          <Text style={s.valueBig}>{fmtDollar(propertyValue)}</Text>
          <Text style={s.valueSource}>{valueSource}</Text>
        </View>
      )}
      <View style={s.metricsRow}>
        {r.beds != null && <MetricChip icon="bed-outline" value={r.beds} label="Beds" />}
        {r.baths != null && <MetricChip icon="water-outline" value={r.baths} label="Baths" />}
        {r.living_sqft != null && <MetricChip icon="resize-outline" value={fmtSqft(r.living_sqft)} label="" />}
        {r.year_built != null && <MetricChip icon="calendar-outline" value={r.year_built} label="Built" />}
      </View>
      <DataRow label="Lot Size" value={r.lot_sqft ? fmtSqft(r.lot_sqft) : null} />
      <DataRow label="Stories" value={r.stories} />
      <DataRow label="Quality" value={r.quality} />
      <DataRow label="Construction" value={r.construction_frame} />
      <DataRow label="Roof" value={r.roof_cover} />
      <DataRow label="Zoning" value={r.zoning_type ? `${r.zoning_type}${r.zoning_code ? ` (${r.zoning_code})` : ''}` : null} />
      <DataRow label="County" value={r.county} />
      <DataRow label="Neighborhood" value={r.neighborhood || r.subdivision} />
      {!propertyValue && !r.beds && !r.baths && !r.living_sqft && !r.year_built && r.summary && (
        <DataRow label="Status" value={r.summary} />
      )}
    </>
  );
}

function OwnershipSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      <DataRow label="Owner" value={r.owner_name} />
      {r.owner_type && (
        <View style={s.badgeRow}>
          <Text style={s.dataLabel}>Type</Text>
          <Badge label={r.owner_type === 'Y' ? 'Corporate' : 'Individual'} />
        </View>
      )}
      {r.absentee_owner_indicator != null && (
        <View style={s.badgeRow}>
          <Text style={s.dataLabel}>Occupancy</Text>
          <Badge label={r.absentee_owner_indicator ? 'Absentee Owner' : 'Owner Occupied'} variant={r.absentee_owner_indicator ? 'amber' : 'green'} />
        </View>
      )}
      <DataRow label="Mailing Address" value={r.mailing_address} />
      <DataRow label="Previous Owner" value={r.previous_owner_name} />
      {r.homeowner_exemption != null && <DataRow label="Homeowner Exemption" value={r.homeowner_exemption ? 'Yes' : 'No'} />}
    </>
  );
}

function MortgageSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      <DataRow label="Lender" value={r.mortgage_lender} />
      <DataRow label="Mortgage Amount" value={r.mortgage_amount ? fmtDollar(r.mortgage_amount) : null} />
      <DataRow label="Mortgage Date" value={r.mortgage_date} />
      <DataRow label="Loan Type" value={r.mortgage_loan_type} />
      <DataRow label="Term" value={r.mortgage_term_months ? `${r.mortgage_term_months} months` : null} />
      <DataRow label="Due Date" value={r.mortgage_due_date} />
      <DataRow label="Deed Type" value={r.deed_type} />
      <DataRow label="Loan Balance" value={r.current_loan_balance ? fmtDollar(r.current_loan_balance) : null} />
      {r.ltv_ratio != null && <DataRow label="LTV Ratio" value={`${r.ltv_ratio}%`} color={ltvColor(r.ltv_ratio)} />}
      <DataRow label="Available Equity" value={r.available_equity ? fmtDollar(r.available_equity) : null} color={Colors.semantic.success} />
      <DataRow label="Lendable Equity" value={r.lendable_equity ? fmtDollar(r.lendable_equity) : null} />
      <DataRow label="Est. Monthly Payment" value={r.estimated_monthly_payment ? fmtDollar(r.estimated_monthly_payment) : null} />
    </>
  );
}

function ValuationSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      <DataRow label="Tax Market Value" value={r.tax_market_value ? fmtDollar(r.tax_market_value) : null} />
      <DataRow label="Tax Market Land" value={r.tax_market_land ? fmtDollar(r.tax_market_land) : null} />
      <DataRow label="Tax Market Improvement" value={r.tax_market_improvement ? fmtDollar(r.tax_market_improvement) : null} />
      <DataRow label="Assessed Total" value={r.tax_assessed_total ? fmtDollar(r.tax_assessed_total) : null} />
      <DataRow label="Assessed Land" value={r.tax_assessed_land ? fmtDollar(r.tax_assessed_land) : null} />
      <DataRow label="Assessed Improvement" value={r.tax_assessed_improvement ? fmtDollar(r.tax_assessed_improvement) : null} />
      <DataRow label="Annual Tax" value={r.annual_tax_amount ? `${fmtDollar(r.annual_tax_amount)}${r.tax_year ? ` (${r.tax_year})` : ''}` : null} />
      <DataRow label="Tax / SqFt" value={r.tax_per_sqft ? `${fmtDollar(r.tax_per_sqft)}/sqft` : null} />
      <SectionHeader title="AVM Estimate" />
      <DataRow label="AVM Value" value={r.estimated_value ? fmtDollar(r.estimated_value) : null} />
      {r.estimated_value_low && r.estimated_value_high && (
        <DataRow label="AVM Range" value={`${fmtDollar(r.estimated_value_low)} — ${fmtDollar(r.estimated_value_high)}`} />
      )}
      <DataRow label="AVM Confidence" value={r.avm_confidence_score ? `${r.avm_confidence_score}/100` : r.valuation_confidence} />
      <DataRow label="AVM $/SqFt" value={r.avm_price_per_sqft ? `${fmtDollar(r.avm_price_per_sqft)}/sqft` : null} />
    </>
  );
}

function SaleHistorySection({ r }: { r: Record<string, any> }) {
  return (
    <>
      <DataRow label="Last Sale Date" value={r.last_sale_date} />
      <DataRow label="Last Sale Amount" value={r.last_sale_amount ? fmtDollar(r.last_sale_amount) : null} />
      <DataRow label="Sale Type" value={r.last_sale_type} />
      <DataRow label="Cash or Mortgage" value={r.last_sale_cash_or_mortgage} />
      {r.last_sale_arms_length != null && <DataRow label="Arms Length" value={r.last_sale_arms_length ? 'Yes' : 'No'} />}
      <DataRow label="Price / SqFt" value={r.last_sale_price_per_sqft ? `${fmtDollar(r.last_sale_price_per_sqft)}/sqft` : null} />
      <DataRow label="Price / Bed" value={r.last_sale_price_per_bed ? `${fmtDollar(r.last_sale_price_per_bed)}/bed` : null} />
      {r.appreciation_pct != null && (
        <DataRow label="Appreciation" value={fmtPercent(r.appreciation_pct)} color={r.appreciation_pct >= 0 ? Colors.semantic.success : Colors.semantic.error} />
      )}
      {r.quit_claim_flag && <Badge label="Quit Claim" variant="amber" />}
      {Array.isArray(r.sale_history) && r.sale_history.length > 0 && (
        <>
          <SectionHeader title="Previous Sales" />
          {r.sale_history.map((sale: any, i: number) => (
            <MiniRow key={i} left={sale.date || '—'} right={sale.amount ? fmtDollar(sale.amount) : '—'} sub={sale.trans_type || ''} />
          ))}
        </>
      )}
    </>
  );
}

function RentalSection({ r }: { r: Record<string, any> }) {
  const propertyValue = r.property_value || r.tax_market_value || r.estimated_value;
  return (
    <>
      <DataRow label="Est. Rent" value={r.estimated_rent ? `${fmtDollar(r.estimated_rent)}/mo` : null} />
      {r.estimated_rent_low && r.estimated_rent_high && (
        <DataRow label="Rent Range" value={`${fmtDollar(r.estimated_rent_low)} — ${fmtDollar(r.estimated_rent_high)}`} />
      )}
      {propertyValue && r.estimated_rent && (
        <DataRow label="Gross Yield" value={fmtPercent((r.estimated_rent * 12 / propertyValue) * 100)} color={Colors.semantic.success} />
      )}
    </>
  );
}

function PermitsSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      {r.major_improvements_year && <DataRow label="Major Improvements" value={r.major_improvements_year} />}
      {Array.isArray(r.permit_signals) && r.permit_signals.map((p: any, i: number) => (
        <View key={i} style={s.permitRow}>
          <View style={s.permitHeader}>
            <Text style={s.permitDate}>{p.date || '—'}</Text>
            {p.status && <Badge label={p.status} />}
          </View>
          {p.description && <Text style={s.permitDesc} numberOfLines={2}>{p.description}</Text>}
          {p.type && <Text style={s.permitType}>{p.type}</Text>}
          {p.job_value && <Text style={s.permitValue}>Job Value: {fmtDollar(p.job_value)}</Text>}
        </View>
      ))}
    </>
  );
}

function SchoolsSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      <DataRow label="School District" value={r.school_district_name} />
      {Array.isArray(r.nearby_schools) && r.nearby_schools.map((sch: any, i: number) => (
        <MiniRow
          key={i}
          left={sch.name || '—'}
          right={sch.rating ? `${sch.rating}/10` : ''}
          sub={sch.distance || (sch.distance_miles ? `${sch.distance_miles} mi` : '')}
        />
      ))}
      <DataRow label="Neighborhood" value={r.neighborhood} />
      <DataRow label="Subdivision" value={r.subdivision} />
      <DataRow label="County" value={r.county} />
      <DataRow label="Zoning" value={r.zoning_type ? `${r.zoning_type}${r.zoning_code ? ` (${r.zoning_code})` : ''}` : null} />
      <DataRow label="Census Tract" value={r.census_tract} />
      {typeof r.latitude === 'number' && typeof r.longitude === 'number' && (
        <DataRow label="Coordinates" value={`${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`} />
      )}
    </>
  );
}

function ForeclosureSection({ r }: { r: Record<string, any> }) {
  return (
    <>
      {r.foreclosure_stage && r.foreclosure_stage !== 'none' && (
        <View style={s.badgeRow}>
          <Text style={s.dataLabel}>Stage</Text>
          <Badge label={r.foreclosure_stage.toUpperCase()} variant="red" />
        </View>
      )}
      {r.in_foreclosure && <DataRow label="In Foreclosure" value="Yes" color={Colors.semantic.error} />}
      {r.prior_foreclosure && <DataRow label="Prior Foreclosure" value="Yes" color={Colors.semantic.warning} />}
      {r.reo_flag && <Badge label="REO / Bank-Owned" variant="red" />}
      {Array.isArray(r.foreclosure_records) && r.foreclosure_records.map((fc: any, i: number) => (
        <View key={i} style={s.fcRecord}>
          <DataRow label="Filing Date" value={fc.recording_date} />
          <DataRow label="Type" value={fc.distress_type_label} />
          <DataRow label="Auction Date" value={fc.auction_date_time} color={Colors.semantic.error} />
          <DataRow label="Auction Location" value={fc.auction_location} />
          <DataRow label="Opening Bid" value={fc.opening_bid ? fmtDollar(fc.opening_bid) : null} />
          <DataRow label="Original Loan" value={fc.original_loan_amount ? fmtDollar(fc.original_loan_amount) : null} />
        </View>
      ))}
    </>
  );
}

// Section key → renderer
const SECTION_RENDERERS: Record<string, React.FC<{ r: Record<string, any> }>> = {
  overview: OverviewSection,
  ownership: OwnershipSection,
  mortgage: MortgageSection,
  valuation: ValuationSection,
  sale_history: SaleHistorySection,
  rental: RentalSection,
  permits: PermitsSection,
  schools: SchoolsSection,
  foreclosure: ForeclosureSection,
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PropertyCard({ record, onAction, isActive, enterDelay }: CardProps) {
  const r = record as Record<string, any>;
  const section = (r._cardSection as string) || 'overview';
  const sectionLabel = (r._sectionLabel as string) || 'Property Overview';
  const address = r.normalized_address || r.address || 'Unknown Address';
  const config = HERO_CONFIG[section] || HERO_CONFIG.overview;

  const handleMap = useCallback(() => {
    const lat = r.latitude;
    const lng = r.longitude;
    const url = lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    safeOpenURL(url);
    onAction('visit', record);
  }, [r.latitude, r.longitude, address, onAction, record]);

  // Hero: section-specific gradient + icon + label
  const heroContent = (
    <LinearGradient
      colors={config.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={s.heroInner}>
        <Ionicons name={config.icon as any} size={36} color={rgba(config.accent, 0.25)} />
        <View style={[s.heroBadge, { backgroundColor: rgba(config.accent, 0.2) }]}>
          <Text style={[s.heroBadgeText, { color: config.accent }]}>{propTypeLabel(r.property_type)}</Text>
        </View>
      </View>
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.heroScrim}>
        <Text style={s.heroLabel}>{sectionLabel}</Text>
        <Text style={s.heroAddress} numberOfLines={1}>{address}</Text>
      </LinearGradient>
    </LinearGradient>
  );

  // Actions
  const actionContent = (
    <>
      <ActionButton label="View on Map" icon="map-outline" onPress={handleMap} variant="primary" />
    </>
  );

  // Render the section
  const SectionRenderer = SECTION_RENDERERS[section] || OverviewSection;

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`${sectionLabel} for ${address}`}
      enterDelay={enterDelay}
    >
      <SectionRenderer r={r} />
    </BaseCard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 200;
const HERO_STYLE: ViewStyle = { height: HERO_HEIGHT, aspectRatio: undefined };

const s = StyleSheet.create({
  // Hero
  heroInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  heroBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },

  // Value block
  valueBlock: { marginBottom: Spacing.md },
  valueBig: { fontSize: 28, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  valueSource: { fontSize: 12, color: Colors.text.muted, marginTop: 2, letterSpacing: 0.3 },

  // Metrics
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.default },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface.cardBorder, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  metricValue: { fontSize: 14, fontWeight: '700', color: Colors.text.primary },
  metricLabel: { fontSize: 11, color: Colors.text.muted },

  // Section headers
  sectionHeader: { marginTop: 16, paddingTop: Spacing.sm, marginBottom: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border.default },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: Colors.text.muted, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Data rows
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 5, gap: Spacing.md },
  dataLabel: { fontSize: 13, color: Colors.text.muted, flex: 1 },
  dataValue: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, flex: 1.5, textAlign: 'right' },

  // Badges
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },

  // Mini rows
  miniRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: Spacing.xs, backgroundColor: Colors.surface.cardBorder, borderRadius: 4, gap: Spacing.sm, marginBottom: 2 },
  miniLeft: { fontSize: 12, color: Colors.text.secondary, flex: 1 },
  miniRight: { fontSize: 12, fontWeight: '600', color: Colors.text.primary },
  miniSub: { fontSize: 11, color: Colors.text.muted, maxWidth: 80, textAlign: 'right' },

  // Permits
  permitRow: { paddingVertical: Spacing.sm, gap: 2 },
  permitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  permitDate: { fontSize: 12, color: Colors.text.secondary },
  permitDesc: { fontSize: 13, color: Colors.text.primary },
  permitType: { fontSize: 11, color: Colors.text.muted },
  permitValue: { fontSize: 12, color: Colors.semantic.success },

  // Foreclosure
  fcRecord: { paddingVertical: Spacing.sm, marginLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: Colors.semantic.error, paddingLeft: Spacing.sm, marginBottom: Spacing.xs },
});

export default PropertyCard;
