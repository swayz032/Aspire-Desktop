import React from 'react';
import { render } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { WidgetDock, DEFAULT_WIDGETS } from '../WidgetDock';

// Mock useWindowDimensions
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1920, height: 1080 })),
}));

describe('WidgetDock - Visual Regression', () => {
  beforeEach(() => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
  });

  it('matches snapshot at desktop breakpoint (1920px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot at laptop breakpoint (1280px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1280, height: 800 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot at tablet breakpoint (900px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 900, height: 600 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot at mobile breakpoint (600px)', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 600, height: 800 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot with top position', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS} position="top" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot with single widget', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS.slice(0, 1)} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot with 5 widgets', () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1920, height: 1080 });
    const { toJSON } = render(<WidgetDock widgets={DEFAULT_WIDGETS.slice(0, 5)} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
