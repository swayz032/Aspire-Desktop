/**
 * CardRegistry.test.ts -- Unit tests for card type resolution.
 *
 * Verifies Law #3 (Fail Closed): unknown types resolve to a placeholder, never null.
 */

// Stub supabase + SupabaseProvider so ProductCard's useSupabase() import chain
// doesn't fail on missing EXPO_PUBLIC_SUPABASE_URL during jest. These tests
// only assert registry resolution, never render the cards.
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

jest.mock('@/providers/SupabaseProvider', () => ({
  useSupabase: () => ({ session: null, suiteId: null, isLoading: false, signOut: jest.fn() }),
  SupabaseProvider: ({ children }: { children: any }) => children,
}));

import { resolveCard, registerCard, registeredTypes } from '../CardRegistry';

describe('CardRegistry', () => {
  it('resolveCard returns a component for known types', () => {
    const card = resolveCard('HotelShortlist');
    expect(card).toBeDefined();
    expect(typeof card).toBe('function');
  });

  it('resolveCard returns GenericCard for unknown types (Law #3)', () => {
    const card = resolveCard('CompletelyUnknownType_XYZ');
    expect(card).toBeDefined();
    expect(typeof card).toBe('function');
    // GenericCard is a real component (not a placeholder) — Law #3: never null
    expect(card.name).toBe('GenericCard');
  });

  it('registeredTypes includes all known types', () => {
    const types = registeredTypes();
    expect(types).toContain('HotelShortlist');
    expect(types).toContain('PriceComparison');
    expect(types).toContain('VendorShortlist');
    expect(types).toContain('ProspectList');
    expect(types).toContain('FlightShortlist');
    expect(types).toContain('RestaurantShortlist');
    expect(types).toContain('ServiceComparison');
    expect(types).toContain('GenericResearch');
  });

  it('registerCard allows overriding a type', () => {
    const Custom = () => null;
    Custom.displayName = 'CustomTestCard';
    registerCard('TestType', Custom);

    const resolved = resolveCard('TestType');
    expect(resolved).toBe(Custom);
    expect(resolved.displayName).toBe('CustomTestCard');
  });

  it('registerCard does not affect other types', () => {
    const before = resolveCard('HotelShortlist');
    registerCard('SomeOtherType', () => null);
    const after = resolveCard('HotelShortlist');
    expect(before).toBe(after);
  });
});
