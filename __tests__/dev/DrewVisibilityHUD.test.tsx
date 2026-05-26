import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import {
  DrewVisibilityHUD,
  computeTierDistribution,
  computeRoutingRollup,
  computeMaterialCounts,
  computePercentiles,
  formatRelative,
} from '@/components/dev/DrewVisibilityHUD';
import type {
  BlueprintStoryV2,
  MaterialInstance,
} from '@/lib/api/blueprintsStoryV2';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStory(
  overrides?: Partial<BlueprintStoryV2>,
): BlueprintStoryV2 {
  return {
    project_id: 'proj-1',
    mean_confidence: 0.6,
    truth_distribution: { observed: 0, derived: 0, assumed: 0 },
    chapters: [
      {
        key: 'a',
        ordinal: 0,
        title: 'A',
        confidence: 0.9,
        source_pages: [1],
        source_sheets: [],
        thumbnail_url: null,
        zones: {} as any,
        confidence_tier: 'GREEN',
        routing_summary: { auto: 3, review: 1, open: 0 },
      },
      {
        key: 'b',
        ordinal: 1,
        title: 'B',
        confidence: 0.6,
        source_pages: [2],
        source_sheets: [],
        thumbnail_url: null,
        zones: {} as any,
        confidence_tier: 'YELLOW',
        routing_summary: { auto: 0, review: 2, open: 1 },
      },
      {
        key: 'c',
        ordinal: 2,
        title: 'C',
        confidence: 0.3,
        source_pages: [3],
        source_sheets: [],
        thumbnail_url: null,
        zones: {} as any,
        confidence_tier: 'RED',
        // no routing_summary
      },
      {
        key: 'd',
        ordinal: 3,
        title: 'D',
        confidence: 0,
        source_pages: [],
        source_sheets: [],
        thumbnail_url: null,
        zones: {} as any,
        // no confidence_tier
      },
    ],
    coverage: { sheets_total: 7, sheets_read: 4, pages_total: 12, pages_read: 7 },
    updated_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    ...overrides,
  } as BlueprintStoryV2;
}

function mat(
  overrides: Partial<MaterialInstance> & { sheet_id: string },
): MaterialInstance {
  return {
    instance_id: 'i-' + Math.random().toString(36).slice(2, 8),
    sheet_code: 'E-1',
    symbol_name: 'sym',
    legend_label: 'L1',
    legend_specification: 'spec',
    cluster_id: 'c1',
    motif_hash: 'h1',
    resolution_source: 'topology_match',
    confidence: 0.9,
    instance_count: 1,
    tier: 'GREEN',
    receipt_id: 'r1',
    ...overrides,
  } as MaterialInstance;
}

function setSearch(search: string): void {
  // jsdom: window.location is read-only but its .search is writable on most
  // Jest setups. We define a fresh property to be safe across environments.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

function ensureSessionStorage(): void {
  if (typeof window === 'undefined') return;
  if (window.sessionStorage) return;
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (k: string): string | null => (k in store ? store[k] : null),
      setItem: (k: string, v: string): void => {
        store[k] = String(v);
      },
      removeItem: (k: string): void => {
        delete store[k];
      },
      clear: (): void => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (): string | null => null,
      length: 0,
    },
  });
}

function clearDismiss(): void {
  try {
    window.sessionStorage?.removeItem('drew-visibility-hud-dismissed');
  } catch {
    // no-op
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DrewVisibilityHUD', () => {
  beforeEach(() => {
    Platform.OS = 'web';
    ensureSessionStorage();
    setSearch('');
    clearDismiss();
  });

  it('renders null without ?dv=1', () => {
    setSearch('?foo=bar');
    const { queryByTestId } = render(
      <DrewVisibilityHUD story={makeStory()} />,
    );
    expect(queryByTestId('drew-visibility-hud')).toBeNull();
  });

  it('renders with ?dv=1', () => {
    setSearch('?dv=1');
    const { getByTestId } = render(
      <DrewVisibilityHUD story={makeStory()} />,
    );
    expect(getByTestId('drew-visibility-hud')).toBeTruthy();
  });

  it('returns null on native (Platform.OS = ios)', () => {
    Platform.OS = 'ios';
    setSearch('?dv=1');
    const { queryByTestId } = render(
      <DrewVisibilityHUD story={makeStory()} />,
    );
    expect(queryByTestId('drew-visibility-hud')).toBeNull();
    Platform.OS = 'web';
  });

  it('computes tier distribution from a fixture story', () => {
    const t = computeTierDistribution(makeStory());
    expect(t).toEqual({ GREEN: 1, YELLOW: 1, RED: 1, UNKNOWN: 1 });
  });

  it('computes routing rollup across chapters', () => {
    const r = computeRoutingRollup(makeStory());
    // a: 3/1/0  b: 0/2/1  c+d: no routing_summary → ignored.
    expect(r).toEqual({ auto: 3, review: 3, open: 1 });
  });

  it('computes material counts (total / BOUND / UNKNOWN)', () => {
    const map = new Map<string, MaterialInstance[]>();
    map.set('s1', [
      mat({ sheet_id: 's1', tier: 'GREEN', resolution_source: 'topology_match' }),
      mat({ sheet_id: 's1', tier: 'YELLOW', resolution_source: 'unknown' }),
    ]);
    map.set('s2', [
      mat({ sheet_id: 's2', tier: 'GREEN', resolution_source: 'cluster_propagation' }),
      mat({ sheet_id: 's2', tier: 'RED', resolution_source: 'unknown' }),
    ]);
    const counts = computeMaterialCounts(map);
    expect(counts).toEqual({ total: 4, bound: 2, unknown: 2 });
  });

  it('computes p50/p95 latencies from a sample array', () => {
    // n=20, sorted = 1..20. floor(20*0.5)=10 → sorted[10]=11; floor(20*0.95)=19 → sorted[19]=20.
    const samples = Array.from({ length: 20 }, (_, i) => i + 1);
    const p = computePercentiles(samples);
    expect(p.n).toBe(20);
    expect(p.p50).toBe(11);
    expect(p.p95).toBe(20);
  });

  it('returns null percentiles for empty sample array', () => {
    const p = computePercentiles([]);
    expect(p).toEqual({ p50: null, p95: null, n: 0 });
  });

  it('dismiss button hides HUD and persists dismissal in sessionStorage', () => {
    setSearch('?dv=1');
    const { getByTestId, queryByTestId } = render(
      <DrewVisibilityHUD story={makeStory()} />,
    );
    expect(getByTestId('drew-visibility-hud')).toBeTruthy();
    fireEvent.press(getByTestId('drew-visibility-hud-dismiss'));
    expect(queryByTestId('drew-visibility-hud')).toBeNull();
    expect(window.sessionStorage.getItem('drew-visibility-hud-dismissed')).toBe('1');

    // Fresh mount with the dismiss key still set: still hidden.
    const { queryByTestId: q2 } = render(
      <DrewVisibilityHUD story={makeStory()} />,
    );
    expect(q2('drew-visibility-hud')).toBeNull();
  });

  it('formats relative timestamps', () => {
    expect(formatRelative(null)).toBe('—');
    expect(formatRelative(undefined)).toBe('—');
    expect(formatRelative(new Date(Date.now() - 30_000).toISOString())).toBe('just now');
    expect(formatRelative(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(formatRelative(new Date(Date.now() - 2 * 3_600_000).toISOString())).toBe('2h ago');
  });

  it('renders all five rows when gate is open with non-empty inputs', () => {
    setSearch('?dv=1');
    const map = new Map<string, MaterialInstance[]>();
    map.set('s1', [mat({ sheet_id: 's1', tier: 'GREEN' })]);
    const { getByTestId } = render(
      <DrewVisibilityHUD
        story={makeStory()}
        materialsBySheet={map}
        receiptFetchLatenciesMs={[100, 200, 300, 400, 500]}
      />,
    );
    expect(getByTestId('drew-visibility-hud-story').props.children).toContain(
      'chapters: 4',
    );
    expect(getByTestId('drew-visibility-hud-tiers').props.children).toContain(
      'GREEN 1',
    );
    expect(getByTestId('drew-visibility-hud-routing').props.children).toContain(
      'AUTO 3',
    );
    expect(getByTestId('drew-visibility-hud-materials').props.children).toContain(
      'BOUND',
    );
    expect(getByTestId('drew-visibility-hud-latency').props.children).toContain(
      'n=5',
    );
  });
});
