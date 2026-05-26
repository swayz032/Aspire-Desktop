import React from 'react';
import { render } from '@testing-library/react-native';
// 2026-05-25 — DV Pass 3: StoryPanelV2 now mounts SheetReceiptDrawer which
// transitively imports `lib/authenticatedFetch` -> supabase at module-load
// time. Mock the hook before the tree imports it so Jest doesn't trip the
// "Missing EXPO_PUBLIC_SUPABASE_URL" guard while loading this test bundle.
jest.mock('@/hooks/useExtractionReceipt', () => ({
  useExtractionReceipt: () => ({ receipt: null, isLoading: false, error: null }),
}));
import { StoryPanelV2 } from '@/components/service-hub/estimate-studio/scope/StoryPanelV2';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsApi';

const story: BlueprintStoryV2 = {
  project_id: 'p1', mean_confidence: 0.94,
  truth_distribution: { observed: 0, derived: 0, field_confirmed: 0, vendor_confirmed: 0, permit_confirmed: 0, assumed: 0, missing: 0 },
  updated_at: '2026-05-22T00:00:00Z',
  coverage: { sheets_total: 11, sheets_read: 11, pages_total: 39, pages_read: 39 },
  chapters: [
    {
      key: 'cover', ordinal: 1, title: "What's getting built", confidence: 1, source_pages: [1],
      source_sheets: [{ sheet_code: 'G-001', sheet_title: 'Cover', page_number: 1, render_url: null }],
      thumbnail_url: 'https://x/c1.png',
      zones: { what_this_is: 'Cover sheet narrative', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
    },
    {
      key: 'restrooms', ordinal: 6, title: "Restrooms & Mother's Room", confidence: 0.94, source_pages: [13],
      source_sheets: [{ sheet_code: 'A-403', sheet_title: 'Restroom Plan', page_number: 13, render_url: null }],
      thumbnail_url: null,
      zones: { what_this_is: 'Bathroom build-out', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
    },
  ],
};

describe('StoryPanelV2', () => {
  it('renders the empty state when there are no chapters', () => {
    const empty: BlueprintStoryV2 = { ...story, chapters: [] };
    const { getByTestId, queryByTestId } = render(
      <StoryPanelV2 story={empty} activeChapterKey={null} onSelectChapter={() => {}} />
    );
    expect(getByTestId('story-panel-v2-empty')).toBeTruthy();
    expect(queryByTestId('chapter-strip')).toBeNull();
  });

  it('falls back to the first chapter when activeChapterKey is null', () => {
    const { getByText, getAllByText } = render(
      <StoryPanelV2 story={story} activeChapterKey={null} onSelectChapter={() => {}} />
    );
    // Title appears in both left pane and strip; left-pane-only narrative confirms which chapter is active.
    expect(getAllByText(/What's getting built/).length).toBeGreaterThanOrEqual(1);
    expect(getByText(/Cover sheet narrative/)).toBeTruthy();
  });

  it('falls back to the first chapter when activeChapterKey does not match any chapter', () => {
    const { getByText } = render(
      <StoryPanelV2 story={story} activeChapterKey="does-not-exist" onSelectChapter={() => {}} />
    );
    expect(getByText(/Cover sheet narrative/)).toBeTruthy();
  });

  it('renders the chapter strip with all chapters when there are chapters', () => {
    const { getByTestId } = render(
      <StoryPanelV2 story={story} activeChapterKey="cover" onSelectChapter={() => {}} />
    );
    // Each chapter renders its own pressable card with testID `chapter-card-<key>`.
    expect(getByTestId('chapter-card-cover')).toBeTruthy();
    expect(getByTestId('chapter-card-restrooms')).toBeTruthy();
  });

  it('switches to the requested chapter when activeChapterKey matches', () => {
    const { getByText } = render(
      <StoryPanelV2 story={story} activeChapterKey="restrooms" onSelectChapter={() => {}} />
    );
    // Bathroom build-out narrative is only rendered in the left pane.
    expect(getByText(/Bathroom build-out/)).toBeTruthy();
  });

  it('renders the outer panel testID when chapters exist', () => {
    const { getByTestId } = render(
      <StoryPanelV2 story={story} activeChapterKey="cover" onSelectChapter={() => {}} />
    );
    expect(getByTestId('story-panel-v2')).toBeTruthy();
  });
});
