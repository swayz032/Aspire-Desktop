/**
 * PropertyCard — Section-based property intelligence cards.
 *
 * Each card renders ONE section of the property dossier based on
 * record._cardSection. The useAvaPresents hook splits a single property
 * record into multiple section cards so the user swipes through:
 *   Overview → Ownership → Mortgage → Valuation → Sale History → ...
 *
 * Two layouts share the same per-section data:
 *   • Vertical (500x580): legacy hero-on-top + scrollable detail rows.
 *     Section-tinted gradient hero with icon + scrim (preserved verbatim
 *     so the BaseCard.fixed-height test contract continues to pass).
 *   • Horizontal (880x440): premium ProductCard-aligned layout with a
 *     Street View hero on the left and a 300px info stack on the right.
 *     The right-side stack is section-aware: the "headline number" and
 *     stats row vary by section while the chrome (title/sub/buttons)
 *     stays locked to the ProductCard rhythm.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius } from '@/constants/tokens';
import { safeOpenURL } from '@/lib/safeOpenURL';
import { ActionButton } from './ActionButton';
import { BaseCard } from './BaseCard';
import { ImageSkeleton } from './ImageSkeleton';
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
// Section Renderers (vertical layout — unchanged)
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
// Horizontal layout — section-aware "headline" shape
// ---------------------------------------------------------------------------

/**
 * Each section produces a different big-number / qualifier / stats triplet.
 * Returning null means "skip this row" — the layout handles missing data
 * gracefully so empty sections don't ship awkward whitespace.
 */
interface HorizontalHeadline {
  bigValue: string | null;
  bigQualifier: string | null;
  /** Additional small qualifier underneath the big number (e.g. AVM range). */
  bigSubline?: string | null;
  /** Optional accent color for the big number. Defaults to success green. */
  bigColor?: string;
  /**
   * Type of the big value. 'number' = price/percentage display weight (22px,
   * green by default). 'text' = prose / name display weight (17px, primary
   * color by default). The renderer uses this to pick the right type scale
   * so the rhythm stays balanced regardless of content.
   */
  bigStyle?: 'number' | 'text';
  /** Up to ~4 stat chips, in display order. */
  stats: Array<{ icon: string; value: string; label: string } | null>;
  /** Optional inline pill (small badge above the stats — e.g. AVM confidence). */
  pill?: { label: string; variant?: 'default' | 'green' | 'amber' | 'red' } | null;
  /** Optional bottom owner / footnote line — small text, muted. */
  footnote?: string | null;
}

function buildHeadline(section: string, r: Record<string, any>): HorizontalHeadline {
  switch (section) {
    case 'mortgage': {
      // Headline = lender name (the "who"). Money goes in stats so the story
      // reads "Wells Fargo · 360mo · $1,420/mo" rather than leading with a
      // dollar amount that competes with the address.
      const lender = typeof r.mortgage_lender === 'string' && r.mortgage_lender.trim() ? r.mortgage_lender : null;
      const ltvBadge = r.ltv_ratio != null
        ? { label: `LTV ${r.ltv_ratio}%`, variant: r.ltv_ratio < 80 ? 'green' as const : r.ltv_ratio < 90 ? 'amber' as const : 'red' as const }
        : null;
      return {
        bigValue: lender || (r.mortgage_amount ? fmtDollar(r.mortgage_amount) : null),
        bigQualifier: lender ? 'Lender of Record' : 'Mortgage',
        bigSubline: r.mortgage_date ? `Originated ${r.mortgage_date}` : null,
        bigStyle: lender ? 'text' : 'number',
        stats: [
          r.mortgage_amount ? { icon: 'cash-outline', value: fmtDollar(r.mortgage_amount), label: 'Amount' } : null,
          r.mortgage_term_months ? { icon: 'time-outline', value: `${r.mortgage_term_months}mo`, label: 'Term' } : null,
          r.estimated_monthly_payment ? { icon: 'calendar-outline', value: fmtDollar(r.estimated_monthly_payment), label: '/mo' } : null,
          r.available_equity ? { icon: 'trending-up-outline', value: fmtDollar(r.available_equity), label: 'Equity' } : null,
        ],
        pill: ltvBadge,
        footnote: r.mortgage_loan_type ? `Loan type: ${r.mortgage_loan_type}` : null,
      };
    }

    case 'valuation': {
      const big = r.estimated_value || r.tax_market_value;
      const range = (r.estimated_value_low && r.estimated_value_high)
        ? `${fmtDollar(r.estimated_value_low)} — ${fmtDollar(r.estimated_value_high)}`
        : null;
      const confidence = r.avm_confidence_score ? `AVM Confidence ${r.avm_confidence_score}/100` : null;
      return {
        bigValue: big ? fmtDollar(big) : null,
        bigQualifier: r.estimated_value ? 'AVM Estimate' : 'Tax Market Value',
        bigSubline: range,
        stats: [
          r.tax_assessed_total ? { icon: 'document-text-outline', value: fmtDollar(r.tax_assessed_total), label: 'Assessed' } : null,
          r.annual_tax_amount ? { icon: 'cash-outline', value: fmtDollar(r.annual_tax_amount), label: 'Tax/yr' } : null,
          r.avm_price_per_sqft ? { icon: 'resize-outline', value: `${fmtDollar(r.avm_price_per_sqft)}`, label: '/sqft' } : null,
        ],
        pill: confidence ? { label: confidence } : null,
        footnote: r.tax_year ? `Tax year ${r.tax_year}` : null,
      };
    }

    case 'sale_history': {
      // Headline = the event ("Sold Mar 2024"). Sale amount is the most
      // relevant stat so it leads the chip row.
      const headlineText = r.last_sale_date ? `Sold ${r.last_sale_date}` : (r.last_sale_amount ? fmtDollar(r.last_sale_amount) : null);
      return {
        bigValue: headlineText,
        bigQualifier: 'Last Sale',
        bigSubline: r.last_sale_type || null,
        bigStyle: r.last_sale_date ? 'text' : 'number',
        stats: [
          r.last_sale_amount ? { icon: 'cash-outline', value: fmtDollar(r.last_sale_amount), label: 'Amount' } : null,
          r.last_sale_price_per_sqft ? { icon: 'resize-outline', value: `${fmtDollar(r.last_sale_price_per_sqft)}`, label: '/sqft' } : null,
          r.appreciation_pct != null ? { icon: 'trending-up-outline', value: fmtPercent(r.appreciation_pct), label: 'Appr.' } : null,
          r.last_sale_cash_or_mortgage ? { icon: 'card-outline', value: String(r.last_sale_cash_or_mortgage), label: '' } : null,
        ],
        pill: r.quit_claim_flag ? { label: 'Quit Claim', variant: 'amber' } : null,
        footnote: Array.isArray(r.sale_history) && r.sale_history.length > 1
          ? `${r.sale_history.length} sales on record`
          : null,
      };
    }

    case 'ownership': {
      const ownerType = r.owner_type === 'Y' ? 'Corporate' : r.owner_type ? 'Individual' : null;
      const occupancy = r.absentee_owner_indicator != null
        ? (r.absentee_owner_indicator ? 'Absentee Owner' : 'Owner Occupied')
        : null;
      const occVariant: 'amber' | 'green' | 'default' = r.absentee_owner_indicator
        ? 'amber'
        : r.absentee_owner_indicator === false
          ? 'green'
          : 'default';
      return {
        bigValue: typeof r.owner_name === 'string' && r.owner_name.trim() ? r.owner_name : null,
        bigQualifier: 'Owner of Record',
        bigSubline: ownerType,
        bigStyle: 'text',
        stats: [],
        pill: occupancy ? { label: occupancy, variant: occVariant } : null,
        footnote: r.mailing_address ? `Mailing: ${r.mailing_address}` : null,
      };
    }

    case 'rental': {
      const propertyValue = r.property_value || r.tax_market_value || r.estimated_value;
      const yieldPct = (propertyValue && r.estimated_rent)
        ? (r.estimated_rent * 12 / propertyValue) * 100
        : null;
      return {
        bigValue: r.estimated_rent ? `${fmtDollar(r.estimated_rent)}/mo` : null,
        bigQualifier: 'Estimated Rent',
        bigSubline: (r.estimated_rent_low && r.estimated_rent_high)
          ? `${fmtDollar(r.estimated_rent_low)} — ${fmtDollar(r.estimated_rent_high)}`
          : null,
        stats: [
          yieldPct != null ? { icon: 'trending-up-outline', value: fmtPercent(yieldPct), label: 'Gross Yield' } : null,
        ],
        pill: null,
      };
    }

    case 'permits': {
      const permits = Array.isArray(r.permit_signals) ? r.permit_signals : [];
      const totalValue = permits.reduce((sum: number, p: any) => sum + (Number(p.job_value) || 0), 0);
      return {
        // Permit count is a small integer — keep numeric weight so the
        // count reads like a metric.
        bigValue: permits.length > 0 ? String(permits.length) : null,
        bigQualifier: permits.length === 1 ? 'Permit on Record' : 'Permits on Record',
        bigStyle: 'number',
        bigColor: Colors.text.primary,
        bigSubline: r.major_improvements_year ? `Major work ${r.major_improvements_year}` : null,
        stats: [
          totalValue > 0 ? { icon: 'cash-outline', value: fmtDollar(totalValue), label: 'Total job value' } : null,
        ],
        pill: null,
      };
    }

    case 'schools': {
      const schools = Array.isArray(r.nearby_schools) ? r.nearby_schools : [];
      const top = schools[0];
      return {
        bigValue: r.school_district_name || (top ? top.name : null),
        bigQualifier: r.school_district_name ? 'School District' : (top ? 'Nearest School' : null),
        bigStyle: 'text',
        bigSubline: schools.length > 0
          ? `${schools.length} nearby school${schools.length === 1 ? '' : 's'}`
          : null,
        stats: [
          top?.rating ? { icon: 'school-outline', value: `${top.rating}/10`, label: top.name || 'Top school' } : null,
        ],
        pill: null,
      };
    }

    case 'foreclosure': {
      const stage = typeof r.foreclosure_stage === 'string' && r.foreclosure_stage !== 'none'
        ? r.foreclosure_stage.toUpperCase()
        : null;
      const records = Array.isArray(r.foreclosure_records) ? r.foreclosure_records : [];
      const next = records[0];
      return {
        bigValue: stage,
        bigQualifier: 'Foreclosure Stage',
        bigColor: Colors.semantic.error,
        bigSubline: next?.auction_date_time ? `Auction ${next.auction_date_time}` : null,
        stats: [
          next?.opening_bid ? { icon: 'pricetag-outline', value: fmtDollar(next.opening_bid), label: 'Opening bid' } : null,
          next?.original_loan_amount ? { icon: 'wallet-outline', value: fmtDollar(next.original_loan_amount), label: 'Original loan' } : null,
        ],
        pill: r.reo_flag ? { label: 'REO / Bank-Owned', variant: 'red' } : null,
        footnote: next?.auction_location || null,
      };
    }

    case 'overview':
    default: {
      const propertyValue = r.property_value || r.tax_market_value || r.estimated_value || r.last_sale_amount;
      const valueSource = r.property_value_source === 'county_tax_assessment' ? 'Tax Assessed'
        : r.property_value_source === 'avm_estimate' ? 'AVM Estimate'
        : r.tax_market_value ? 'Tax Assessed'
        : r.estimated_value ? 'AVM Estimate'
        : r.last_sale_amount ? 'Last Sale'
        : 'Estimated';
      return {
        bigValue: propertyValue != null ? fmtDollar(propertyValue) : null,
        bigQualifier: valueSource,
        stats: [
          r.beds != null ? { icon: 'bed-outline', value: String(r.beds), label: r.beds === 1 ? 'Bed' : 'Beds' } : null,
          r.baths != null ? { icon: 'water-outline', value: String(r.baths), label: r.baths === 1 ? 'Bath' : 'Baths' } : null,
          r.living_sqft != null ? { icon: 'resize-outline', value: fmtSqft(r.living_sqft), label: '' } : null,
          r.year_built != null ? { icon: 'calendar-outline', value: String(r.year_built), label: 'Built' } : null,
        ],
        pill: null,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const STREETVIEW_BASE = 'https://www.aspireos.app/v1/places/streetview';

/**
 * Build the Street View proxy URL for a property. The proxy whitelist requires
 * printable ASCII so we strip anything that doesn't match. Falls back to
 * lat/lng if the address sanitises to empty.
 */
function buildStreetViewUrl(r: Record<string, any>): string | null {
  const raw = (r.normalized_address || r.address || '') as string;
  // Server whitelist: A-Z a-z 0-9 space , . - # ' /
  const sanitised = String(raw).replace(/[^A-Za-z0-9\s,.\-#'/]/g, '').trim();
  if (sanitised) {
    return `${STREETVIEW_BASE}?address=${encodeURIComponent(sanitised)}&w=600&h=400`;
  }
  if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
    return `${STREETVIEW_BASE}?lat=${r.latitude}&lng=${r.longitude}&w=600&h=400`;
  }
  return null;
}

export function PropertyCard({ record, onAction, isActive, enterDelay, orientation }: CardProps) {
  const r = record as Record<string, any>;
  const section = (r._cardSection as string) || 'overview';
  const sectionLabel = (r._sectionLabel as string) || 'Property Overview';
  const address = r.normalized_address || r.address || 'Unknown Address';
  const config = HERO_CONFIG[section] || HERO_CONFIG.overview;
  const isHorizontal = orientation === 'horizontal';

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

  // ── Vertical hero (legacy, unchanged for back-compat) ──────────────────
  const verticalHero = (
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

  // ── Horizontal layout (880x440) ────────────────────────────────────────
  if (isHorizontal) {
    return (
      <BaseCard
        safety={null}
        isActive={isActive}
        heroSlot={
          <PropertyHorizontalHero
            r={r}
            sectionLabel={sectionLabel}
            address={address}
            config={config}
            onPress={handleDetails}
          />
        }
        actionSlot={
          <>
            <ActionButton
              label="View details"
              icon="chevron-forward"
              onPress={handleDetails}
              variant="primary"
            />
            <ActionButton
              label="Open in Maps"
              icon="map-outline"
              onPress={handleMap}
              variant="secondary"
            />
          </>
        }
        accessibilityLabel={`${sectionLabel} for ${address}`}
        enterDelay={enterDelay}
        orientation="horizontal"
      >
        <PropertyHorizontalStack r={r} section={section} address={address} />
      </BaseCard>
    );
  }

  // ── Vertical layout (legacy 500x580) ──────────────────────────────────
  const SectionRenderer = SECTION_RENDERERS[section] || OverviewSection;
  return (
    <BaseCard
      safety={null}
      isActive={isActive}
      heroSlot={verticalHero}
      heroStyle={HERO_STYLE}
      actionSlot={
        <ActionButton label="View on Map" icon="map-outline" onPress={handleMap} variant="primary" />
      }
      accessibilityLabel={`${sectionLabel} for ${address}`}
      enterDelay={enterDelay}
      orientation={orientation}
    >
      <SectionRenderer r={r} />
    </BaseCard>
  );
}

// ---------------------------------------------------------------------------
// Horizontal hero (Street View, with graceful fallback)
// ---------------------------------------------------------------------------

interface PropertyHorizontalHeroProps {
  r: Record<string, any>;
  sectionLabel: string;
  address: string;
  config: { icon: string; gradient: [string, string]; accent: string };
  onPress: () => void;
}

function PropertyHorizontalHero({ r, sectionLabel, address, config, onPress }: PropertyHorizontalHeroProps) {
  const streetViewUrl = buildStreetViewUrl(r);
  const [imageLoaded, setImageLoaded] = useState(false);
  // Track whether Street View imagery is available. The proxy returns 404
  // for addresses with no street-level photos (rural / gated). On error we
  // swap to the section-tinted gradient hero so we never render a broken
  // image icon.
  const [streetViewFailed, setStreetViewFailed] = useState(false);

  const showImage = !!streetViewUrl && !streetViewFailed;

  return (
    <Pressable
      onPress={onPress}
      style={hh.pressable}
      accessibilityRole="button"
      accessibilityLabel={`Open details for ${address}`}
      testID="property-card-horizontal-hero"
    >
      {showImage ? (
        <>
          <ImageSkeleton loaded={imageLoaded} />
          <Image
            key={streetViewUrl}
            source={{ uri: streetViewUrl as string }}
            style={StyleSheet.absoluteFillObject}
            // Street View photos are wide landscape — cover crops cleanly
            // to fill the 580x440 hero. (Product photos use `contain`
            // because they're square and would lose tops/bottoms.)
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Street view of ${address}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setStreetViewFailed(true)}
          />
        </>
      ) : (
        <LinearGradient
          colors={config.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        >
          <View style={hh.fallbackInner}>
            <Ionicons name={config.icon as any} size={56} color={rgba(config.accent, 0.32)} />
            <Text style={hh.fallbackLabel} numberOfLines={1}>{address}</Text>
          </View>
        </LinearGradient>
      )}

      {/* Section pill — top-right, mirrors ProductCard's retailer pill.
          We deliberately do NOT add a bottom-left address overlay here:
          the address is already the right-pane title (single source of
          truth), and stacking it twice would muddy the composition. */}
      <View style={hh.sectionPill}>
        <Text style={hh.sectionPillText} numberOfLines={1}>{sectionLabel}</Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Horizontal right-side info stack (section-aware)
// ---------------------------------------------------------------------------

interface PropertyHorizontalStackProps {
  r: Record<string, any>;
  section: string;
  address: string;
}

function PropertyHorizontalStack({ r, section, address }: PropertyHorizontalStackProps) {
  const headline = buildHeadline(section, r);

  // City, state ZIP secondary line — falls back through several record shapes.
  const subline =
    [r.city, r.state, r.postal_code].filter(Boolean).join(', ')
    || (typeof r.county === 'string' && r.county.trim() ? `${r.county} County` : '')
    || (r.neighborhood as string | undefined)
    || '';

  // Owner footnote (only on non-ownership sections — ownership has the owner
  // as its own headline already).
  const ownerLine = section !== 'ownership' && typeof r.owner_name === 'string' && r.owner_name.trim()
    ? `Owner: ${r.owner_name}`
    : null;

  const stats = (headline.stats || []).filter(Boolean) as Array<{ icon: string; value: string; label: string }>;
  const visibleStats = stats.slice(0, 4);

  const isTextHeadline = headline.bigStyle === 'text';
  const bigColor = headline.bigColor
    || (isTextHeadline ? Colors.text.primary : Colors.semantic.success);

  return (
    <View style={hStack.root}>
      <Text
        style={hStack.title}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {address}
      </Text>

      {subline ? (
        <Text style={hStack.subline} numberOfLines={1}>{subline}</Text>
      ) : null}

      {headline.bigValue ? (
        <View style={hStack.headlineBlock}>
          <Text
            style={[
              hStack.headlineValue,
              { color: bigColor },
              // Text headlines (owner, district, lender, sale-date) sit at
              // a smaller scale because they're prose, not prices. Numeric
              // headlines keep the 22px display weight.
              isTextHeadline && hStack.headlineValueText,
            ]}
            numberOfLines={2}
          >
            {headline.bigValue}
          </Text>
          {headline.bigQualifier ? (
            <Text style={hStack.headlineQualifier} numberOfLines={1}>{headline.bigQualifier}</Text>
          ) : null}
          {headline.bigSubline ? (
            <Text style={hStack.headlineSubline} numberOfLines={1}>{headline.bigSubline}</Text>
          ) : null}
        </View>
      ) : null}

      {headline.pill ? (
        <View style={hStack.pillRow}>
          <Badge label={headline.pill.label} variant={headline.pill.variant || 'default'} />
        </View>
      ) : null}

      {visibleStats.length > 0 ? (
        <View style={hStack.statsRow}>
          {visibleStats.map((stat, i) => (
            <MetricChip key={`${stat.label}-${i}`} icon={stat.icon} value={stat.value} label={stat.label} />
          ))}
        </View>
      ) : null}

      {/* Spacer pushes footnote / owner line to the bottom, mirroring
          ProductCard's stockSpacer flex:1 trick. */}
      <View style={hStack.spacer} />

      {headline.footnote ? (
        <Text style={hStack.footnote} numberOfLines={1}>{headline.footnote}</Text>
      ) : null}

      {ownerLine ? (
        <View style={hStack.ownerRow}>
          <Ionicons name="person-outline" size={13} color={Colors.text.muted} />
          <Text style={hStack.ownerText} numberOfLines={1}>{ownerLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HERO_HEIGHT = 200;
const HERO_STYLE: ViewStyle = { height: HERO_HEIGHT, aspectRatio: undefined };

const s = StyleSheet.create({
  // Hero (vertical legacy)
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

  // Value block (vertical legacy)
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

// ── Horizontal hero (left pane: 580x440) ───────────────────────────────────
const hh = StyleSheet.create({
  pressable: {
    flex: 1,
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
    backgroundColor: Colors.background.elevated,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'zoom-in' } as unknown as ViewStyle)
      : {}),
  },
  fallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  fallbackLabel: {
    fontSize: 13,
    color: Colors.text.muted,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  // Matches ProductCard.retailerPill 1:1 so a Property card sitting next to
  // a Product card in the carousel has identical chrome.
  sectionPill: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.surface.cardBorder,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    maxWidth: 200,
  },
  sectionPillText: {
    ...Typography.small,
    color: Colors.text.secondary,
  },
});

// ── Horizontal right-side info stack (300x440) ─────────────────────────────
// Locked to ProductCard's hStyles rhythm: title (17/700) → sub (small/tertiary)
// → headline value (22/700 green) + qualifier → pill → stats row → spacer →
// owner / footnote. Same 16px gutters, same vertical breathing.
const hStack = StyleSheet.create({
  root: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  subline: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  headlineBlock: {
    marginTop: Spacing.sm,
  },
  headlineValue: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  /** When the headline is a name (owner / district) we drop the size to
   *  match a 17px title-style scale — keeps the rhythm comfortable when
   *  the value is long text rather than a number. */
  headlineValueText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headlineQualifier: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headlineSubline: {
    ...Typography.small,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: Spacing.sm,
  },
  footnote: {
    ...Typography.small,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  ownerText: {
    ...Typography.small,
    color: Colors.text.tertiary,
    flexShrink: 1,
  },
});

export default PropertyCard;
