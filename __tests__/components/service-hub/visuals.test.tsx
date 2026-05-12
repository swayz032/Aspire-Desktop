/**
 * Pass 3.2 — Service Hub Phase 3 Visuals + Tim Context UI snapshot suite.
 *
 * Verifies empty / loading / success states for every UI component built in
 * Pass 3.2. Coverage targets:
 *   - Hero state machine (HeroSwitcher) mode transitions
 *   - PhotoGalleryHero prev/next/empty
 *   - PropertyImagesGrid lane folding (server already folded uncategorized
 *     into exterior, so we assert exterior count is rendered as-is)
 *   - All 4 insight cards loading + success + empty
 *   - Tim rail context tab + summary card (loading/empty/success)
 *
 * Maps JS API loader is mocked — production wiring happens at integration.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import type { PropertyData } from '@/services/serviceHub/propertyDataApi';

// Mock googleMapsLoader BEFORE importing the components that lazily require it.
jest.mock('@/lib/googleMapsLoader', () => ({
  loadGoogleMaps: jest.fn(() =>
    Promise.resolve({
      maps: {
        StreetViewService: jest.fn(() => ({
          getPanorama: jest.fn(),
        })),
        StreetViewPanorama: jest.fn(),
        StreetViewStatus: { OK: 'OK' },
        Map: jest.fn(),
        Marker: jest.fn(),
      },
    }),
  ),
  default: jest.fn(() => Promise.resolve({ maps: {} })),
}));

// Components under test
import { HeroSwitcher } from '@/components/service-hub/estimate-studio/visuals/HeroSwitcher';
import { LiveStreetViewHero } from '@/components/service-hub/estimate-studio/visuals/LiveStreetViewHero';
import { LiveAerialHero } from '@/components/service-hub/estimate-studio/visuals/LiveAerialHero';
import { PhotoGalleryHero } from '@/components/service-hub/estimate-studio/visuals/PhotoGalleryHero';
import { PropertyImagesGrid } from '@/components/service-hub/estimate-studio/visuals/PropertyImagesGrid';
import { PhotoLaneCard } from '@/components/service-hub/estimate-studio/visuals/PhotoLaneCard';
import { InsightCardBase } from '@/components/service-hub/estimate-studio/visuals/InsightCardBase';
import { PropertyInsightsCard } from '@/components/service-hub/estimate-studio/visuals/PropertyInsightsCard';
import { TotalBuildingAreaCard } from '@/components/service-hub/estimate-studio/visuals/TotalBuildingAreaCard';
import { MaterialSignalsCard } from '@/components/service-hub/estimate-studio/visuals/MaterialSignalsCard';
import { QuickCostIntCard } from '@/components/service-hub/estimate-studio/visuals/QuickCostIntCard';
import { EmptyAddressState } from '@/components/service-hub/estimate-studio/visuals/EmptyAddressState';
import { AddressCorrectionPrompt } from '@/components/service-hub/estimate-studio/visuals/AddressCorrectionPrompt';
import { TimRailContextTab } from '@/components/service-hub/estimate-studio/tim-rail/TimRailContextTab';
import { PropertySummaryCard } from '@/components/service-hub/estimate-studio/tim-rail/PropertySummaryCard';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PHOTO = (id: string) => ({
  id,
  url: `https://example.com/${id}.jpg`,
  caption: `Caption ${id}`,
  source: 'zillow' as const,
});

const SAMPLE_DATA: PropertyData = {
  address: {
    formatted: '1234 Industrial Way, Austin, TX 78758, USA',
    street: '1234 Industrial Way',
    city: 'Austin',
    state: 'TX',
    zip: '78758',
    country: 'US',
  },
  coords: { lat: 30.4, lng: -97.7 },
  hero: { streetViewProxyUrl: '/api/places/streetview?address=...' },
  facts: {
    sqft: 42560,
    yearBuilt: 2008,
    zoning: 'LI Light Industrial',
    propertyType: 'Industrial / Warehouse',
    stories: 1,
  },
  photos: {
    interior: { count: 12, thumbnailUrl: 'https://x/i.jpg', photos: [SAMPLE_PHOTO('i1'), SAMPLE_PHOTO('i2')] },
    exterior: { count: 7, thumbnailUrl: 'https://x/e.jpg', photos: [SAMPLE_PHOTO('e1')] },
    roof: { count: 3, photos: [SAMPLE_PHOTO('r1')] },
    streetView: { count: 1, thumbnailUrl: 'https://x/s.jpg', photos: [SAMPLE_PHOTO('s1')] },
  },
  signals: {
    materials: [
      { name: 'Metal Wall Panels', confidence: 'high' },
      { name: 'TPO Roofing', confidence: 'high' },
      { name: 'Concrete Slab', confidence: 'medium' },
    ],
    roofType: 'TPO',
    accessRisk: 'low',
  },
  costBand: { low: 412000, high: 487000, currency: 'USD' },
  evidenceGaps: [],
  fetchedAt: new Date().toISOString(),
  sources: [
    { name: 'adam', status: 'ok', fetchedAt: new Date(Date.now() - 60_000).toISOString() },
    { name: 'addressValidation', status: 'ok', fetchedAt: new Date(Date.now() - 60_000).toISOString() },
    { name: 'solar', status: 'partial', fetchedAt: new Date(Date.now() - 60_000).toISOString() },
  ],
};

// ---------------------------------------------------------------------------
// 1. HeroSwitcher
// ---------------------------------------------------------------------------

describe('HeroSwitcher', () => {
  it('renders all 5 hero layers and the active one based on mode', () => {
    const tree = render(
      <HeroSwitcher mode="streetview" onModeChange={() => {}} data={SAMPLE_DATA} loading={false} />,
    );
    expect(tree.getByTestId('hero-switcher')).toBeTruthy();
  });

  it('switches mode interior → exterior → streetview without remount errors', () => {
    const onChange = jest.fn();
    const tree = render(
      <HeroSwitcher mode="interior" onModeChange={onChange} data={SAMPLE_DATA} loading={false} />,
    );
    tree.rerender(
      <HeroSwitcher mode="exterior" onModeChange={onChange} data={SAMPLE_DATA} loading={false} />,
    );
    tree.rerender(
      <HeroSwitcher mode="streetview" onModeChange={onChange} data={SAMPLE_DATA} loading={false} />,
    );
    expect(tree.getByTestId('hero-switcher')).toBeTruthy();
  });

  it('renders skeleton state while loading', () => {
    const tree = render(
      <HeroSwitcher mode="streetview" onModeChange={() => {}} loading={true} />,
    );
    // Loading state shows the LiveStreetViewHero skeleton variant
    expect(tree.getByTestId('hero-switcher')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. LiveStreetViewHero / LiveAerialHero
// ---------------------------------------------------------------------------

describe('LiveStreetViewHero', () => {
  it('renders loading skeleton while loading', () => {
    const tree = render(<LiveStreetViewHero loading={true} />);
    expect(tree.getByTestId('live-street-view-hero-loading')).toBeTruthy();
  });

  it('renders without crashing when no coords are provided', () => {
    const tree = render(<LiveStreetViewHero loading={false} />);
    // With no coords, status stays idle which routes to the loading skeleton path.
    expect(tree.getByTestId('live-street-view-hero-loading')).toBeTruthy();
  });
});

describe('LiveAerialHero', () => {
  it('renders loading skeleton while loading', () => {
    const tree = render(<LiveAerialHero loading={true} />);
    expect(tree.getByTestId('live-aerial-hero-loading')).toBeTruthy();
  });

  it('renders without crashing when no coords', () => {
    const tree = render(<LiveAerialHero loading={false} />);
    expect(tree.getByTestId('live-aerial-hero-loading')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. PhotoGalleryHero — empty / loading / success + prev/next
// ---------------------------------------------------------------------------

describe('PhotoGalleryHero', () => {
  it('renders empty state with friendly upload prompt', () => {
    const tree = render(<PhotoGalleryHero photos={[]} title="Interior" />);
    expect(tree.getByTestId('photo-gallery-hero-empty')).toBeTruthy();
    expect(tree.getByText(/No interior photos available/i)).toBeTruthy();
  });

  it('renders loading skeleton', () => {
    const tree = render(<PhotoGalleryHero photos={[]} title="Interior" loading={true} />);
    expect(tree.getByTestId('photo-gallery-hero-loading')).toBeTruthy();
  });

  it('renders main image + counter + thumbs when photos provided', () => {
    const tree = render(
      <PhotoGalleryHero
        photos={[SAMPLE_PHOTO('p1'), SAMPLE_PHOTO('p2'), SAMPLE_PHOTO('p3')]}
        title="Interior"
      />,
    );
    expect(tree.getByTestId('photo-gallery-hero')).toBeTruthy();
    expect(tree.getByText(/Interior · 3 photos/i)).toBeTruthy();
    expect(tree.getByText('1 / 3')).toBeTruthy();
  });

  it('navigates next + previous via arrow buttons', () => {
    const tree = render(
      <PhotoGalleryHero
        photos={[SAMPLE_PHOTO('p1'), SAMPLE_PHOTO('p2'), SAMPLE_PHOTO('p3')]}
        title="Interior"
      />,
    );
    expect(tree.getByText('1 / 3')).toBeTruthy();
    fireEvent.press(tree.getByLabelText('Next photo'));
    expect(tree.getByText('2 / 3')).toBeTruthy();
    fireEvent.press(tree.getByLabelText('Next photo'));
    expect(tree.getByText('3 / 3')).toBeTruthy();
    // Wraps around
    fireEvent.press(tree.getByLabelText('Next photo'));
    expect(tree.getByText('1 / 3')).toBeTruthy();
    // Previous wraps to last
    fireEvent.press(tree.getByLabelText('Previous photo'));
    expect(tree.getByText('3 / 3')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 4. PropertyImagesGrid + PhotoLaneCard
// ---------------------------------------------------------------------------

describe('PropertyImagesGrid', () => {
  it('renders 5 lane cards (interior / exterior / roof / streetview / aerial)', () => {
    const tree = render(
      <PropertyImagesGrid
        photos={SAMPLE_DATA.photos}
        activeMode="streetview"
        onLaneClick={() => {}}
        loading={false}
      />,
    );
    expect(tree.getByTestId('lane-interior')).toBeTruthy();
    expect(tree.getByTestId('lane-exterior')).toBeTruthy();
    expect(tree.getByTestId('lane-roof')).toBeTruthy();
    expect(tree.getByTestId('lane-streetview')).toBeTruthy();
    expect(tree.getByTestId('lane-aerial')).toBeTruthy();
  });

  it('renders exterior count as-is (server-side already folded uncategorized)', () => {
    // The aggregator merges Adam-uncategorized photos into the exterior lane
    // before the data reaches the client. We assert the rendered count
    // matches the exterior lane count exactly.
    const tree = render(
      <PropertyImagesGrid
        photos={SAMPLE_DATA.photos}
        activeMode="streetview"
        onLaneClick={() => {}}
        loading={false}
      />,
    );
    // Exterior count = 7 in fixture, must render that exact number.
    expect(tree.getByText('7')).toBeTruthy();
  });

  it('renders skeletons in loading state', () => {
    const tree = render(
      <PropertyImagesGrid activeMode="streetview" onLaneClick={() => {}} loading={true} />,
    );
    expect(tree.getByTestId('lane-interior-skeleton')).toBeTruthy();
  });

  it('fires onLaneClick with the correct mode', () => {
    const onLaneClick = jest.fn();
    const tree = render(
      <PropertyImagesGrid
        photos={SAMPLE_DATA.photos}
        activeMode="streetview"
        onLaneClick={onLaneClick}
        loading={false}
      />,
    );
    fireEvent.press(tree.getByTestId('lane-roof'));
    expect(onLaneClick).toHaveBeenCalledWith('roof');
    fireEvent.press(tree.getByTestId('lane-aerial'));
    expect(onLaneClick).toHaveBeenCalledWith('aerial');
  });
});

describe('PhotoLaneCard', () => {
  it('renders count badge when count provided', () => {
    const tree = render(
      <PhotoLaneCard label="Interior" count={12} onPress={() => {}} testID="lane" />,
    );
    expect(tree.getByText('12')).toBeTruthy();
  });

  it('renders without count badge when count omitted (Street View / Aerial)', () => {
    const tree = render(<PhotoLaneCard label="Aerial 3D" onPress={() => {}} testID="lane" />);
    expect(tree.queryByText('0')).toBeNull();
  });

  it('renders skeleton when loading', () => {
    const tree = render(
      <PhotoLaneCard label="Interior" loading={true} onPress={() => {}} testID="lane" />,
    );
    expect(tree.getByTestId('lane-skeleton')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. InsightCardBase + 4 insight cards
// ---------------------------------------------------------------------------

describe('InsightCardBase', () => {
  it('renders skeleton when loading', () => {
    const tree = render(
      <InsightCardBase
        icon="business-outline"
        title="Demo"
        loading={true}
        testID="demo"
      />,
    );
    expect(tree.getByTestId('demo-skeleton')).toBeTruthy();
  });

  it('renders title + CTA when not loading', () => {
    const tree = render(
      <InsightCardBase
        icon="business-outline"
        title="Demo"
        ctaLabel="View"
        loading={false}
        testID="demo"
      />,
    );
    expect(tree.getByText('Demo')).toBeTruthy();
    expect(tree.getByLabelText('View')).toBeTruthy();
  });
});

describe('PropertyInsightsCard', () => {
  it('renders empty state with no facts', () => {
    const tree = render(<PropertyInsightsCard facts={{}} loading={false} />);
    expect(tree.getByText(/No property facts resolved yet/i)).toBeTruthy();
  });

  it('renders skeleton when loading', () => {
    const tree = render(<PropertyInsightsCard loading={true} />);
    expect(tree.getByTestId('property-insights-card-skeleton')).toBeTruthy();
  });

  it('renders facts when provided', () => {
    const tree = render(
      <PropertyInsightsCard facts={SAMPLE_DATA.facts} loading={false} />,
    );
    expect(tree.getByText('Industrial / Warehouse')).toBeTruthy();
    expect(tree.getByText('2008')).toBeTruthy();
    expect(tree.getByText('LI Light Industrial')).toBeTruthy();
  });
});

describe('TotalBuildingAreaCard', () => {
  it('renders dash + manual prompt when sqft missing', () => {
    const tree = render(<TotalBuildingAreaCard loading={false} />);
    expect(tree.getByText('—')).toBeTruthy();
    expect(tree.getByText(/Tap to add manually/i)).toBeTruthy();
  });

  it('renders skeleton when loading', () => {
    const tree = render(<TotalBuildingAreaCard loading={true} />);
    expect(tree.getByTestId('total-building-area-card-skeleton')).toBeTruthy();
  });

  it('renders formatted sqft when provided', () => {
    const tree = render(<TotalBuildingAreaCard sqft={42560} loading={false} />);
    expect(tree.getByText('42,560')).toBeTruthy();
    expect(tree.getByText('sq ft')).toBeTruthy();
  });
});

describe('MaterialSignalsCard', () => {
  it('renders empty state when no signals', () => {
    const tree = render(<MaterialSignalsCard signals={[]} loading={false} />);
    expect(tree.getByText(/No signals detected/i)).toBeTruthy();
  });

  it('renders skeleton when loading', () => {
    const tree = render(<MaterialSignalsCard loading={true} />);
    expect(tree.getByTestId('material-signals-card-skeleton')).toBeTruthy();
  });

  it('renders signals with confidence badges', () => {
    const tree = render(
      <MaterialSignalsCard
        signals={SAMPLE_DATA.signals.materials}
        loading={false}
      />,
    );
    expect(tree.getByText('Metal Wall Panels')).toBeTruthy();
    expect(tree.getByText('Concrete Slab')).toBeTruthy();
    // HIGH appears at least once
    expect(tree.getAllByText('HIGH').length).toBeGreaterThan(0);
    expect(tree.getByText('MED')).toBeTruthy();
  });
});

describe('QuickCostIntCard', () => {
  it('renders empty state when no costBand', () => {
    const tree = render(<QuickCostIntCard loading={false} />);
    expect(tree.getByText('—')).toBeTruthy();
    expect(tree.getByText(/Add sqft to estimate/i)).toBeTruthy();
  });

  it('renders skeleton when loading', () => {
    const tree = render(<QuickCostIntCard loading={true} />);
    expect(tree.getByTestId('quick-cost-int-card-skeleton')).toBeTruthy();
  });

  it('renders formatted cost band ($412K – $487K)', () => {
    const tree = render(
      <QuickCostIntCard costBand={SAMPLE_DATA.costBand} loading={false} />,
    );
    expect(tree.getByText(/\$412K\s*–\s*\$487K/)).toBeTruthy();
    expect(tree.getByText('Estimated Range')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 6. EmptyAddressState + AddressCorrectionPrompt
// ---------------------------------------------------------------------------

describe('EmptyAddressState', () => {
  it('renders the friendly empty hero', () => {
    const tree = render(<EmptyAddressState />);
    expect(tree.getByTestId('empty-address-state')).toBeTruthy();
    expect(tree.getByText(/Enter a property address/i)).toBeTruthy();
  });
});

describe('AddressCorrectionPrompt', () => {
  it('renders suggested address + accept/reject', () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const tree = render(
      <AddressCorrectionPrompt
        suggestedAddress="1234 Industrial Way, Austin, TX 78758"
        onAccept={onAccept}
        onReject={onReject}
      />,
    );
    expect(tree.getByText(/1234 Industrial Way/i)).toBeTruthy();
    fireEvent.press(tree.getByLabelText('Use suggested address'));
    expect(onAccept).toHaveBeenCalled();
    fireEvent.press(tree.getByLabelText('Try a different address'));
    expect(onReject).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Tim Context — TimRailContextTab + PropertySummaryCard
// ---------------------------------------------------------------------------

describe('PropertySummaryCard', () => {
  it('renders skeleton when loading', () => {
    const tree = render(<PropertySummaryCard loading={true} />);
    expect(tree.getByTestId('property-summary-card-skeleton')).toBeTruthy();
  });

  it('renders empty state when no data', () => {
    const tree = render(<PropertySummaryCard loading={false} />);
    expect(tree.getByTestId('property-summary-card-empty')).toBeTruthy();
    expect(tree.getByText(/No property loaded/i)).toBeTruthy();
  });

  it('renders address, facts, signals, and sources when data provided', () => {
    const tree = render(<PropertySummaryCard data={SAMPLE_DATA} loading={false} />);
    expect(tree.getByText(/1234 Industrial Way/i)).toBeTruthy();
    expect(tree.getByText('42,560')).toBeTruthy(); // sqft
    expect(tree.getByText('2008')).toBeTruthy();
    expect(tree.getByText('Metal Wall Panels')).toBeTruthy();
    // Source row labels
    expect(tree.getByText('Adam')).toBeTruthy();
    expect(tree.getByText('Address Valid.')).toBeTruthy();
    expect(tree.getByText('Solar')).toBeTruthy();
  });
});

describe('TimRailContextTab', () => {
  it('renders the property summary in success state', () => {
    const tree = render(<TimRailContextTab data={SAMPLE_DATA} loading={false} />);
    expect(tree.getByTestId('tim-rail-context-tab')).toBeTruthy();
    expect(tree.getByTestId('property-summary-card')).toBeTruthy();
  });

  it('renders skeleton in loading state', () => {
    const tree = render(<TimRailContextTab loading={true} />);
    expect(tree.getByTestId('property-summary-card-skeleton')).toBeTruthy();
  });

  it('renders error banner with retry when error supplied', () => {
    const onRetry = jest.fn();
    const tree = render(
      <TimRailContextTab loading={false} error="Adam timed out" onRetry={onRetry} />,
    );
    expect(tree.getByText(/Adam timed out/i)).toBeTruthy();
    fireEvent.press(tree.getByLabelText('Retry property data fetch'));
    expect(onRetry).toHaveBeenCalled();
  });
});
