/**
 * DV Pass 3 — SheetReceiptDrawer tests.
 *
 * Covers compact-row rendering, null-return when sheet has no DV signals,
 * disqualifier chip rendering, expand-on-tap loading + success + error states.
 *
 * Uses fixtures from `_fixtures/tieredChapters` (greenChapter, redChapter,
 * tierlessChapter) so the test bed mirrors what the real adapter emits.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { SheetReceiptDrawer } from '@/components/service-hub/estimate-studio/scope/SheetReceiptDrawer';
import {
  greenChapter,
  redChapter,
  tierlessChapter,
} from './_fixtures/tieredChapters';
import type { ExtractionReceipt } from '@/lib/api/blueprintsStoryV2';

// Mock useExtractionReceipt so we control the expanded-state payload.
jest.mock('@/hooks/useExtractionReceipt', () => ({
  useExtractionReceipt: jest.fn(),
}));

import { useExtractionReceipt } from '@/hooks/useExtractionReceipt';

const mockedUseReceipt = useExtractionReceipt as jest.MockedFunction<
  typeof useExtractionReceipt
>;

const baseReceipt: ExtractionReceipt = {
  receipt_id: 'rcpt_test_001',
  sheet_id: 'sheet_a101',
  doc_hash: 'sha256:deadbeef',
  pipeline_version: 'prg_v29_r10',
  tier: 'GREEN',
  routing_action: 'AUTO_POPULATE',
  disqualifier_codes: [],
  evidence_ocr_tokens: [
    { text: 'FLOOR PLAN', confidence: 0.994, bbox: [0, 0, 10, 10] },
    { text: 'A-101', confidence: 0.981, bbox: [0, 0, 10, 10] },
    { text: 'SCALE: 1/4"=1\'-0"', confidence: 0.962, bbox: [0, 0, 10, 10] },
    { text: 'NORTH', confidence: 0.948, bbox: [0, 0, 10, 10] },
    { text: 'KEY PLAN', confidence: 0.901, bbox: [0, 0, 10, 10] },
    // 6th token should be sliced off (only top 5 rendered).
    { text: 'extra-token', confidence: 0.5, bbox: [0, 0, 10, 10] },
  ],
  iou: 0.84,
  primitive_recall: 0.81,
  primitive_precision: 0.77,
  ocr_engine: 'paddleocr-v3',
  runtime_ms: 1240,
  cost_usd: 0.0015,
  audit_trail: 's3://aspire-receipts/2026/05/rcpt_test_001.jsonl',
  created_at: '2026-05-25T12:00:00Z',
};

describe('SheetReceiptDrawer', () => {
  beforeEach(() => {
    mockedUseReceipt.mockReset();
    // Default: idle (not loading, no receipt) — collapsed state never reads it.
    mockedUseReceipt.mockReturnValue({
      receipt: null,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExtractionReceipt>);
  });

  it('renders null when the sheet has no tier/routing/disqualifier signal', () => {
    const legacySheet = tierlessChapter.source_sheets[0];
    const { queryByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={legacySheet} />,
    );
    expect(queryByTestId('sheet-receipt-drawer')).toBeNull();
  });

  it('renders the compact row when the sheet has a tier', () => {
    const greenSheet = greenChapter.source_sheets[0];
    const { getByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={greenSheet} />,
    );
    expect(getByTestId('sheet-receipt-drawer')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-tier-chip')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-routing-chip')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-caret')).toBeTruthy();
  });

  it('renders disqualifier chips when sheet has disqualifier_codes', () => {
    // First RED sheet has 2 codes: NO_SHEET_ID + BORDER_ABLATION_FAILED.
    const redSheet = redChapter.source_sheets.find((s) => s.tier === 'RED')!;
    const { getByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={redSheet} />,
    );
    expect(getByTestId('sheet-receipt-drawer-disqualifier-NO_SHEET_ID')).toBeTruthy();
    expect(
      getByTestId('sheet-receipt-drawer-disqualifier-BORDER_ABLATION_FAILED'),
    ).toBeTruthy();
  });

  it('collapses 4+ disqualifiers into first-2 + overflow chip', () => {
    // The last RED sheet (P-301) has 4 disqualifier codes.
    const p301 = redChapter.source_sheets.find((s) => s.sheet_code === 'P-301')!;
    const { getByTestId, queryByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={p301} />,
    );
    expect(getByTestId('sheet-receipt-drawer-disqualifier-NO_SHEET_ID')).toBeTruthy();
    expect(
      getByTestId('sheet-receipt-drawer-disqualifier-BORDER_ABLATION_FAILED'),
    ).toBeTruthy();
    // 3rd + 4th codes should NOT be rendered as individual chips.
    expect(
      queryByTestId('sheet-receipt-drawer-disqualifier-TRAJECTORY_NULL_COLLAPSE'),
    ).toBeNull();
    expect(
      queryByTestId('sheet-receipt-drawer-disqualifier-FAILURE_MODE'),
    ).toBeNull();
    expect(getByTestId('sheet-receipt-drawer-disqualifier-overflow')).toBeTruthy();
  });

  it('expands on caret tap and renders EVIDENCE / METRICS / RECEIPT sections', async () => {
    mockedUseReceipt.mockReturnValue({
      receipt: baseReceipt,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useExtractionReceipt>);

    const greenSheet = greenChapter.source_sheets[0];
    const { getByTestId, queryByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={greenSheet} />,
    );

    // Collapsed: no expanded panel.
    expect(queryByTestId('sheet-receipt-drawer-expanded')).toBeNull();

    fireEvent.press(getByTestId('sheet-receipt-drawer-compact'));

    await waitFor(() => {
      expect(getByTestId('sheet-receipt-drawer-expanded')).toBeTruthy();
    });
    expect(getByTestId('sheet-receipt-drawer-evidence')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-metrics')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-receipt')).toBeTruthy();
    expect(getByTestId('sheet-receipt-drawer-copy')).toBeTruthy();
  });

  it('shows loading skeleton while the receipt is loading', () => {
    mockedUseReceipt.mockReturnValue({
      receipt: null,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useExtractionReceipt>);

    const greenSheet = greenChapter.source_sheets[0];
    const { getByTestId } = render(
      <SheetReceiptDrawer projectId="p1" sheet={greenSheet} />,
    );
    fireEvent.press(getByTestId('sheet-receipt-drawer-compact'));
    expect(getByTestId('sheet-receipt-drawer-loading')).toBeTruthy();
  });

  it('shows the error fallback when the fetch fails', () => {
    mockedUseReceipt.mockReturnValue({
      receipt: null,
      isLoading: false,
      error: new Error('boom'),
    } as ReturnType<typeof useExtractionReceipt>);

    const greenSheet = greenChapter.source_sheets[0];
    const { getByTestId, getByText } = render(
      <SheetReceiptDrawer projectId="p1" sheet={greenSheet} />,
    );
    fireEvent.press(getByTestId('sheet-receipt-drawer-compact'));
    expect(getByTestId('sheet-receipt-drawer-error')).toBeTruthy();
    expect(getByText('Receipt unavailable')).toBeTruthy();
    // Receipt id should still be copyable from the error state.
    expect(getByTestId('sheet-receipt-drawer-copy')).toBeTruthy();
  });
});
