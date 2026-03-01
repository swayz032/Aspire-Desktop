/**
 * HybridWebPreview Component Tests
 *
 * Covers:
 *   - Split-panel layout rendering (left activity, right browser)
 *   - Responsive vertical stacking on tablet (<1024px)
 *   - Panel headers (ACTIVITY / BROWSER labels)
 *   - Count badges for events
 *   - Empty browser events state
 *   - Activity events forwarding
 *   - Custom testID support
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

// Mock reanimated -- use require() inside factory (jest-expo scope rule)
jest.mock('react-native-reanimated', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: {
      View: R.forwardRef((props: Record<string, unknown>, ref: unknown) =>
        R.createElement(RN.View, { ...props, ref }),
      ),
    },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withSpring: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});

// Mock canvas tokens
jest.mock('@/constants/canvas.tokens', () => ({
  CanvasTokens: {
    background: { base: '#0a0a0a', surface: '#1E1E1E', elevated: '#2A2A2A' },
    border: { subtle: '#2a2a2a', emphasis: 'rgba(59, 130, 246, 0.4)' },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)',
      muted: 'rgba(255, 255, 255, 0.5)',
    },
    shadow: { ambient: 'rgba(59, 130, 246, 0.1)' },
    glow: { ava: '#A855F7', finn: '#10B981', eli: '#3B82F6' },
  },
}));

// Mock useReducedMotion
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// Mock WebView (used by WebPreview native path)
jest.mock('react-native-webview', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    WebView: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'webview-mock', ...props }),
  };
});

// Mock ReactMarkdown (ESM module)
jest.mock('react-markdown', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) =>
      R.createElement(RN.Text, { testID: 'markdown-mock' }, children),
  };
});

// Mock useWindowDimensions with a module-level mock variable
let mockWindowWidth = 1440;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWindowWidth, height: 900 }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { render } from '@testing-library/react-native';
import { HybridWebPreview, type HybridWebPreviewProps } from '../HybridWebPreview';
import type { AgentActivityEvent } from '../WebPreview';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockActivityEvents: AgentActivityEvent[] = [
  {
    type: 'thinking',
    message: 'Analyzing request...',
    icon: 'bulb',
    timestamp: Date.now() - 5000,
    agent: 'ava',
  },
  {
    type: 'tool_call',
    message: 'Searching the web...',
    icon: 'hammer',
    timestamp: Date.now() - 3000,
    agent: 'eli',
  },
  {
    type: 'done',
    message: 'Complete',
    icon: 'checkmark',
    timestamp: Date.now() - 1000,
  },
];

const mockBrowserEvents: BrowserScreenshotEvent[] = [
  {
    screenshot_url: 'https://example.com/screenshot-1.png',
    screenshot_id: 'ss-001',
    page_url: 'https://www.bing.com/search?q=aspire',
    page_title: 'Bing Search',
    timestamp: Date.now() - 4000,
    viewport_width: 1280,
    viewport_height: 800,
  },
  {
    screenshot_url: 'https://example.com/screenshot-2.png',
    screenshot_id: 'ss-002',
    page_url: 'https://www.example.com',
    page_title: 'Example Domain',
    timestamp: Date.now() - 2000,
    viewport_width: 1280,
    viewport_height: 800,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockWindowWidth = 1440;
});

describe('HybridWebPreview Component', () => {
  const defaultProps: HybridWebPreviewProps = {
    activityEvents: mockActivityEvents,
    browserEvents: mockBrowserEvents,
  };

  describe('Layout', () => {
    it('renders both panels on desktop', () => {
      const { getByTestId } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
      expect(getByTestId('hybrid-activity-panel')).toBeTruthy();
      expect(getByTestId('hybrid-browser-panel')).toBeTruthy();
    });

    it('renders with custom testID', () => {
      const { getByTestId } = render(
        React.createElement(HybridWebPreview, {
          ...defaultProps,
          testID: 'custom-hybrid',
        }),
      );

      expect(getByTestId('custom-hybrid')).toBeTruthy();
    });
  });

  describe('Panel Headers', () => {
    it('renders ACTIVITY header label', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByText('ACTIVITY')).toBeTruthy();
    });

    it('renders BROWSER header label', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByText('BROWSER')).toBeTruthy();
    });

    it('renders activity event count badge', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByText('3')).toBeTruthy(); // 3 activity events
    });

    it('renders browser event count badge', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByText('2')).toBeTruthy(); // 2 browser events
    });

    it('hides activity count badge when no events', () => {
      const { queryByText, getByText } = render(
        React.createElement(HybridWebPreview, {
          ...defaultProps,
          activityEvents: [],
        }),
      );

      expect(getByText('ACTIVITY')).toBeTruthy();
      // Count badge should not appear
      expect(queryByText('0')).toBeNull();
    });
  });

  describe('Responsive Stacking', () => {
    it('renders both panels on tablet (stacked)', () => {
      mockWindowWidth = 800;

      const { getByTestId } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
      expect(getByTestId('hybrid-activity-panel')).toBeTruthy();
      expect(getByTestId('hybrid-browser-panel')).toBeTruthy();
    });

    it('renders both panels on desktop viewport (>=1024px)', () => {
      mockWindowWidth = 1440;

      const { getByTestId } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
      expect(getByTestId('hybrid-activity-panel')).toBeTruthy();
      expect(getByTestId('hybrid-browser-panel')).toBeTruthy();
    });
  });

  describe('Empty Browser Events', () => {
    it('renders BrowserPanel empty state when no browser events', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, {
          ...defaultProps,
          browserEvents: [],
        }),
      );

      expect(getByText('Browser View')).toBeTruthy();
    });
  });

  describe('Browser Loading State', () => {
    it('passes isBrowserLoading to BrowserPanel', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, {
          ...defaultProps,
          browserEvents: [],
          isBrowserLoading: true,
        }),
      );

      expect(getByText('Loading browser view...')).toBeTruthy();
    });
  });

  describe('Browser Error State', () => {
    it('passes browserError to BrowserPanel', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, {
          ...defaultProps,
          browserEvents: [],
          browserError: 'Connection failed',
        }),
      );

      expect(getByText('Failed to load screenshot')).toBeTruthy();
      expect(getByText('Connection failed')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty activity events and empty browser events', () => {
      const { getByText } = render(
        React.createElement(HybridWebPreview, {
          activityEvents: [],
          browserEvents: [],
        }),
      );

      expect(getByText('ACTIVITY')).toBeTruthy();
      expect(getByText('BROWSER')).toBeTruthy();
    });

    it('does not crash when rapidly updating browser events', () => {
      const { rerender } = render(
        React.createElement(HybridWebPreview, defaultProps),
      );

      const newBrowserEvents: BrowserScreenshotEvent[] = [
        ...mockBrowserEvents,
        {
          screenshot_url: 'https://example.com/screenshot-3.png',
          screenshot_id: 'ss-003',
          page_url: 'https://www.example.org',
          page_title: 'Example Org',
          timestamp: Date.now(),
          viewport_width: 1280,
          viewport_height: 800,
        },
      ];

      expect(() => {
        rerender(
          React.createElement(HybridWebPreview, {
            ...defaultProps,
            browserEvents: newBrowserEvents,
          }),
        );
      }).not.toThrow();
    });
  });
});
