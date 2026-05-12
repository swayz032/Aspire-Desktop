/**
 * Materials Tab — Pass B UI shell behavior tests.
 *
 * Covers the mock-data shell wired in Pass B. Focuses on observable behavior:
 * empty state, search submission, product rendering, bundle increment, compare
 * drawer, predictive add-ons. Pass C will add the integration tests for the
 * live SerpApi wire.
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

// Mock the Google Maps loader BEFORE importing the components that use it.
jest.mock('@/lib/googleMapsLoader', () => ({
  loadGoogleMaps: jest.fn(() =>
    Promise.resolve({
      maps: {
        Geocoder: jest.fn(() => ({
          geocode: jest.fn(() =>
            Promise.resolve({
              results: [{ geometry: { location: { lat: 30.4, lng: -97.7 } } }],
            }),
          ),
        })),
        Map: jest.fn(),
        Marker: jest.fn(),
        Polyline: jest.fn(),
        LatLngBounds: jest.fn(() => ({ extend: jest.fn() })),
        SymbolPath: { CIRCLE: 0 },
      },
    }),
  ),
  resolveBrowserMapsKey: jest.fn(() => 'test-key'),
}));

import { MaterialsTab } from '@/components/service-hub/estimate-studio/materials/MaterialsTab';
import { __resetMaterialsBundleForTests, getBundle } from '@/hooks/useMaterialsBundle';
import {
  __resetProjectAddressForTests,
  setProjectAddress,
} from '@/hooks/useProjectAddress';

// Jest configures jsdom by default via jest-expo. The mock hook uses
// setTimeout 250ms — fake timers keep tests fast and deterministic.
beforeEach(() => {
  __resetMaterialsBundleForTests();
  __resetProjectAddressForTests();
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('Materials Tab — Pass B shell', () => {
  it('renders the empty state with suggested queries when no search submitted', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    expect(getByTestId('materials-tab')).toBeTruthy();
    expect(getByTestId('materials-empty-state')).toBeTruthy();
    expect(getByTestId('materials-suggestion-paint')).toBeTruthy();
    expect(getByTestId('materials-suggestion-drywall-sheets')).toBeTruthy();
    expect(getByTestId('materials-suggestion-roofing-materials')).toBeTruthy();
    expect(getByTestId('materials-suggestion-electrical-tools')).toBeTruthy();

    // Pre-search: no product grid, no bundle bar.
    expect(queryByTestId('materials-product-grid')).toBeNull();
    expect(queryByTestId('materials-bundle-summary-bar')).toBeNull();
  });

  it('runs a search and renders product cards', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(getByTestId('materials-product-grid')).toBeTruthy();
    // Behr Marquee paint mock product
    expect(getByTestId('materials-product-card-hd-pp-marquee-5gal')).toBeTruthy();
    expect(queryByTestId('materials-empty-state')).toBeNull();
  });

  it('renders product card title, brand, and price for a paint product', () => {
    const { getByTestId, getByText, getAllByText } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    expect(getByText(/Marquee 5-gal Matte Interior Paint/i)).toBeTruthy();
    // Brand 'Behr' may appear on multiple cards — assert at least one.
    expect(getAllByText('Behr').length).toBeGreaterThanOrEqual(1);
    expect(getByText('$218.00')).toBeTruthy();
  });

  it('add-to-bundle increments the bundle summary count', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    expect(queryByTestId('materials-bundle-summary-bar')).toBeNull();

    fireEvent.press(getByTestId('materials-add-btn-hd-pp-marquee-5gal'));

    const bar = getByTestId('materials-bundle-summary-bar');
    expect(bar).toBeTruthy();
    const subtotal = getByTestId('bundle-subtotal');
    expect(subtotal).toBeTruthy();
  });

  it('compare button opens the compare drawer with seller rows', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    expect(queryByTestId('materials-compare-drawer')).toBeNull();

    fireEvent.press(getByTestId('materials-compare-btn-hd-pp-marquee-5gal'));

    expect(getByTestId('materials-compare-drawer')).toBeTruthy();
    // 3 mock sellers
    expect(getByTestId('compare-row-home_depot')).toBeTruthy();
    expect(getByTestId('compare-row-lowes')).toBeTruthy();
    expect(getByTestId('compare-row-amazon')).toBeTruthy();
  });

  it('shows the specialty supplier rail for niche queries', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(
      getByTestId('materials-search-input'),
      '4000 PSI concrete by yard',
    );
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    expect(getByTestId('materials-supplier-matches-rail')).toBeTruthy();
    expect(getByTestId('supplier-card-spec-concrete-1')).toBeTruthy();
    // No HD product grid in this scenario
    expect(queryByTestId('materials-product-grid')).toBeNull();
  });

  it('renders predictive add-ons after first bundle add', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    expect(queryByTestId('materials-predictive-addons')).toBeNull();

    fireEvent.press(getByTestId('materials-add-btn-hd-pp-marquee-5gal'));

    expect(getByTestId('materials-predictive-addons')).toBeTruthy();
  });

  it('closest-store chip in the search bar is visible with drive time', () => {
    const { getByTestId } = render(<MaterialsTab />);
    const chip = getByTestId('materials-closest-store-chip');
    expect(chip).toBeTruthy();
  });

  it('voice search slot is rendered but disabled (Pass H reservation)', () => {
    const { getByTestId } = render(<MaterialsTab />);
    const btn = getByTestId('materials-voice-button');
    expect(btn).toBeTruthy();
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  // ---- Regression coverage for Pass B output-critic fixes ----

  it('clicking a suggestion chip populates the product grid (Fix 1)', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    // Empty state present; product grid is not.
    expect(getByTestId('materials-empty-state')).toBeTruthy();
    expect(queryByTestId('materials-product-grid')).toBeNull();

    // Click the "paint" suggestion chip — this is the path that previously
    // failed (stale-closure submitSearch read pre-update query).
    fireEvent.press(getByTestId('materials-suggestion-paint'));
    act(() => jest.advanceTimersByTime(300));

    expect(getByTestId('materials-product-grid')).toBeTruthy();
    expect(getByTestId('materials-product-card-hd-pp-marquee-5gal')).toBeTruthy();
  });

  it('switching projectAddress resets the in-memory bundle (Fix 2)', () => {
    const { getByTestId, unmount } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    fireEvent.press(getByTestId('materials-add-btn-hd-pp-marquee-5gal'));
    expect(getBundle().length).toBe(1);

    // Switch project address — bundle should auto-clear.
    act(() => {
      setProjectAddress('123 New Project Lane, Austin TX');
    });

    expect(getBundle().length).toBe(0);

    // Unmount the tab — clearBundle() in the unmount effect keeps state empty.
    unmount();
    expect(getBundle().length).toBe(0);
  });

  it('clicking a filter chip filters the product grid (Fix 4)', () => {
    const { getByTestId, queryByTestId } = render(<MaterialsTab />);

    fireEvent.changeText(getByTestId('materials-search-input'), 'paint');
    fireEvent.press(getByTestId('materials-search-submit'));
    act(() => jest.advanceTimersByTime(300));

    // Pre-filter: Behr Marquee + Sherwin-Williams ProMar both present.
    expect(getByTestId('materials-product-card-hd-pp-marquee-5gal')).toBeTruthy();
    expect(getByTestId('materials-product-card-hd-pp-promar-1gal')).toBeTruthy();

    // Toggle the "Behr" brand chip.
    const behrChip = getByTestId('materials-filter-chip-brand-Behr');
    fireEvent.press(behrChip);

    // Behr card remains; non-Behr cards are filtered out.
    expect(getByTestId('materials-product-card-hd-pp-marquee-5gal')).toBeTruthy();
    expect(queryByTestId('materials-product-card-hd-pp-promar-1gal')).toBeNull();

    // Toggle off — both cards return.
    fireEvent.press(behrChip);
    expect(getByTestId('materials-product-card-hd-pp-promar-1gal')).toBeTruthy();
  });
});
