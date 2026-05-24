import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ScopeStoryContextCard } from '@/components/service-hub/estimate-studio/tim-rail/ScopeStoryContextCard';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsApi';

const story: BlueprintStoryV2 = {
  project_id: 'p1', mean_confidence: 0.92,
  truth_distribution: {
    observed: 7, derived: 0, field_confirmed: 2, vendor_confirmed: 1,
    permit_confirmed: 0, assumed: 1, missing: 0,
  },
  updated_at: '2026-05-22T00:00:00Z',
  coverage: { sheets_total: 11, sheets_read: 9, pages_total: 39, pages_read: 33 },
  chapters: [
    {
      key: 'a', ordinal: 1, title: 'A', confidence: 1, source_pages: [1],
      source_sheets: [], thumbnail_url: null,
      zones: { what_this_is: 'x', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
    },
    {
      key: 'b', ordinal: 2, title: 'B', confidence: 0.5, source_pages: [2],
      source_sheets: [], thumbnail_url: null,
      zones: {
        what_this_is: '', in_scope: [], not_in_scope: [], tasks: [], buy_list: [],
        open_questions: [{ question_id: 'q1', title: 't', body_md: 'b' }],
      },
    },
  ],
};

describe('ScopeStoryContextCard', () => {
  it('renders the confidence gauge with the right percent', () => {
    const { getByTestId } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getByTestId('story-confidence-pct').props.children).toMatch(/92/);
  });

  it('shows coverage as X / Y sheets read', () => {
    const { getByTestId } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getByTestId('story-coverage').props.children).toMatch(/9 \/ 11/);
  });

  it('renders the truth donut bar', () => {
    const { getByTestId } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getByTestId('truth-donut')).toBeTruthy();
  });

  it('renders one coverage row per chapter', () => {
    const { getAllByTestId } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getAllByTestId(/^chapter-coverage-row-/)).toHaveLength(2);
  });

  it('chapter row with open questions shows the OPEN chip', () => {
    const { getByTestId, getByText } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getByTestId('chapter-coverage-row-b')).toBeTruthy();
    expect(getByText('OPEN')).toBeTruthy();
  });

  it('clicking a chapter row calls onJumpToChapter with the chapter key', () => {
    const onJump = jest.fn();
    const { getByTestId } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={onJump} />
    );
    fireEvent.press(getByTestId('chapter-coverage-row-b'));
    expect(onJump).toHaveBeenCalledWith('b');
  });

  it('exposes Jump-to accessibility label per row', () => {
    const { getByLabelText } = render(
      <ScopeStoryContextCard story={story} onJumpToChapter={() => {}} />
    );
    expect(getByLabelText(/Jump to chapter 1.*A/)).toBeTruthy();
    expect(getByLabelText(/Jump to chapter 2.*B/)).toBeTruthy();
  });

  it('renders 0 / 0 coverage and 0% gauge when story is empty', () => {
    const empty: BlueprintStoryV2 = {
      ...story, mean_confidence: 0,
      truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
      coverage: { sheets_total: 0, sheets_read: 0, pages_total: 0, pages_read: 0 },
      chapters: [],
    };
    const { getByTestId, queryAllByTestId } = render(
      <ScopeStoryContextCard story={empty} onJumpToChapter={() => {}} />
    );
    expect(getByTestId('story-confidence-pct').props.children).toMatch(/0/);
    expect(getByTestId('story-coverage').props.children).toMatch(/0 \/ 0/);
    expect(queryAllByTestId(/^chapter-coverage-row-/)).toHaveLength(0);
  });
});
