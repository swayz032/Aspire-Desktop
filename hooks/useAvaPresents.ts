/**
 * useAvaPresents -- State management for the Ava Presents research card modal.
 *
 * Manages the full lifecycle of the card modal: showing/hiding, card navigation,
 * and Level 2 detail drill-down. Pure UI state -- no backend calls, no governance.
 *
 * Usage:
 *   const ava = useAvaPresents();
 *   ava.showCards({ artifactType: 'HotelShortlist', records: [...], summary: '...' });
 *   ava.nextCard();
 *   ava.openDetail(record);
 *   ava.dismiss();
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAvaPresents(): UseAvaPresentReturn {
  const [state, setState] = useState<AvaPresentsState>(INITIAL_STATE);

  const showCards = useCallback((data: ShowCardsPayload) => {
    if (!data.records || data.records.length === 0) return;
    setState({
      visible: true,
      artifactType: data.artifactType,
      records: data.records,
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
