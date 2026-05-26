import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChapterStrip } from '@/components/service-hub/estimate-studio/scope/ChapterStrip';
import type { BlueprintChapter } from '@/lib/api/blueprintsApi';
import {
  greenChapter,
  mixedChapter,
  redChapter,
  tierlessChapter,
} from './_fixtures/tieredChapters';

const chapters: BlueprintChapter[] = [
  {
    key: 'cover', ordinal: 1, title: "What's getting built", confidence: 1,
    source_pages: [1], source_sheets: [],
    thumbnail_url: 'https://x/ch01.png',
    zones: { what_this_is: '', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
  },
  {
    key: 'restrooms', ordinal: 6, title: "New restrooms & Mother's Room", confidence: 0.94,
    source_pages: [13], source_sheets: [],
    thumbnail_url: null,  // exercises the placeholder branch
    zones: {
      what_this_is: 'x', in_scope: [], not_in_scope: [], tasks: [], buy_list: [],
      open_questions: [{ question_id: 'q1', title: 'Floor', body_md: '' }],
    },
  },
];

describe('ChapterStrip', () => {
  it('renders one card per chapter', () => {
    const { getAllByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="cover" onSelect={() => {}} />
    );
    expect(getAllByTestId(/^chapter-card-(cover|restrooms)$/)).toHaveLength(2);
  });

  it('marks the active card with selected accessibility state', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="restrooms" onSelect={() => {}} />
    );
    expect(getByTestId('chapter-card-restrooms').props.accessibilityState).toEqual({ selected: true });
    expect(getByTestId('chapter-card-cover').props.accessibilityState).toEqual({ selected: false });
  });

  it('shows OPEN suffix when the chapter has open questions', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="cover" onSelect={() => {}} />
    );
    const ordinalNode = getByTestId('chapter-card-restrooms-ordinal');
    // ordinal label string contains "06" and "OPEN"
    expect(ordinalNode.props.children).toMatch(/06/);
    expect(ordinalNode.props.children).toMatch(/OPEN/);
  });

  it('renders the placeholder when thumbnail_url is null', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="cover" onSelect={() => {}} />
    );
    expect(getByTestId('chapter-card-restrooms-thumb-placeholder')).toBeTruthy();
  });

  it('renders the Image when thumbnail_url is present', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="cover" onSelect={() => {}} />
    );
    expect(getByTestId('chapter-card-cover-thumb')).toBeTruthy();
  });

  it('calls onSelect with the chapter key when a card is pressed', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ChapterStrip chapters={chapters} activeKey="cover" onSelect={onSelect} />
    );
    fireEvent.press(getByTestId('chapter-card-restrooms'));
    expect(onSelect).toHaveBeenCalledWith('restrooms');
  });

  it('renders nothing when chapters is empty', () => {
    const { queryAllByTestId } = render(
      <ChapterStrip chapters={[]} activeKey={null} onSelect={() => {}} />
    );
    expect(queryAllByTestId(/^chapter-card-/)).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // DV wave (Pass 2 / Subagent B) — tier dot + routing summary affordances.
  // ---------------------------------------------------------------------------
  it('renders TierDot when confidence_tier is set', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={[greenChapter]} activeKey={null} onSelect={() => {}} />
    );
    expect(getByTestId(`chapter-card-${greenChapter.key}-tier-dot`)).toBeTruthy();
  });

  it('omits TierDot when confidence_tier is undefined', () => {
    const { queryByTestId } = render(
      <ChapterStrip chapters={[tierlessChapter]} activeKey={null} onSelect={() => {}} />
    );
    expect(queryByTestId(`chapter-card-${tierlessChapter.key}-tier-dot`)).toBeNull();
  });

  it('renders RoutingSummaryBadge when routing_summary is set', () => {
    const { getByTestId } = render(
      <ChapterStrip chapters={[mixedChapter, redChapter]} activeKey={null} onSelect={() => {}} />
    );
    const mixedBadge = getByTestId(`chapter-card-${mixedChapter.key}-routing-summary`);
    // Accessibility label captures all three buckets in plain English.
    expect(mixedBadge.props.accessibilityLabel).toMatch(/auto-populated/);
    expect(mixedBadge.props.accessibilityLabel).toMatch(/pending review/);
    expect(mixedBadge.props.accessibilityLabel).toMatch(/open questions/);
    // Red chapter has auto=0, review=1, open=3 → must surface AVA + BLOCK.
    const redBadge = getByTestId(`chapter-card-${redChapter.key}-routing-summary`);
    expect(redBadge).toBeTruthy();
  });

  it('omits RoutingSummaryBadge when routing_summary is undefined', () => {
    const { queryByTestId } = render(
      <ChapterStrip chapters={[tierlessChapter]} activeKey={null} onSelect={() => {}} />
    );
    expect(queryByTestId(`chapter-card-${tierlessChapter.key}-routing-summary`)).toBeNull();
  });
});
