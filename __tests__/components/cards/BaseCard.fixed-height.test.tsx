/**
 * BaseCard.fixed-height.test.tsx
 *
 * Closing-gate test for Wave 4.1 of the Anam-Ava production polish plan.
 * Verifies the 580px-fixed-height contract:
 *   1. BaseCard's outer container has both `height: 580` and `maxHeight: 580`.
 *   2. The contract holds for sparse children (1 line) AND dense children (50+ lines).
 *   3. The exported CARD_HEIGHT constant is 580.
 *   4. The container has `overflow: hidden` so any internal-overflow does not
 *      escape the card silhouette.
 *   5. The 5 artifact-type cards (Hotel, Product, Property, Business, Generic)
 *      all use BaseCard so they inherit the fixed height.
 *
 * Why this matters: the user reported that property cards rendered at
 * inconsistent sizes -- one card much bigger than the others, which they
 * misperceived as "cards opening by themselves." Fixing the size primitive
 * (min-height + content-driven growth -> fixed height + internal scroll)
 * resolves both reports with one change. This test locks the contract.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';

// Stub the supabase client so importing ProductCard (which transitively pulls
// SupabaseProvider) doesn't blow up on missing EXPO_PUBLIC_SUPABASE_URL during
// jest. Tests here only assert layout/sizing, never call supabase.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

// SupabaseProvider's useSupabase() throws when called outside the provider.
// In ProductCard we read session/suiteId via this hook -- stub it so the
// render tree gets a benign null session.
jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ session: null, suiteId: null, isLoading: false, signOut: jest.fn() }),
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Tested module
import { BaseCard, CARD_HEIGHT } from '@/components/cards/BaseCard';

// Cards under contract -- must all flow through BaseCard
import { HotelCard } from '@/components/cards/HotelCard';
import { ProductCard } from '@/components/cards/ProductCard';
import { PropertyCard } from '@/components/cards/PropertyCard';
import { BusinessCard } from '@/components/cards/BusinessCard';
import { GenericCard } from '@/components/cards/GenericCard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the card outer container by testID. We attach a testID to BaseCard
 *  via the `testID` prop. */
function findCard(tree: ReturnType<typeof render>) {
  return tree.getByTestId('card-under-test');
}

/** Flatten a RN style array to a single object so we can assert properties. */
function flatStyle(node: ReturnType<typeof findCard>): Record<string, unknown> {
  const raw = node.props.style;
  if (!raw) return {};
  if (Array.isArray(raw)) {
    return raw.filter(Boolean).reduce((acc: Record<string, unknown>, s) => {
      if (s && typeof s === 'object') Object.assign(acc, s);
      return acc;
    }, {});
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('BaseCard fixed 580px height contract (Wave 4.1)', () => {
  it('exports CARD_HEIGHT = 580', () => {
    expect(CARD_HEIGHT).toBe(580);
  });

  it('renders a card with height: 580 AND maxHeight: 580 (sparse content)', () => {
    const tree = render(
      <BaseCard safety={null} testID="card-under-test" accessibilityLabel="sparse">
        <Text>Sparse content</Text>
      </BaseCard>,
    );
    const style = flatStyle(findCard(tree));
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
    // No minHeight allowed -- if minHeight is set, the card can grow when
    // content > 580 (the original bug). Removing minHeight is part of the fix.
    expect(style.minHeight).toBeUndefined();
  });

  it('keeps height: 580 AND maxHeight: 580 with dense content (no growth)', () => {
    const denseRows = Array.from({ length: 80 }, (_, i) => (
      <View key={i}>
        <Text>Row {i} -- this is a row of dense content meant to overflow</Text>
      </View>
    ));
    const tree = render(
      <BaseCard safety={null} testID="card-under-test" accessibilityLabel="dense">
        {denseRows}
      </BaseCard>,
    );
    const style = flatStyle(findCard(tree));
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
    expect(style.minHeight).toBeUndefined();
  });

  it('clips overflow at the card boundary so internal scroll stays inside', () => {
    const tree = render(
      <BaseCard safety={null} testID="card-under-test">
        <Text>Content</Text>
      </BaseCard>,
    );
    const style = flatStyle(findCard(tree));
    expect(style.overflow).toBe('hidden');
  });

  it('exposes a scroll surface so overflowed content is reachable (a11y label)', () => {
    const tree = render(
      <BaseCard safety={null} testID="card-under-test">
        <Text>Content</Text>
      </BaseCard>,
    );
    // The internal ScrollView is labelled "Card details" so screen readers can
    // discover the scroll affordance even though it has no scrollbar UI.
    expect(tree.getByLabelText('Card details')).toBeTruthy();
  });
});

describe('Artifact-type cards inherit the 580px contract', () => {
  // Minimal stable record fixtures -- only the fields each card unconditionally
  // reads. This is intentionally sparse to confirm the fixed height holds even
  // when the card has near-zero content.

  const SPARSE_HOTEL = { name: 'Hotel A' };
  const SPARSE_PRODUCT = { product_name: 'Drill' };
  const SPARSE_PROPERTY = { _cardSection: 'overview', _sectionLabel: 'Overview', address: '1 Main St' };
  const SPARSE_BUSINESS = { name: 'Plumber A' };
  const SPARSE_GENERIC = { name: 'Item A' };

  const baseCardProps = {
    artifactType: 'TestType',
    index: 0,
    total: 1,
    confidence: null,
    onAction: () => {},
    isActive: false,
  };

  it('HotelCard root has fixed 580 height', () => {
    const tree = render(<HotelCard record={SPARSE_HOTEL} {...baseCardProps} />);
    const card = tree.getByLabelText('Hotel A hotel card');
    const style = flatStyle({ props: card.props } as any);
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
  });

  it('ProductCard root has fixed 580 height', () => {
    const tree = render(<ProductCard record={SPARSE_PRODUCT} {...baseCardProps} />);
    const card = tree.getByLabelText('Drill product card');
    const style = flatStyle({ props: card.props } as any);
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
  });

  it('PropertyCard root has fixed 580 height', () => {
    const tree = render(<PropertyCard record={SPARSE_PROPERTY} {...baseCardProps} />);
    const card = tree.getByLabelText('Overview for 1 Main St');
    const style = flatStyle({ props: card.props } as any);
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
  });

  it('BusinessCard root has fixed 580 height', () => {
    const tree = render(<BusinessCard record={SPARSE_BUSINESS} {...baseCardProps} />);
    const card = tree.getByLabelText('Plumber A business card');
    const style = flatStyle({ props: card.props } as any);
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
  });

  it('GenericCard root has fixed 580 height', () => {
    const tree = render(<GenericCard record={SPARSE_GENERIC} {...baseCardProps} />);
    const card = tree.getByLabelText('Item A research card');
    const style = flatStyle({ props: card.props } as any);
    expect(style.height).toBe(580);
    expect(style.maxHeight).toBe(580);
  });
});
