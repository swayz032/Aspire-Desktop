import React from 'react';
import { render } from '@testing-library/react-native';

// Mock route to Scope.
jest.mock('expo-router', () => ({
  usePathname: () => '/service-hub/estimate-studio/scope',
}));

// Mock tenant + blueprint upload to provide a projectId for the hook.
jest.mock('@/providers', () => ({
  useTenant: () => ({
    tenant: { officeId: 'office-1' },
    isLoading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/lib/blueprintUploadStore', () => ({
  useBlueprintUploadSnapshot: () => ({
    projectId: 'p1',
    response: null,
    phase: 'idle',
  }),
}));

// Mock the hook to return a v2 story with one chapter.
jest.mock('@/hooks/useBlueprintStory', () => ({
  useBlueprintStory: () => ({
    story: null, assemblies: [], materials: [], missingInputs: [],
    isLoading: false, isPolling: false, backendDeployed: true, error: null,
    refetch: jest.fn(),
    storyV2: {
      project_id: 'p1',
      mean_confidence: 0.9,
      truth_distribution: {
        observed: 1, derived: 0, field_confirmed: 0, vendor_confirmed: 0,
        permit_confirmed: 0, assumed: 0, missing: 0,
      },
      updated_at: '2026-05-22T00:00:00Z',
      coverage: { sheets_total: 1, sheets_read: 1, pages_total: 1, pages_read: 1 },
      chapters: [{
        key: 'a', ordinal: 1, title: 'A', confidence: 1, source_pages: [1],
        source_sheets: [], thumbnail_url: null,
        zones: { what_this_is: '', in_scope: [], not_in_scope: [], tasks: [], buy_list: [], open_questions: [] },
      }],
    },
  }),
}));

// The sibling ScopeContextPayload pulls a lot of dependencies; stub it out
// for this test — we only care about ScopeStoryContextCard mounting.
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/ScopeContextPayload',
  () => ({ ScopeContextPayload: () => null }),
);

// PropertySummaryCard / ServiceBriefCard etc. also pull dependencies; stub.
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/PropertySummaryCard',
  () => ({ PropertySummaryCard: () => null }),
);
jest.mock(
  '@/components/service-hub/ServiceBriefCard',
  () => ({ ServiceBriefCard: () => null }),
);
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/MaterialsRouteContextCard',
  () => ({ MaterialsRouteContextCard: () => null }),
);
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/MaterialsBlueprintContextCard',
  () => ({ MaterialsBlueprintContextCard: () => null }),
);
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/PlansPhotosContextPayload',
  () => ({ PlansPhotosContextPayload: () => null }),
);
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/TakeoffContextPayload',
  () => ({ TakeoffContextPayload: () => null }),
);
jest.mock(
  '@/components/service-hub/estimate-studio/tim-rail/EstimateContextPayload',
  () => ({ EstimateContextPayload: () => null }),
);

import { TimRailContextTab } from '@/components/service-hub/estimate-studio/tim-rail/TimRailContextTab';

describe('TimRailContextTab — Story Mode v2 on Scope route', () => {
  it('mounts ScopeStoryContextCard when on Scope route and storyV2 has chapters', () => {
    const { getByTestId } = render(<TimRailContextTab loading={false} />);
    expect(getByTestId('story-context-card')).toBeTruthy();
  });
});
