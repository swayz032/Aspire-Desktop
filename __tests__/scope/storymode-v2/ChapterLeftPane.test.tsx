import React from 'react';
import { render } from '@testing-library/react-native';
import { ChapterLeftPane } from '@/components/service-hub/estimate-studio/scope/ChapterLeftPane';
import type { BlueprintChapter } from '@/lib/api/blueprintsApi';

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

  it('renders empty-state copy in the buy-list zone when buy_list is empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, buy_list: [] } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(queryByTestId('zone-buy-list')).toBeTruthy();
    expect(getByText(/Materials for this chapter appear here/)).toBeTruthy();
  });

  it('renders empty-state copy in the open-questions zone when open_questions is empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, open_questions: [] } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(queryByTestId('zone-open-questions')).toBeTruthy();
    expect(getByText(/0 open questions/)).toBeTruthy();
  });

  it('renders empty-state copy in the in-scope zone when both scope arrays empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, in_scope: [], not_in_scope: [] } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(queryByTestId('zone-in-scope')).toBeTruthy();
    expect(getByText(/Scope items appear here/)).toBeTruthy();
  });

  it('renders empty-state copy in the tasks zone when tasks empty', () => {
    const ch = { ...baseChapter, zones: { ...baseChapter.zones, tasks: [] } };
    const { queryByTestId, getByText } = render(
      <ChapterLeftPane chapter={ch} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(queryByTestId('zone-tasks')).toBeTruthy();
    expect(getByText(/Drew is still pulling tasks/)).toBeTruthy();
  });

  it('renders one source chip per source sheet', () => {
    const { getAllByTestId } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getAllByTestId(/^source-chip-/)).toHaveLength(3);
  });

  it('renders discipline tags on tasks', () => {
    const { getByText } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getByText('DEMO')).toBeTruthy();
    expect(getByText('PLUMB')).toBeTruthy();
  });

  it('renders buy list rows with quantity + name + Takeoff hint', () => {
    const { getByText } = render(
      <ChapterLeftPane chapter={baseChapter} hoverBulletKey={null} onHoverBullet={() => {}} />
    );
    expect(getByText('2×')).toBeTruthy();
    expect(getByText('Floor-mount toilet')).toBeTruthy();
    // 'Takeoff' hint appears twice (one per buy row)
  });
});
