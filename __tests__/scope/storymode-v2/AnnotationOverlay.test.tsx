import React from 'react';
import { render } from '@testing-library/react-native';
import { AnnotationOverlay } from '@/components/service-hub/estimate-studio/scope/AnnotationOverlay';
import type { BlueprintRegion } from '@/lib/api/blueprintsApi';

const primary: BlueprintRegion = {
  sheet_code: 'A-403',
  x: 0.38, y: 0.28, w: 0.14, h: 0.18,
  label: "MOTHER'S ROOM · 80 SF",
  kind: 'primary',
};
const secondary: BlueprintRegion = {
  sheet_code: 'A-403',
  x: 0.42, y: 0.50, w: 0.10, h: 0.14,
  label: "MEN'S",
  kind: 'secondary',
};

describe('AnnotationOverlay', () => {
  it('renders a region for every annotation matching the active sheet', () => {
    const { getAllByTestId, queryByTestId } = render(
      <AnnotationOverlay
        activeSheetCode="A-403"
        regions={[primary, secondary, { ...primary, sheet_code: 'A-404' }]}
        openQuestions={[]}
        hoverRegionKey={null}
        onHoverRegion={() => {}}
      />
    );
    expect(getAllByTestId(/annotation-region-/)).toHaveLength(2);
    // 0-based testIDs (matches hover-key index space).
    expect(queryByTestId('annotation-region-0')).toBeTruthy();
    expect(queryByTestId('annotation-region-1')).toBeTruthy();
  });

  it('hides regions whose sheet does not match the active sheet', () => {
    const { queryAllByTestId } = render(
      <AnnotationOverlay
        activeSheetCode="A-404"
        regions={[primary, secondary]}
        openQuestions={[]}
        hoverRegionKey={null}
        onHoverRegion={() => {}}
      />
    );
    expect(queryAllByTestId(/annotation-region-/)).toHaveLength(0);
  });

  it('renders open-question pins for the active sheet', () => {
    const { getByTestId } = render(
      <AnnotationOverlay
        activeSheetCode="A-403"
        regions={[]}
        openQuestions={[{
          question_id: 'q1',
          title: 'Floor finish',
          body_md: 'TBD',
          blueprint_region: { ...primary, label: 'Floor', kind: 'primary' },
        }]}
        hoverRegionKey={null}
        onHoverRegion={() => {}}
      />
    );
    expect(getByTestId('annotation-pin-q1')).toBeTruthy();
  });

  it('exposes an accessibility label per region', () => {
    const { getByLabelText } = render(
      <AnnotationOverlay
        activeSheetCode="A-403"
        regions={[primary]}
        openQuestions={[]}
        hoverRegionKey={null}
        onHoverRegion={() => {}}
      />
    );
    expect(getByLabelText(/MOTHER'S ROOM · 80 SF.*source A-403/)).toBeTruthy();
  });

  it('does not render open-question pins for non-active sheets', () => {
    const { queryByTestId } = render(
      <AnnotationOverlay
        activeSheetCode="A-403"
        regions={[]}
        openQuestions={[{
          question_id: 'q2',
          title: 'Other',
          body_md: '',
          blueprint_region: { ...primary, sheet_code: 'A-404' },
        }]}
        hoverRegionKey={null}
        onHoverRegion={() => {}}
      />
    );
    expect(queryByTestId('annotation-pin-q2')).toBeNull();
  });
});
