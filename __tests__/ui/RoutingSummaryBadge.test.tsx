import React from 'react';
import { render } from '@testing-library/react-native';
import { RoutingSummaryBadge } from '@/components/ui/RoutingSummaryBadge';

describe('RoutingSummaryBadge', () => {
  it('returns null when all counts are zero', () => {
    const { queryByTestId } = render(
      <RoutingSummaryBadge
        summary={{ auto: 0, review: 0, open: 0 }}
        testID="rsb-empty"
      />,
    );
    expect(queryByTestId('rsb-empty')).toBeNull();
  });

  it('renders three segments when all > 0', () => {
    const { getByTestId } = render(
      <RoutingSummaryBadge
        summary={{ auto: 5, review: 3, open: 1 }}
        testID="rsb-all"
      />,
    );
    const el = getByTestId('rsb-all');
    expect(el).toBeTruthy();
    expect(el.props.accessibilityLabel).toBe(
      'Routing: 5 auto-populated, 3 pending review, 1 open questions',
    );
  });

  it('renders single segment when only one count > 0', () => {
    const { getByTestId, queryByText } = render(
      <RoutingSummaryBadge
        summary={{ auto: 5, review: 0, open: 0 }}
        testID="rsb-one"
      />,
    );
    expect(getByTestId('rsb-one')).toBeTruthy();
    expect(queryByText('AUTO 5')).toBeTruthy();
    expect(queryByText('AVA 0')).toBeNull();
    expect(queryByText('BLOCK 0')).toBeNull();
  });

  it('caps counts above 99 as 99+', () => {
    const { queryByText } = render(
      <RoutingSummaryBadge
        summary={{ auto: 150, review: 100, open: 0 }}
        testID="rsb-cap"
      />,
    );
    expect(queryByText('AUTO 99+')).toBeTruthy();
    expect(queryByText('AVA 99+')).toBeTruthy();
  });

  it('a11y label uses raw counts', () => {
    const { getByTestId } = render(
      <RoutingSummaryBadge
        summary={{ auto: 2, review: 0, open: 4 }}
        testID="rsb-a11y"
      />,
    );
    expect(getByTestId('rsb-a11y').props.accessibilityLabel).toBe(
      'Routing: 2 auto-populated, 0 pending review, 4 open questions',
    );
  });
});
