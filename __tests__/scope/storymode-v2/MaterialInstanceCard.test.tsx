/**
 * MaterialInstanceCard — DV Pass 4 (Subagent B).
 *
 * Covers always-rendered visuals + progressive enhancement props
 * (PROV §9 / CSI §10 / ANOM §11).
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MaterialInstanceCard } from '@/components/service-hub/estimate-studio/scope/MaterialInstanceCard';
import type { MaterialInstance } from '@/lib/api/blueprintsStoryV2';

const fixtureInstance: MaterialInstance = {
  instance_id: 'inst_1',
  sheet_id: 'sheet_1',
  sheet_code: 'E-101',
  symbol_name: 'Single-pole switch',
  legend_label: 'S1',
  legend_specification: 'Hubbell HBL5301WSP, 20A, white',
  cluster_id: 'cl_1',
  motif_hash: 'hash1',
  resolution_source: 'topology_match',
  confidence: 0.94,
  instance_count: 12,
  tier: 'GREEN',
  receipt_id: 'rcpt_a1b2c3d4',
};

describe('MaterialInstanceCard', () => {
  it('renders symbol name, legend label, spec, count, and resolution chip', () => {
    const { getByText, getByTestId } = render(
      <MaterialInstanceCard instance={fixtureInstance} />,
    );
    expect(getByText('Single-pole switch')).toBeTruthy();
    expect(getByText('S1')).toBeTruthy();
    expect(getByText('Hubbell HBL5301WSP, 20A, white')).toBeTruthy();
    expect(getByTestId('instance-count').props.children.join('')).toMatch(/12/);
    expect(getByTestId('resolution-chip')).toBeTruthy();
  });

  it('applies the tier color to the left border', () => {
    const green = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        testID="green-card"
      />,
    );
    const greenStyle = green.getByTestId('green-card').props.style;
    const greenFlat = Array.isArray(greenStyle) ? Object.assign({}, ...greenStyle) : greenStyle;
    expect(greenFlat.borderLeftColor).toBe('#22c55e');

    const yellow = render(
      <MaterialInstanceCard
        instance={{ ...fixtureInstance, tier: 'YELLOW' }}
        testID="yellow-card"
      />,
    );
    const yellowStyle = yellow.getByTestId('yellow-card').props.style;
    const yellowFlat = Array.isArray(yellowStyle) ? Object.assign({}, ...yellowStyle) : yellowStyle;
    expect(yellowFlat.borderLeftColor).toBe('#fbbf24');

    const red = render(
      <MaterialInstanceCard
        instance={{ ...fixtureInstance, tier: 'RED' }}
        testID="red-card"
      />,
    );
    const redStyle = red.getByTestId('red-card').props.style;
    const redFlat = Array.isArray(redStyle) ? Object.assign({}, ...redStyle) : redStyle;
    expect(redFlat.borderLeftColor).toBe('#ef4444');
  });

  it('calls onReceiptClick when the receipt chip is tapped', () => {
    const onReceiptClick = jest.fn();
    const { getByTestId } = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        onReceiptClick={onReceiptClick}
      />,
    );
    fireEvent.press(getByTestId('receipt-chip'));
    expect(onReceiptClick).toHaveBeenCalledWith('rcpt_a1b2c3d4');
  });

  it('renders provenance footer label when provenance prop is provided (PROV §9)', () => {
    const { getByTestId, rerender } = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        provenance={{ source: 'legend_total' }}
      />,
    );
    expect(getByTestId('resolution-chip').props.children.props.children).toContain('from legend');

    rerender(
      <MaterialInstanceCard
        instance={fixtureInstance}
        provenance={{ source: 'addendum_delta', delta: 3, delta_reason: 'addendum 2' }}
      />,
    );
    const chipText = getByTestId('resolution-chip').props.children.props.children;
    expect(chipText).toContain('+3');
    expect(chipText).toContain('addendum 2');

    rerender(
      <MaterialInstanceCard
        instance={fixtureInstance}
        provenance={{ source: 'derived_count', base_count: 8 }}
      />,
    );
    expect(getByTestId('resolution-chip').props.children.props.children).toContain('derived from 8');
  });

  it('renders the CSI chip when csi_refs is provided (CSI §10)', () => {
    const { getByTestId } = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        csi_refs={{
          masterformat_section: '22 42 13',
          masterformat_title: 'Water Closets',
        }}
      />,
    );
    const csiChip = getByTestId('csi-chip');
    expect(csiChip).toBeTruthy();
    expect(csiChip.props.children.props.children.join('')).toMatch(/22 42 13.*Water Closets/);
  });

  it('renders the anomaly badge when anomaly_ids is non-empty (ANOM §11)', () => {
    const { getByTestId, queryByTestId } = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        anomaly_ids={['anom_1', 'anom_2']}
      />,
    );
    const badge = getByTestId('anomaly-badge');
    expect(badge).toBeTruthy();
    expect(badge.props.children.props.children.join('')).toMatch(/2/);

    const empty = render(
      <MaterialInstanceCard
        instance={fixtureInstance}
        anomaly_ids={[]}
      />,
    );
    expect(empty.queryByTestId('anomaly-badge')).toBeNull();
    // Reference to silence lint on queryByTestId from first render
    void queryByTestId;
  });
});
