/**
 * CardRegistry.test.ts -- Unit tests for card type resolution.
 *
 * Verifies Law #3 (Fail Closed): unknown types resolve to a placeholder, never null.
 */

import { resolveCard, registerCard, registeredTypes } from '../CardRegistry';

describe('CardRegistry', () => {
  it('resolveCard returns a component for known types', () => {
    const card = resolveCard('HotelShortlist');
    expect(card).toBeDefined();
    expect(typeof card).toBe('function');
  });

  it('resolveCard returns GenericCardPlaceholder for unknown types (Law #3)', () => {
    const card = resolveCard('CompletelyUnknownType_XYZ');
    expect(card).toBeDefined();
    expect(typeof card).toBe('function');
    expect(card.displayName).toBe('GenericCardPlaceholder');
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
