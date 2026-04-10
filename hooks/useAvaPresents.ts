/**
 * useAvaPresents -- State management for the Ava Presents research card modal.
 *
 * Manages the full lifecycle of the card modal: showing/hiding, card navigation,
 * and Level 2 detail drill-down. Pure UI state -- no backend calls, no governance.
 *
 * For property lookups: splits 1 record into multiple section cards so the user
 * swipes through Overview → Ownership → Mortgage → Tax → Sale History → etc.
 */

import { useState, useCallback, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfidenceScore {
  status: 'verified' | 'partial' | 'unverified';
  score: number;
}

export interface AvaPresentsState {
  visible: boolean;
  artifactType: string;
  records: Record<string, unknown>[];
  summary: string;
  confidence: ConfidenceScore | null;
  activeIndex: number;
  /** Level 2: detail drill-down */
  detailMode: boolean;
  detailRecord: Record<string, unknown> | null;
}

export interface ShowCardsPayload {
  artifactType: string;
  records: Record<string, unknown>[];
  summary: string;
  confidence?: ConfidenceScore | null;
}

export interface AvaPresentsActions {
  showCards: (data: ShowCardsPayload) => void;
  dismiss: () => void;
  nextCard: () => void;
  prevCard: () => void;
  goToCard: (index: number) => void;
  openDetail: (record: Record<string, unknown>) => void;
  closeDetail: () => void;
}

export type UseAvaPresentReturn = AvaPresentsState & AvaPresentsActions;

// ─── Initial State ───────────────────────────────────────────────────────────

const INITIAL_STATE: AvaPresentsState = {
  visible: false,
  artifactType: '',
  records: [],
  summary: '',
  confidence: null,
  activeIndex: 0,
  detailMode: false,
  detailRecord: null,
};

// ─── Property Section Splitter ──────────────────────────────────────────────
// Single property record → multiple swipeable section cards.
// Each card shows one aspect of the property dossier.
// Cards with no data are skipped — no empty cards in the carousel.

const PROPERTY_TYPES = new Set([
  'LandlordPropertyPack', 'PropertyFactPack', 'RentCompPack',
  'PermitContextPack', 'NeighborhoodDemandBrief', 'ScreeningComplianceBrief',
]);

const PROPERTY_SECTIONS: { key: string; label: string; requires: string[] }[] = [
  { key: 'overview',     label: 'Property Overview',      requires: ['normalized_address'] },
  { key: 'ownership',    label: 'Ownership',              requires: ['owner_name', 'owner_type', 'absentee_owner_indicator'] },
  { key: 'mortgage',     label: 'Mortgage & Equity',      requires: ['mortgage_lender', 'mortgage_amount', 'ltv_ratio', 'available_equity', 'current_loan_balance'] },
  { key: 'valuation',    label: 'Valuation & Tax',        requires: ['tax_market_value', 'tax_assessed_total', 'estimated_value', 'annual_tax_amount'] },
  { key: 'sale_history', label: 'Sale History',           requires: ['last_sale_date', 'last_sale_amount', 'sale_history'] },
  { key: 'rental',       label: 'Rental Intelligence',    requires: ['estimated_rent'] },
  { key: 'permits',      label: 'Permits & Improvements', requires: ['permit_signals'] },
  { key: 'schools',      label: 'Schools & Location',     requires: ['school_district_name', 'nearby_schools', 'neighborhood'] },
  { key: 'foreclosure',  label: 'Distress & Foreclosure', requires: ['foreclosure_stage', 'in_foreclosure', 'foreclosure_records'] },
];

function isPlaceholderString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === '' || v === 'n/a' || v === 'na' || v === 'unknown' || v === 'unknown address' || v === 'none';
}

function hasValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return !isPlaceholderString(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isPropertyLikeRecord(record: Record<string, unknown>): boolean {
  const address = record.normalized_address || record.address;
  if (!hasValue(address)) return false;
  return (
    hasValue(record.beds) ||
    hasValue(record.baths) ||
    hasValue(record.living_sqft) ||
    hasValue(record.year_built) ||
    hasValue(record.property_value) ||
    hasValue(record.tax_market_value) ||
    hasValue(record.owner_name)
  );
}

function splitPropertyRecord(record: Record<string, unknown>): Record<string, unknown>[] {
  const cards: Record<string, unknown>[] = [];
  for (const section of PROPERTY_SECTIONS) {
    const hasData = section.requires.some((field) => {
      const val = record[field];
      return hasValue(val);
    });
    // Overview always shows; others only if they have data
    if (section.key === 'overview' || hasData) {
      cards.push({ ...record, _cardSection: section.key, _sectionLabel: section.label });
    }
  }
  return cards;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAvaPresents(): UseAvaPresentReturn {
  const [state, setState] = useState<AvaPresentsState>(INITIAL_STATE);

  const showCards = useCallback((data: ShowCardsPayload) => {
    if (!data.records || data.records.length === 0) return;

    let records = data.records;

    // Property types: split canonical property records into multiple section cards.
    if (PROPERTY_TYPES.has(data.artifactType)) {
      const propertyLike = records.filter(isPropertyLikeRecord);
      const candidates = propertyLike.length > 0 ? propertyLike : records.slice(0, 1);
      records = candidates.flatMap((r) => splitPropertyRecord(r));
    }

    setState({
      visible: true,
      artifactType: data.artifactType,
      records,
      summary: data.summary,
      confidence: data.confidence ?? null,
      activeIndex: 0,
      detailMode: false,
      detailRecord: null,
    });
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const nextCard = useCallback(() => {
    setState((prev) => {
      if (prev.detailMode || prev.activeIndex >= prev.records.length - 1) return prev;
      return { ...prev, activeIndex: prev.activeIndex + 1 };
    });
  }, []);

  const prevCard = useCallback(() => {
    setState((prev) => {
      if (prev.detailMode || prev.activeIndex <= 0) return prev;
      return { ...prev, activeIndex: prev.activeIndex - 1 };
    });
  }, []);

  const goToCard = useCallback((index: number) => {
    setState((prev) => {
      if (prev.detailMode) return prev;
      const clamped = Math.max(0, Math.min(index, prev.records.length - 1));
      return { ...prev, activeIndex: clamped };
    });
  }, []);

  const openDetail = useCallback((record: Record<string, unknown>) => {
    setState((prev) => {
      if (!prev.visible) return prev;
      return { ...prev, detailMode: true, detailRecord: record };
    });
  }, []);

  const closeDetail = useCallback(() => {
    setState((prev) => ({ ...prev, detailMode: false, detailRecord: null }));
  }, []);

  return useMemo(
    () => ({ ...state, showCards, dismiss, nextCard, prevCard, goToCard, openDetail, closeDetail }),
    [state, showCards, dismiss, nextCard, prevCard, goToCard, openDetail, closeDetail],
  );
}
