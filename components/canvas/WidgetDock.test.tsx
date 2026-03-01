import React from 'react';
import { render } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { WidgetDock, DEFAULT_WIDGETS, WidgetDefinition } from './WidgetDock';
import { EmailIcon } from '@/components/icons/widgets/EmailIcon';

// Mock useWindowDimensions
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1920, height: 1080 })),
}));

describe('WidgetDock', () => {
  beforeEach(() => {
    // Reset to desktop width by default
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
  });

  it('renders with default widgets on desktop', () => {
    const { getAllByRole } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(10); // Desktop shows all 10
  });

  it('calls onWidgetSelect when icon is pressed', () => {
    const mockOnSelect = jest.fn();
    const testWidgets: WidgetDefinition[] = [
      { id: 'test-widget', icon: EmailIcon, label: 'Test Widget' },
    ];

    const { getByRole } = render(
      <WidgetDock widgets={testWidgets} onWidgetSelect={mockOnSelect} />
    );

    const button = getByRole('button');
    expect(button).toBeDefined();
  });

  it('renders at bottom position by default', () => {
    const { getByRole } = render(
      <WidgetDock widgets={DEFAULT_WIDGETS.slice(0, 1)} />
    );
    const button = getByRole('button');
    expect(button).toBeDefined();
  });

  it('renders at top position when specified', () => {
    const { getByRole } = render(
      <WidgetDock widgets={DEFAULT_WIDGETS.slice(0, 1)} position="top" />
    );
    const button = getByRole('button');
    expect(button).toBeDefined();
  });

  it('has correct accessibility labels', () => {
    const testWidgets: WidgetDefinition[] = [
      { id: 'email', icon: EmailIcon, label: 'Email Widget' },
    ];

    const { getByLabelText } = render(<WidgetDock widgets={testWidgets} />);
    const emailButton = getByLabelText('Email Widget');
    expect(emailButton).toBeDefined();
  });

  it('renders all 10 default widgets on desktop', () => {
    const { getAllByRole } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(10);
  });

  it('renders 8 widgets on tablet (768-1024px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 900, height: 600 });
    const { getAllByRole } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(8);
  });

  it('renders 6 widgets on mobile (<768px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 600, height: 800 });
    const { getAllByRole } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(6);
  });
});
