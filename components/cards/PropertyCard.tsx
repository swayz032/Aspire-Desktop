/**
 * PropertyCard — Full property intelligence dossier card.
 *
 * Renders ALL ATTOM data: owner, mortgage, equity, tax, sale history,
 * permits, comps, schools, foreclosure, zoning. Scrollable within a
 * fixed-height card so all cards in the carousel are the same size.
 *
 * Composes with BaseCard. Uses premium section design:
 * - Section headers: uppercase, muted, letter-spacing
 * - Data rows: label + value two-column layout
 * - Color coding: LTV green/amber/red, foreclosure red accent
 * - Empty fields hidden (no "N/A" clutter)
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, type ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL } from '@/lib/safeOpenURL';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import type { CardProps } from './CardRegistry';
import { fmtDollar, fmtSqft, fmtPercent } from './helpers';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Section header with divider line above */
function SectionHeader({ title, accent }: { title: string; accent?: string }) {
  return (
    <View style={[s.sectionHeader, accent === 'red' && s.sectionHeaderRed]}>
      <Text style={[s.sectionTitle, accent === 'red' && s.sectionTitleRed]}>
        {title}
      </Text>
    </View>
  );
}

/** Two-column data row: label (muted) + value (white) */
function DataRow({ label, value, color }: { label: string; value: string | number | undefined | null; color?: string }) {
  if (value == null || value === '' || value === 0) return null;
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel} numberOfLines={1}>{label}</Text>
      <Text style={[s.dataValue, color ? { color } : undefined]} numberOfLines={2}>
        {String(value)}
      </Text>
    </View>
  );
}

/** Badge pill (Owner Occupied, Absentee, Corporate, etc.) */
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

/** Horizontal metric chip (icon + value) */
function MetricChip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <View style={s.metricChip} accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon as any} size={14} color={Colors.text.muted} />
      <Text style={s.metricValue}>{String(value)}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

/** LTV color: green <80%, amber 80-90%, red >90% */
function ltvColor(ltv: number): string {
  if (ltv < 80) return Colors.semantic.success;
  if (ltv < 90) return Colors.semantic.warning;
  return Colors.semantic.error;
}

/** Property type icon mapping */
function propIcon(propType: string): string {
  const t = (propType || '').toLowerCase();
  if (t.includes('condo') || t.includes('town')) return 'business-outline';
  if (t.includes('multi') || t.includes('duplex') || t.includes('triplex')) return 'layers-outline';
  if (t.includes('land') || t.includes('vacant')) return 'map-outline';
  return 'home-outline';
}

/** Human-readable property type */
function propTypeLabel(propType: string): string {
  const t = (propType || '').toLowerCase();
  if (t.includes('sfr') || t.includes('single')) return 'Single Family';
  if (t.includes('condo')) return 'Condo';
  if (t.includes('town')) return 'Townhouse';
  if (t.includes('multi') || t.includes('duplex')) return 'Multi-Family';
  if (t.includes('land') || t.includes('vacant')) return 'Vacant Land';
  return propType || 'Residential';
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PropertyCard({ record, onAction, isActive, enterDelay }: CardProps) {
  const r = record as Record<string, any>;

  // Identity
  const address = r.normalized_address || r.address || 'Unknown Address';
  const propType = r.property_type || '';

  // Key metrics
  const propertyValue = r.property_value || r.tax_market_value || r.estimated_value;
  const valueSource = r.property_value_source === 'county_tax_assessment' ? 'County Assessment'
    : r.property_value_source === 'avm_estimate' ? 'AVM Estimate'
    : r.tax_market_value ? 'County Assessment' : 'Estimated';

  const handleMap = useCallback(() => {
    const lat = r.latitude;
    const lng = r.longitude;
    const url = lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    safeOpenURL(url);
    onAction('visit', record);
  }, [r.latitude, r.longitude, address, onAction, record]);

  const handleDetails = useCallback(() => {
    onAction('details', record);
  }, [onAction, record]);

  // ── Hero ──
  const heroContent = (
    <LinearGradient
      colors={['#1a2744', '#0f1923']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFillObject}
    >
      <View style={s.heroInner}>
        <Ionicons name={propIcon(propType) as any} size={40} color="rgba(255,255,255,0.15)" />
        <View style={s.heroBadge}>
          <Text style={s.heroBadgeText}>{propTypeLabel(propType)}</Text>
        </View>
      </View>
      {/* Address overlay at bottom */}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={s.heroScrim}>
        <Text style={s.heroAddress} numberOfLines={2}>{address}</Text>
      </LinearGradient>
    </LinearGradient>
  );

  // ── Actions ──
  const actionContent = (
    <>
      <ActionButton label="View on Map" icon="map-outline" onPress={handleMap} variant="primary" />
      <ActionButton label="Full Report" icon="document-text-outline" onPress={handleDetails} variant="secondary" />
    </>
  );

  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={heroContent}
      heroStyle={HERO_STYLE}
      actionSlot={actionContent}
      accessibilityLabel={`Property dossier for ${address}`}
      enterDelay={enterDelay}
    >
      <ScrollView
        style={s.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* ── Primary Value ── */}
        {propertyValue != null && (
          <View style={s.valueBlock}>
            <Text style={s.valueBig}>{fmtDollar(propertyValue)}</Text>
            <Text style={s.valueSource}>{valueSource}</Text>
          </View>
        )}

        {/* ── Key Metrics Row ── */}
        <View style={s.metricsRow}>
          {r.beds != null && <MetricChip icon="bed-outline" value={r.beds} label="Beds" />}
          {r.baths != null && <MetricChip icon="water-outline" value={r.baths} label="Baths" />}
          {r.living_sqft != null && <MetricChip icon="resize-outline" value={fmtSqft(r.living_sqft)} label="" />}
          {r.year_built != null && <MetricChip icon="calendar-outline" value={r.year_built} label="Built" />}
        </View>

        {/* ── Property Details ── */}
        <SectionHeader title="Property Details" />
        <DataRow label="Lot Size" value={r.lot_sqft ? fmtSqft(r.lot_sqft) : null} />
        <DataRow label="Stories" value={r.stories} />
        <DataRow label="Quality" value={r.quality} />
        <DataRow label="Construction" value={r.construction_frame} />
        <DataRow label="Roof" value={r.roof_cover} />
        <DataRow label="Zoning" value={r.zoning_type ? `${r.zoning_type}${r.zoning_code ? ` (${r.zoning_code})` : ''}` : null} />
        <DataRow label="County" value={r.county} />
        <DataRow label="Neighborhood" value={r.neighborhood || r.subdivision} />
        {r.units_count != null && r.units_count > 1 && <DataRow label="Units" value={r.units_count} />}
        {r.attic_sqft != null && <DataRow label="Attic" value={fmtSqft(r.attic_sqft)} />}

        {/* ── Ownership ── */}
        {(r.owner_name || r.owner_type) && (
          <>
            <SectionHeader title="Ownership" />
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
                <Badge
                  label={r.absentee_owner_indicator ? 'Absentee Owner' : 'Owner Occupied'}
                  variant={r.absentee_owner_indicator ? 'amber' : 'green'}
                />
              </View>
            )}
            <DataRow label="Mailing Address" value={r.mailing_address} />
            <DataRow label="Previous Owner" value={r.previous_owner_name} />
            {r.homeowner_exemption != null && (
              <DataRow label="Homeowner Exemption" value={r.homeowner_exemption ? 'Yes' : 'No'} />
            )}
          </>
        )}

        {/* ── Mortgage & Equity ── */}
        {(r.mortgage_lender || r.mortgage_amount || r.ltv_ratio != null) && (
          <>
            <SectionHeader title="Mortgage & Equity" />
            <DataRow label="Lender" value={r.mortgage_lender} />
            <DataRow label="Mortgage Amount" value={r.mortgage_amount ? fmtDollar(r.mortgage_amount) : null} />
            <DataRow label="Mortgage Date" value={r.mortgage_date} />
            <DataRow label="Loan Type" value={r.mortgage_loan_type} />
            <DataRow label="Term" value={r.mortgage_term_months ? `${r.mortgage_term_months} months` : null} />
            <DataRow label="Due Date" value={r.mortgage_due_date} />
            <DataRow label="Deed Type" value={r.deed_type} />
            <DataRow label="Loan Balance" value={r.current_loan_balance ? fmtDollar(r.current_loan_balance) : null} />
            {r.ltv_ratio != null && (
              <DataRow label="LTV Ratio" value={`${r.ltv_ratio}%`} color={ltvColor(r.ltv_ratio)} />
            )}
            <DataRow label="Available Equity" value={r.available_equity ? fmtDollar(r.available_equity) : null} color={Colors.semantic.success} />
            <DataRow label="Lendable Equity" value={r.lendable_equity ? fmtDollar(r.lendable_equity) : null} />
            <DataRow label="Est. Monthly Payment" value={r.estimated_monthly_payment ? fmtDollar(r.estimated_monthly_payment) : null} />
          </>
        )}

        {/* ── Valuation & Tax ── */}
        <SectionHeader title="Valuation & Tax" />
        <DataRow label="Tax Market Value" value={r.tax_market_value ? fmtDollar(r.tax_market_value) : null} />
        <DataRow label="Tax Market Land" value={r.tax_market_land ? fmtDollar(r.tax_market_land) : null} />
        <DataRow label="Tax Market Improvement" value={r.tax_market_improvement ? fmtDollar(r.tax_market_improvement) : null} />
        <DataRow label="Assessed Total" value={r.tax_assessed_total ? fmtDollar(r.tax_assessed_total) : null} />
        <DataRow label="Assessed Land" value={r.tax_assessed_land ? fmtDollar(r.tax_assessed_land) : null} />
        <DataRow label="Assessed Improvement" value={r.tax_assessed_improvement ? fmtDollar(r.tax_assessed_improvement) : null} />
        <DataRow label="Annual Tax" value={r.annual_tax_amount ? `${fmtDollar(r.annual_tax_amount)}${r.tax_year ? ` (${r.tax_year})` : ''}` : null} />
        <DataRow label="Tax / SqFt" value={r.tax_per_sqft ? `${fmtDollar(r.tax_per_sqft)}/sqft` : null} />
        <DataRow label="AVM Estimate" value={r.estimated_value ? fmtDollar(r.estimated_value) : null} />
        {r.estimated_value_low && r.estimated_value_high && (
          <DataRow label="AVM Range" value={`${fmtDollar(r.estimated_value_low)} — ${fmtDollar(r.estimated_value_high)}`} />
        )}
        <DataRow label="AVM Confidence" value={r.avm_confidence_score ? `${r.avm_confidence_score}/100` : r.valuation_confidence} />
        <DataRow label="AVM $/SqFt" value={r.avm_price_per_sqft ? `${fmtDollar(r.avm_price_per_sqft)}/sqft` : null} />

        {/* ── Sale History ── */}
        {(r.last_sale_date || r.last_sale_amount) && (
          <>
            <SectionHeader title="Sale History" />
            <DataRow label="Last Sale Date" value={r.last_sale_date} />
            <DataRow label="Last Sale Amount" value={r.last_sale_amount ? fmtDollar(r.last_sale_amount) : null} />
            <DataRow label="Sale Type" value={r.last_sale_type} />
            <DataRow label="Cash or Mortgage" value={r.last_sale_cash_or_mortgage} />
            {r.last_sale_arms_length != null && (
              <DataRow label="Arms Length" value={r.last_sale_arms_length ? 'Yes' : 'No'} />
            )}
            <DataRow label="Doc Number" value={r.last_sale_doc_number} />
            <DataRow label="Price / SqFt" value={r.last_sale_price_per_sqft ? `${fmtDollar(r.last_sale_price_per_sqft)}/sqft` : null} />
            <DataRow label="Price / Bed" value={r.last_sale_price_per_bed ? `${fmtDollar(r.last_sale_price_per_bed)}/bed` : null} />
            {r.appreciation_pct != null && (
              <DataRow
                label="Appreciation"
                value={fmtPercent(r.appreciation_pct)}
                color={r.appreciation_pct >= 0 ? Colors.semantic.success : Colors.semantic.error}
              />
            )}
            {r.quit_claim_flag && <Badge label="Quit Claim" variant="amber" />}
          </>
        )}

        {/* Previous Sales Table */}
        {Array.isArray(r.sale_history) && r.sale_history.length > 0 && (
          <View style={s.miniTable}>
            {r.sale_history.map((sale: any, i: number) => (
              <View key={i} style={s.miniRow}>
                <Text style={s.miniDate}>{sale.date || '—'}</Text>
                <Text style={s.miniAmount}>{sale.amount ? fmtDollar(sale.amount) : '—'}</Text>
                <Text style={s.miniType}>{sale.trans_type || ''}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Rental Intelligence ── */}
        {r.estimated_rent != null && (
          <>
            <SectionHeader title="Rental Intelligence" />
            <DataRow label="Est. Rent" value={`${fmtDollar(r.estimated_rent)}/mo`} />
            {r.estimated_rent_low && r.estimated_rent_high && (
              <DataRow label="Rent Range" value={`${fmtDollar(r.estimated_rent_low)} — ${fmtDollar(r.estimated_rent_high)}`} />
            )}
            {propertyValue && r.estimated_rent && (
              <DataRow
                label="Gross Yield"
                value={fmtPercent((r.estimated_rent * 12 / propertyValue) * 100)}
                color={Colors.semantic.success}
              />
            )}
          </>
        )}

        {/* ── Permits ── */}
        {Array.isArray(r.permit_signals) && r.permit_signals.length > 0 && (
          <>
            <SectionHeader title="Permits & Improvements" />
            {r.major_improvements_year && (
              <DataRow label="Major Improvements" value={r.major_improvements_year} />
            )}
            {r.permit_signals.map((p: any, i: number) => (
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
        )}

        {/* ── Schools & Location ── */}
        {(r.school_district_name || (Array.isArray(r.nearby_schools) && r.nearby_schools.length > 0) || r.neighborhood) && (
          <>
            <SectionHeader title="Schools & Location" />
            <DataRow label="School District" value={r.school_district_name} />
            {Array.isArray(r.nearby_schools) && r.nearby_schools.map((sch: any, i: number) => (
              <View key={i} style={s.miniRow}>
                <Text style={s.miniDate}>{sch.name || '—'}</Text>
                <Text style={s.miniAmount}>{sch.rating ? `${sch.rating}/10` : ''}</Text>
                <Text style={s.miniType}>{sch.distance || ''}</Text>
              </View>
            ))}
            <DataRow label="Neighborhood" value={r.neighborhood} />
            <DataRow label="Subdivision" value={r.subdivision} />
            <DataRow label="Census Tract" value={r.census_tract} />
            {r.school_context && <Text style={s.contextText}>{r.school_context}</Text>}
          </>
        )}

        {/* ── Comps ── */}
        {Array.isArray(r.nearby_comps) && r.nearby_comps.length > 0 && (
          <>
            <SectionHeader title="Comparable Sales" />
            {r.nearby_comps.map((comp: any, i: number) => (
              <View key={i} style={s.miniRow}>
                <Text style={s.miniDate} numberOfLines={1}>{comp.address || comp.oneLine || '—'}</Text>
                <Text style={s.miniAmount}>{comp.saleamt || comp.amount ? fmtDollar(comp.saleamt || comp.amount) : '—'}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Distress & Foreclosure ── */}
        {(r.foreclosure_stage && r.foreclosure_stage !== 'none') || r.in_foreclosure || r.reo_flag ? (
          <>
            <SectionHeader title="Distress & Foreclosure" accent="red" />
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
                <DataRow label="Doc #" value={fc.document_number} />
              </View>
            ))}
          </>
        ) : null}

        {/* ── Additional Details ── */}
        <SectionHeader title="Additional Details" />
        <DataRow label="Parcel APN" value={r.parcel_apn} />
        <DataRow label="FIPS" value={r.parcel_fips} />
        <DataRow label="ATTOM ID" value={r.attom_id} />
        {typeof r.latitude === 'number' && typeof r.longitude === 'number' && (
          <DataRow label="Coordinates" value={`${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`} />
        )}
        <DataRow label="Source Updated" value={r.source_last_modified} />
        {r.verification_status && (
          <View style={s.badgeRow}>
            <Text style={s.dataLabel}>Verification</Text>
            <Badge
              label={`${r.verification_status}${r.confidence ? ` (${(r.confidence * 100).toFixed(0)}%)` : ''}`}
              variant={r.verification_status === 'verified' ? 'green' : 'default'}
            />
          </View>
        )}

        {/* Bottom spacer for scroll */}
        <View style={{ height: Spacing.lg }} />
      </ScrollView>
    </BaseCard>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 200; // Matches HotelCard/ProductCard for consistent card sizing
const HERO_STYLE: ViewStyle = { height: HERO_HEIGHT, aspectRatio: undefined };
const SCROLL_MAX_HEIGHT = 400; // Content scrolls within card; total card ~700px

const s = StyleSheet.create({
  // Hero
  heroInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  heroBadge: {
    backgroundColor: 'rgba(59,130,246,0.25)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  heroBadgeText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
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
  heroAddress: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },

  // Scrollable content
  scrollContent: {
    maxHeight: SCROLL_MAX_HEIGHT,
  },

  // Primary value block
  valueBlock: {
    marginBottom: Spacing.md,
  },
  valueBig: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  valueSource: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
    letterSpacing: 0.3,
  },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border.default,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metricLabel: {
    fontSize: 11,
    color: Colors.text.muted,
  },

  // Section headers
  sectionHeader: {
    marginTop: 20,
    paddingTop: Spacing.md,
    marginBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border.default,
  },
  sectionHeaderRed: {
    borderTopColor: Colors.semantic.error,
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.error,
    paddingLeft: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitleRed: {
    color: Colors.semantic.error,
  },

  // Data rows
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    gap: Spacing.md,
  },
  dataLabel: {
    fontSize: 13,
    color: Colors.text.muted,
    flex: 1,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1.5,
    textAlign: 'right',
  },

  // Badges
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Mini table (sale history, comps, schools)
  miniTable: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  miniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.surface.cardBorder,
    borderRadius: 4,
    gap: Spacing.sm,
  },
  miniDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    flex: 1,
  },
  miniAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  miniType: {
    fontSize: 11,
    color: Colors.text.muted,
    maxWidth: 80,
    textAlign: 'right',
  },

  // Permits
  permitRow: {
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  permitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permitDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  permitDesc: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  permitType: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  permitValue: {
    fontSize: 12,
    color: Colors.semantic.success,
  },

  // Foreclosure record
  fcRecord: {
    paddingVertical: Spacing.sm,
    marginLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.semantic.error,
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  // Context text
  contextText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
});

export default PropertyCard;
