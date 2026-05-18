/**
 * Service Memory pages — RTL smoke tests.
 *
 * Wave 5.1b-6 + 5.1b-7: verifies the page composition of the three new
 * service-memory pages (index / results / [memoryId]). These tests run
 * thin: they assert the right hooks are called with the right arguments
 * and the right primary components render, NOT every visual nuance (the
 * regression-lock Lock #20 covers content invariants).
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — declared before component imports (Jest hoisting)
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockSetParams = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => false);

let mockLocalSearchParams: Record<string, string | string[]> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    setParams: mockSetParams,
    back: mockBack,
    canGoBack: mockCanGoBack,
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
  Stack: { Screen: () => null },
}));

// Search hook spy
const mockUseServiceMemorySearch = jest.fn();
jest.mock('@/lib/service-memory/useServiceMemorySearch', () => ({
  useServiceMemorySearch: (filters: unknown) => mockUseServiceMemorySearch(filters),
}));

// Detail hook spy
const mockUseServiceMemoryDetail = jest.fn();
jest.mock('@/lib/service-memory/useServiceMemoryDetail', () => ({
  useServiceMemoryDetail: (id: unknown) => mockUseServiceMemoryDetail(id),
}));

// Tenant provider — not exercised by these tests; return a stable shape.
jest.mock('@/providers/TenantProvider', () => ({
  useTenant: () => ({ tenant: { officeId: 'office-test' } }),
}));

// Shell, error boundary, and heavy children — stub to plain Views so the
// tests don't pull in ScrollView / native-only listeners.
jest.mock('@/components/service-hub/ServiceHubShell', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ServiceHubShell: (props: { children: React.ReactNode }) =>
      R.createElement(RN.View, { testID: 'service-hub-shell' }, props.children),
  };
});

jest.mock('@/components/PageErrorBoundary', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    PageErrorBoundary: (props: { children: React.ReactNode }) =>
      R.createElement(RN.View, null, props.children),
  };
});

// AvaOrb pulls in animation primitives — stub to a marker View.
jest.mock('@/components/AvaOrb', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    AvaOrb: () => R.createElement(RN.View, { testID: 'ava-orb' }),
  };
});

// LedAmbientSearchBar — render an accessible search input proxy.
jest.mock('@/components/office-memory/LedAmbientSearchBar', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    LedAmbientSearchBar: (props: {
      value: string;
      onSubmit: (q: string) => void;
    }) =>
      R.createElement(RN.View, {
        testID: 'led-search-bar',
        accessibilityValue: { text: props.value },
      }),
  };
});

// Stub the results grid + filter bar + toggle — they have their own tests.
jest.mock('@/components/office-memory/MemoryFilterBar', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    MemoryFilterBar: () =>
      R.createElement(RN.View, { testID: 'memory-filter-bar' }),
  };
});
jest.mock('@/components/office-memory/MemoryGridListToggle', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    MemoryGridListToggle: () =>
      R.createElement(RN.View, { testID: 'memory-grid-list-toggle' }),
  };
});
jest.mock('@/components/office-memory/MemoryResultsGrid', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    MemoryResultsGrid: (props: { items: Array<{ id: string; title: string }> }) =>
      R.createElement(
        RN.View,
        { testID: 'memory-results-grid' },
        (props.items ?? []).map((m) =>
          R.createElement(RN.Text, { key: m.id, testID: `grid-item-${m.id}` }, m.title),
        ),
      ),
  };
});

// Detail body and header from the office-memory barrel — stub to markers.
jest.mock('@/components/office-memory/details', () => {
  const RN = require('react-native');
  const R = require('react');
  const factory = (testID: string) => (props: { memory: { id: string } }) =>
    R.createElement(
      RN.View,
      { testID },
      R.createElement(RN.Text, null, props.memory?.id ?? ''),
    );
  return {
    MemoryDetailHeader: factory('memory-detail-header'),
    MemoryDetailNote: factory('memory-detail-note'),
    MemoryDetailDocument: factory('memory-detail-document'),
    MemoryDetailStrategy: factory('memory-detail-strategy'),
    MemoryDetailResearch: factory('memory-detail-research'),
    MemoryDetailTask: factory('memory-detail-task'),
    MemoryDetailSummary: factory('memory-detail-summary'),
    MemoryDetailTranscript: factory('memory-detail-transcript'),
    MemoryDetailSession: factory('memory-detail-session'),
    MemoryDetailMeeting: factory('memory-detail-meeting'),
    MemoryDetailCall: factory('memory-detail-call'),
    MemoryDetailInvoice: factory('memory-detail-invoice'),
    MemoryDetailQuote: factory('memory-detail-quote'),
    MemoryDetailSMS: factory('memory-detail-sms'),
  };
});

// Stub the service memory rail itself.
jest.mock('@/components/service-hub/ServiceMemoryDetailRightRail', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ServiceMemoryDetailRightRail: () =>
      R.createElement(RN.View, { testID: 'service-memory-right-rail' }),
  };
});

// Keyframe injection is a side-effect — no-op it.
jest.mock('@/components/office-memory/cardAnimations', () => ({
  injectMemoryKeyframes: jest.fn(),
}));

// devLog is harmless but referenced.
jest.mock('@/lib/devLog', () => ({ devLog: jest.fn() }));

// ---------------------------------------------------------------------------
// Import-after-mocks
// ---------------------------------------------------------------------------

import ServiceMemoryIndex from '@/app/service-hub/memory/index';
import ServiceMemoryResults from '@/app/service-hub/memory/results';
import ServiceMemoryDetail from '@/app/service-hub/memory/[memoryId]';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSummary(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 'note' as const,
    title: `Memory ${id}`,
    summary: '...',
    date: '2026-05-17T00:00:00Z',
    tags: [],
    bookmarked: false,
    ...overrides,
  };
}

function makeDetail(id: string, overrides: Record<string, unknown> = {}) {
  return {
    ...makeSummary(id),
    participants: [],
    createdBy: 'system',
    keyDecisions: [],
    linkedFacts: [],
    activityFiles: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockLocalSearchParams = {};
  mockUseServiceMemorySearch.mockReturnValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 9,
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUseServiceMemoryDetail.mockReturnValue({
    memory: null,
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
});

describe('Service Memory — index page', () => {
  it('renders the hero with the literal title "Service Memory"', () => {
    render(<ServiceMemoryIndex />);
    expect(screen.getByText('Service Memory')).toBeTruthy();
  });

  it('renders the AvaOrb centerpiece and the LED search bar', () => {
    render(<ServiceMemoryIndex />);
    expect(screen.getByTestId('ava-orb')).toBeTruthy();
    expect(screen.getByTestId('led-search-bar')).toBeTruthy();
  });
});

describe('Service Memory — results page', () => {
  it('reads the search query from URL params and passes it to useServiceMemorySearch', () => {
    mockLocalSearchParams = { q: 'roof leak' };
    render(<ServiceMemoryResults />);
    expect(mockUseServiceMemorySearch).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'roof leak', page: 1 }),
    );
  });

  it('renders the page header "Service Memory Results"', () => {
    render(<ServiceMemoryResults />);
    expect(screen.getByText('Service Memory Results')).toBeTruthy();
  });

  it('renders the office-memory filter bar, toggle, and results grid', () => {
    render(<ServiceMemoryResults />);
    expect(screen.getByTestId('memory-filter-bar')).toBeTruthy();
    expect(screen.getByTestId('memory-grid-list-toggle')).toBeTruthy();
    expect(screen.getByTestId('memory-results-grid')).toBeTruthy();
  });

  it('forwards search results to the MemoryResultsGrid', () => {
    mockUseServiceMemorySearch.mockReturnValueOnce({
      items: [makeSummary('mem-1'), makeSummary('mem-2')],
      total: 2,
      page: 1,
      pageSize: 9,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<ServiceMemoryResults />);
    expect(screen.getByTestId('grid-item-mem-1')).toBeTruthy();
    expect(screen.getByTestId('grid-item-mem-2')).toBeTruthy();
  });

  it('shows the empty-state subtitle when total === 0', () => {
    render(<ServiceMemoryResults />);
    expect(screen.getByText('No memories match the current filters.')).toBeTruthy();
  });
});

describe('Service Memory — detail page', () => {
  it('calls useServiceMemoryDetail with the memoryId from the route param', () => {
    mockLocalSearchParams = { memoryId: 'mem-42' };
    render(<ServiceMemoryDetail />);
    expect(mockUseServiceMemoryDetail).toHaveBeenCalledWith('mem-42');
  });

  it('renders the empty-state when memory is null and not loading', () => {
    mockLocalSearchParams = { memoryId: 'missing' };
    mockUseServiceMemoryDetail.mockReturnValueOnce({
      memory: null,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<ServiceMemoryDetail />);
    expect(screen.getByText('Memory not found')).toBeTruthy();
  });

  it('renders the error variant when the hook returns an error', () => {
    mockLocalSearchParams = { memoryId: 'broken' };
    mockUseServiceMemoryDetail.mockReturnValueOnce({
      memory: null,
      loading: false,
      error: new Error('boom'),
      refetch: jest.fn(),
    });
    render(<ServiceMemoryDetail />);
    expect(screen.getByText("We couldn't load that memory")).toBeTruthy();
  });

  it('renders the type-routed body + service right rail on success', () => {
    mockLocalSearchParams = { memoryId: 'mem-1' };
    mockUseServiceMemoryDetail.mockReturnValueOnce({
      memory: makeDetail('mem-1', { type: 'note' }),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<ServiceMemoryDetail />);
    expect(screen.getByTestId('memory-detail-header')).toBeTruthy();
    expect(screen.getByTestId('memory-detail-note')).toBeTruthy();
    expect(screen.getByTestId('service-memory-right-rail')).toBeTruthy();
  });

  it('routes call-type memories to MemoryDetailCall via the type map', () => {
    mockLocalSearchParams = { memoryId: 'call-1' };
    mockUseServiceMemoryDetail.mockReturnValueOnce({
      memory: makeDetail('call-1', { type: 'call' }),
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<ServiceMemoryDetail />);
    expect(screen.getByTestId('memory-detail-call')).toBeTruthy();
  });
});
