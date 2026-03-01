/**
 * InvoiceWidget.test.tsx — Unit tests for InvoiceWidget component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { InvoiceWidget } from './InvoiceWidget';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                data: [],
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
      unsubscribe: jest.fn(),
    })),
  },
}));

describe('InvoiceWidget', () => {
  const mockProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  it('renders loading state initially', () => {
    const { getByText } = render(<InvoiceWidget {...mockProps} />);
    expect(getByText('Loading invoices...')).toBeTruthy();
  });

  it('renders with suite_id and office_id props', () => {
    const { toJSON } = render(<InvoiceWidget {...mockProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts optional callback props', () => {
    const handleInvoiceClick = jest.fn();
    const handleCreateClick = jest.fn();

    const { toJSON } = render(
      <InvoiceWidget
        {...mockProps}
        onInvoiceClick={handleInvoiceClick}
        onCreateClick={handleCreateClick}
      />
    );

    expect(toJSON()).toBeTruthy();
  });

  it('renders with correct structure', () => {
    const { toJSON } = render(<InvoiceWidget {...mockProps} />);
    const tree = toJSON();
    expect(toJSON()).toMatchSnapshot();
  });
});
