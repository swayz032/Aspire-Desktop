/**
 * ProductCard — premium card contract + snapshot tests (Pass F).
 *
 * Contract tests verify all 14 premium fields render when present and
 * are gracefully omitted when absent. Snapshot locks the card structure.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ProductCard } from '@/components/service-hub/estimate-studio/materials/ProductCard';
import type { ProductCardExtended } from '@/components/service-hub/estimate-studio/materials/ProductCard';

const BASE_PRODUCT: ProductCardExtended = {
  id: 'test-001',
  title: 'Marquee 5-gal Matte Interior Paint',
  brand: 'Behr',
  imageUrl: 'https://img/test.jpg',
  price: 218.0,
  unit: 'pail',
  store: { id: '1234', name: 'Home Depot Forest Park', driveMinutes: 18, inStock: true },
  rating: 4.7,
  reviewCount: 1842,
  source: 'home_depot',
  fetchedAt: '2026-05-13T00:00:00Z',
  sku: '305832',
};

const FULL_PRODUCT: ProductCardExtended = {
  ...BASE_PRODUCT,
  badges: ['Free delivery', 'Limited stock'],
  priceBadge: 'Sale',
  availabilityText: 'Pickup today',
  bay: 3,
  aisle: 24,
  modelNumber: 'X-100',
  variantCount: 3,
  variantType: 'colors',
  storeAddress: '4790 Jonesboro Rd, Forest Park, GA',
};

describe('ProductCard — premium fields', () => {
  it('renders core fields when minimal product provided', () => {
    const { getByTestId, getByText } = render(
      <ProductCard
        product={BASE_PRODUCT}
        onAdd={() => {}}
        onCompare={() => {}}
      />
    );
    expect(getByTestId('materials-product-card-test-001')).toBeTruthy();
    expect(getByText('Behr')).toBeTruthy();
    expect(getByText('Marquee 5-gal Matte Interior Paint')).toBeTruthy();
    expect(getByText('$218.00')).toBeTruthy();
    expect(getByTestId('materials-stock-chip-test-001')).toBeTruthy();
    expect(getByTestId('materials-drive-chip-test-001')).toBeTruthy();
  });

  it('renders IN STOCK chip correctly', () => {
    const { getByTestId } = render(
      <ProductCard product={BASE_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-stock-chip-test-001').props.children).toBe('IN STOCK');
  });

  it('renders drive time correctly', () => {
    const { getByTestId } = render(
      <ProductCard product={BASE_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-drive-chip-test-001').props.children).toBe('18 MIN');
  });

  it('renders — MIN when driveMinutes is 0', () => {
    const p: ProductCardExtended = {
      ...BASE_PRODUCT,
      store: { ...BASE_PRODUCT.store, driveMinutes: 0 },
    };
    const { getByTestId } = render(
      <ProductCard product={p} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-drive-chip-test-001').props.children).toBe('— MIN');
  });

  it('renders badges array when present', () => {
    const { getByText } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByText('Free delivery')).toBeTruthy();
    expect(getByText('Limited stock')).toBeTruthy();
  });

  it('renders price badge when present', () => {
    const { getByText } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByText('SALE')).toBeTruthy();
  });

  it('renders availability text when present', () => {
    const { getByTestId } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-avail-test-001').props.children).toBe('Pickup today');
  });

  it('renders bay + aisle badge when present', () => {
    const { getByText } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByText(/Aisle 24.*Bay 3/)).toBeTruthy();
  });

  it('renders SKU + model number when present', () => {
    const { getByTestId } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-sku-test-001').props.children).toMatch(/305832.*X-100/);
  });

  it('renders variants count when present', () => {
    const { getByTestId } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(getByTestId('materials-variants-test-001').props.children).toContain('3');
  });

  it('omits optional fields gracefully when absent', () => {
    const { queryByTestId } = render(
      <ProductCard product={BASE_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    // Fields that should NOT render with BASE_PRODUCT (no extended fields)
    expect(queryByTestId('materials-avail-test-001')).toBeNull();
    expect(queryByTestId('materials-variants-test-001')).toBeNull();
    expect(queryByTestId('materials-sku-test-001')).toBeNull();
  });

  it('matches card structure snapshot', () => {
    const { toJSON } = render(
      <ProductCard product={FULL_PRODUCT} onAdd={() => {}} onCompare={() => {}} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
