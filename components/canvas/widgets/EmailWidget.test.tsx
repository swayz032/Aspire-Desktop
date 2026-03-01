/**
 * EmailWidget.test.tsx — Unit tests for EmailWidget component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { EmailWidget } from './EmailWidget';

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

describe('EmailWidget', () => {
  const mockProps = {
    suiteId: 'suite-123',
    officeId: 'office-456',
  };

  it('renders loading state initially', () => {
    const { getByText } = render(<EmailWidget {...mockProps} />);
    expect(getByText('Loading emails...')).toBeTruthy();
  });

  it('renders with suite_id and office_id props', () => {
    const { toJSON } = render(<EmailWidget {...mockProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('accepts optional callback props', () => {
    const handleEmailClick = jest.fn();
    const handleComposeClick = jest.fn();

    const { toJSON } = render(
      <EmailWidget
        {...mockProps}
        onEmailClick={handleEmailClick}
        onComposeClick={handleComposeClick}
      />
    );

    expect(toJSON()).toBeTruthy();
  });

  it('renders with correct structure', () => {
    const { toJSON } = render(<EmailWidget {...mockProps} />);
    const tree = toJSON();
    expect(tree).toMatchSnapshot();
  });
});
