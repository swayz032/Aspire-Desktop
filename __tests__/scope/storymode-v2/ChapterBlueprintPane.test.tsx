import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChapterBlueprintPane } from '@/components/service-hub/estimate-studio/scope/ChapterBlueprintPane';
import type { BlueprintChapter, BlueprintRegion } from '@/lib/api/blueprintsApi';
import { mixedChapter, redChapter, greenChapter } from './_fixtures/tieredChapters';

const region: BlueprintRegion = {
  sheet_code: 'A-403', x: 0.3, y: 0.3, w: 0.1, h: 0.1, label: 'X', kind: 'primary',
};

const chapter: BlueprintChapter = {
  key: 'restrooms', ordinal: 6, title: 'Restrooms', confidence: 1,
  source_pages: [13, 14],
  source_sheets: [
    { sheet_code: 'A-403', sheet_title: 'Restroom Plan', page_number: 13, render_url: 'https://example.com/a403.png' },
    { sheet_code: 'A-404', sheet_title: 'RCP', page_number: 14, render_url: 'https://example.com/a404.png' },
  ],
  thumbnail_url: null,
  zones: { what_this_is: '', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
};

describe('ChapterBlueprintPane', () => {
  it('renders one tab per source sheet, first active', () => {
    const { getAllByTestId, getByTestId } = render(
      <ChapterBlueprintPane chapter={chapter} regions={[region]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    expect(getAllByTestId(/^sheet-tab-/)).toHaveLength(2);
    expect(getByTestId('sheet-tab-A-403').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('sheet-tab-A-404').props.accessibilityState).toEqual({ selected: false });
  });

  it('clicking a sheet tab switches the active sheet', () => {
    const { getByTestId } = render(
      <ChapterBlueprintPane chapter={chapter} regions={[region]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    fireEvent.press(getByTestId('sheet-tab-A-404'));
    expect(getByTestId('sheet-tab-A-404').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('sheet-tab-A-403').props.accessibilityState).toEqual({ selected: false });
  });

  it('renders the AnnotationOverlay scoped to the active sheet', () => {
    const { queryAllByTestId } = render(
      <ChapterBlueprintPane chapter={chapter} regions={[region]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    // A-403 has 1 region, A-404 has 0 — first tab is active so 1 region rendered
    expect(queryAllByTestId(/annotation-region-/)).toHaveLength(1);
  });

  it('renders the empty-state legend hint when no regions are present on the active sheet', () => {
    const { getByTestId } = render(
      <ChapterBlueprintPane chapter={chapter} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    expect(getByTestId('blueprint-pane-no-regions')).toBeTruthy();
  });

  it('renders zoom buttons on web', () => {
    const { getByTestId } = render(
      <ChapterBlueprintPane chapter={chapter} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    // The jest test environment runs as web by default (RN Web)
    expect(getByTestId('zoom-button-in')).toBeTruthy();
    expect(getByTestId('zoom-button-out')).toBeTruthy();
    expect(getByTestId('zoom-button-fit')).toBeTruthy();
  });

  it('shows render-pending state when active sheet has null render_url', () => {
    const chWithoutRender: BlueprintChapter = {
      ...chapter,
      source_sheets: [{ sheet_code: 'A-403', sheet_title: 'Restroom Plan', page_number: 13, render_url: null }],
    };
    const { getByTestId } = render(
      <ChapterBlueprintPane chapter={chWithoutRender} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    expect(getByTestId('blueprint-pane-render-pending')).toBeTruthy();
  });

  it('shows no-sheets state when chapter has no source sheets', () => {
    const empty: BlueprintChapter = { ...chapter, source_sheets: [] };
    const { getByTestId, queryAllByTestId } = render(
      <ChapterBlueprintPane chapter={empty} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
    );
    expect(getByTestId('blueprint-pane-no-sheets')).toBeTruthy();
    expect(queryAllByTestId(/^sheet-tab-/)).toHaveLength(0);
  });

  // ─── DV wave: tier-tinted active bar + disqualifier badge ───
  describe('DV tier surface', () => {
    it('renders tier-tinted active bar when sheet has tier', () => {
      const ch = mixedChapter as unknown as BlueprintChapter;
      const { getByTestId, UNSAFE_getAllByType } = render(
        <ChapterBlueprintPane chapter={ch} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
      );
      // Activate a YELLOW sheet (M-201).
      fireEvent.press(getByTestId('sheet-tab-M-201'));
      // The active bar is the View nested inside the active Pressable whose
      // resolved style has `height: 3`. Flatten and look for our injected
      // tier color override (#fbbf24 = YELLOW).
      const { View: RNView } = require('react-native');
      const views = UNSAFE_getAllByType(RNView);
      const hasYellowBar = views.some((v: any) => {
        const s = Array.isArray(v.props.style)
          ? Object.assign({}, ...v.props.style.filter(Boolean))
          : v.props.style || {};
        return s.height === 3 && s.backgroundColor === '#fbbf24';
      });
      expect(hasYellowBar).toBe(true);
    });

    it('renders disqualifier badge when sheet has disqualifier_codes', () => {
      const ch = redChapter as unknown as BlueprintChapter;
      const { getByTestId } = render(
        <ChapterBlueprintPane chapter={ch} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
      );
      // P-201 has 2 disqualifier codes; P-301 has 4.
      const badge201 = getByTestId('sheet-tab-disqualifier-P-201');
      expect(badge201).toBeTruthy();
      const badge301 = getByTestId('sheet-tab-disqualifier-P-301');
      expect(badge301).toBeTruthy();
    });

    it('omits disqualifier badge when no disqualifier_codes', () => {
      const ch = greenChapter as unknown as BlueprintChapter;
      const { queryByTestId } = render(
        <ChapterBlueprintPane chapter={ch} regions={[]} hoverRegionKey={null} onHoverRegion={() => {}} />
      );
      // greenChapter A-101 is GREEN with no disqualifier_codes field at all.
      expect(queryByTestId('sheet-tab-disqualifier-A-101')).toBeNull();
      // A-401 has disqualifier_codes: [] (empty) — also no badge.
      expect(queryByTestId('sheet-tab-disqualifier-A-401')).toBeNull();
    });
  });
});
