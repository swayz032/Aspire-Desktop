import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChapterLeftPane } from '@/components/service-hub/estimate-studio/scope/ChapterLeftPane';
import type { BlueprintChapter } from '@/lib/api/blueprintsApi';

// 2026-05-24 — Zones 3-5 (tasks/buy-list/open-questions) collapse by default.
// Helper expands a zone via its `-toggle` Pressable so tests can assert body
// content. Zones 1-2 (what-this-is/in-scope) default expanded, no helper needed.
function expandZone(toggleTestID: string, pressEl: { getByTestId: (id: string) => unknown }): void {
  const toggle = pressEl.getByTestId(toggleTestID);
  fireEvent.press(toggle as Parameters<typeof fireEvent.press>[0]);
}

const baseChapter: BlueprintChapter = {
  key: 'restrooms', ordinal: 6, title: "The new restrooms & Mother's Room", confidence: 0.94,
  source_pages: [13, 14, 16],
  source_sheets: [
    { sheet_code: 'A-403', sheet_title: 'Restroom Plan', page_number: 13, render_url: null },
    { sheet_code: 'A-404', sheet_title: 'RCP', page_number: 14, render_url: null },
    { sheet_code: 'A-702', sheet_title: 'Finish Plan', page_number: 16, render_url: null },
  ],
  thumbnail_url: null,
  zones: {
    what_this_is: 'A bathroom build-out.',
    in_scope: [{ text_md: '3 new restroom enclosures' }],
    not_in_scope: [{ text_md: 'existing breakroom' }],
    tasks: [
      { text_md: 'Demo existing partitions', discipline: 'demo', evidence_sheets: ['A-403'] },
      { text_md: 'Rough-in 7 fixtures', discipline: 'plumb', evidence_sheets: ['P-103'] },
    ],
    buy_list: [
      { quantity_display: '2×', name: 'Floor-mount toilet' },
      { quantity_display: '3×', name: 'Wall-hung lavatory' },
    ],
    open_questions: [
      { question_id: 'q1', title: 'Floor finish', body_md: 'Carpet removed, no replacement named.' },
    ],
  },
};

describe('ChapterLeftPane', () => {
  it('renders the chapter ordinal, confidence, and headline', () => {
    const { getByTestId, getByText } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getByTestId('chapter-left-ordinal').props.children).toMatch(/CHAPTER 06 of /);
    expect(getByTestId('chapter-left-confidence').props.children).toMatch(/94/);
    expect(getByText(/The new restrooms/)).toBeTruthy();
  });

  it('renders all 5 zones when populated', () => {
    const { getByTestId } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getByTestId('zone-what-this-is')).toBeTruthy();
    expect(getByTestId('zone-in-scope')).toBeTruthy();
    expect(getByTestId('zone-tasks')).toBeTruthy();
    expect(getByTestId('zone-buy-list')).toBeTruthy();
    expect(getByTestId('zone-open-questions')).toBeTruthy();
  });

  it('renders empty-state copy in the what-this-is zone when content is empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, what_this_is: '' } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(queryByTestId('zone-what-this-is')).toBeTruthy();
    expect(getByText(/Drew has not summarized this chapter yet/)).toBeTruthy();
  });

  it('renders empty-state copy in the buy-list zone when buy_list is empty (after expand)', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, buy_list: [] } };
    const screen = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(screen.queryByTestId('zone-buy-list')).toBeTruthy();
    // Zone is collapsed by default — expand to see empty-state copy.
    expandZone('zone-buy-list-toggle', screen);
    expect(screen.getByText(/Materials for this chapter appear here/)).toBeTruthy();
  });

  it('renders empty-state copy in the open-questions zone when open_questions is empty (after expand)', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, open_questions: [] } };
    const screen = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(screen.queryByTestId('zone-open-questions')).toBeTruthy();
    expandZone('zone-open-questions-toggle', screen);
    expect(screen.getByText(/0 open questions/)).toBeTruthy();
  });

  it('renders empty-state copy in the in-scope zone when both scope arrays empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, in_scope: [], not_in_scope: [] } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    // In-scope defaults expanded.
    expect(queryByTestId('zone-in-scope')).toBeTruthy();
    expect(getByText(/Scope items appear here/)).toBeTruthy();
  });

  it('renders empty-state copy in the tasks zone when tasks empty (after expand)', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, tasks: [] } };
    const screen = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(screen.queryByTestId('zone-tasks')).toBeTruthy();
    expandZone('zone-tasks-toggle', screen);
    expect(screen.getByText(/Drew is still pulling tasks/)).toBeTruthy();
  });

  it('renders one source chip per source sheet', () => {
    const { getAllByTestId } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getAllByTestId(/^source-chip-/)).toHaveLength(3);
  });

  it('renders discipline tags on tasks (after expand)', () => {
    const screen = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expandZone('zone-tasks-toggle', screen);
    expect(screen.getByText('DEMO')).toBeTruthy();
    expect(screen.getByText('PLUMB')).toBeTruthy();
  });

  it('renders buy list rows with quantity + name + Takeoff hint (after expand)', () => {
    const screen = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expandZone('zone-buy-list-toggle', screen);
    expect(screen.getByText('2×')).toBeTruthy();
    expect(screen.getByText('Floor-mount toilet')).toBeTruthy();
  });

  it('zones 1-2 (what-this-is + in-scope) are expanded by default', () => {
    const { getByText } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    // what-this-is body visible without any toggle press
    expect(getByText('A bathroom build-out.')).toBeTruthy();
    // in-scope first item visible without any toggle press
    expect(getByText('3 new restroom enclosures')).toBeTruthy();
  });

  it('zones 3-5 (tasks + buy-list + open-questions) are collapsed by default', () => {
    const { queryByText } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    // Body content of zones 3-5 should NOT be visible until expanded
    expect(queryByText('Demo existing partitions')).toBeNull();
    expect(queryByText('Floor-mount toilet')).toBeNull();
    expect(queryByText('Floor finish')).toBeNull();
  });

  it('expanding a zone reveals its body content', () => {
    const screen = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(screen.queryByText('Floor-mount toilet')).toBeNull();
    expandZone('zone-buy-list-toggle', screen);
    expect(screen.getByText('Floor-mount toilet')).toBeTruthy();
  });

  it('renders "CHAPTER N of M" when totalChapters is provided (fixes the dash bug)', () => {
    const { getByTestId } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} totalChapters={7} />
    );
    expect(getByTestId('chapter-left-ordinal').props.children).toMatch(/CHAPTER 06 of 7/);
  });

  it('renders "CHAPTER N of —" placeholder when totalChapters is omitted', () => {
    const { getByTestId } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getByTestId('chapter-left-ordinal').props.children).toMatch(/CHAPTER 06 of —/);
  });

  it('shows the chapter/sheet view toggle when an activeSheet is provided', () => {
    const { getByTestId } = render(
      <ChapterLeftPane
        chapter={baseChapter}
        hoverBulletKey={null}
        onHoverBullet={() => {}}
        activeSheet={{ sheet_code: 'A-403', sheet_title: 'Restroom Plan' }}
        viewMode="chapter"
        onViewModeChange={() => {}}
      />
    );
    expect(getByTestId('chapter-left-view-toggle')).toBeTruthy();
    expect(getByTestId('view-toggle-chapter')).toBeTruthy();
    expect(getByTestId('view-toggle-sheet')).toBeTruthy();
  });

  it('renders the per-sheet story when viewMode="sheet"', () => {
    const { getByTestId, queryByTestId } = render(
      <ChapterLeftPane
        chapter={baseChapter}
        hoverBulletKey={null}
        onHoverBullet={() => {}}
        activeSheet={{ sheet_code: 'A-403', sheet_title: 'Restroom Plan' }}
        viewMode="sheet"
        onViewModeChange={() => {}}
      />
    );
    // Per-sheet zones render
    expect(getByTestId('sheet-view')).toBeTruthy();
    expect(getByTestId('zone-sheet-shows')).toBeTruthy();
    expect(getByTestId('zone-sheet-whats-on-it')).toBeTruthy();
    expect(getByTestId('zone-sheet-when')).toBeTruthy();
    expect(getByTestId('zone-sheet-buy')).toBeTruthy();
    expect(getByTestId('zone-sheet-watchouts')).toBeTruthy();
    // Chapter zones do NOT render in sheet view
    expect(queryByTestId('zone-what-this-is')).toBeNull();
  });

  it('toggling from chapter to sheet calls onViewModeChange with the new mode', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ChapterLeftPane
        chapter={baseChapter}
        hoverBulletKey={null}
        onHoverBullet={() => {}}
        activeSheet={{ sheet_code: 'A-403', sheet_title: 'Restroom Plan' }}
        viewMode="chapter"
        onViewModeChange={onChange}
      />
    );
    fireEvent.press(getByTestId('view-toggle-sheet'));
    expect(onChange).toHaveBeenCalledWith('sheet');
  });
});
