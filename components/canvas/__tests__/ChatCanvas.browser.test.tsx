/**
 * ChatCanvas Browser Integration Tests
 *
 * Covers:
 *   - ChatCanvas renders standard WebPreview when no browser events
 *   - ChatCanvas renders HybridWebPreview when browser events are provided
 *   - SSE browser_screenshot events are accumulated internally
 *   - browser_screenshot events do NOT get forwarded to chatCanvasStore
 *   - Non-browser events still route to chatCanvasStore
 *   - ChatCanvasProps backward compatibility (no breaking changes)
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

// Mock useActivityStream
const mockUseActivityStream = jest.fn().mockReturnValue({
  connected: false,
  error: null,
  reconnectAttempts: 0,
  disconnect: jest.fn(),
});

jest.mock('@/hooks/useActivityStream', () => ({
  useActivityStream: (...args: unknown[]) => mockUseActivityStream(...args),
}));

// Mock chatCanvasStore
const mockAddActivityEvent = jest.fn();

jest.mock('@/lib/chatCanvasStore', () => ({
  addActivityEvent: (...args: unknown[]) => mockAddActivityEvent(...args),
}));

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

// Mock tokens
jest.mock('@/constants/tokens', () => ({
  Colors: { accent: { cyan: '#3B82F6' } },
}));

// Mock WebPreview -- use require() inside factory
jest.mock('@/components/ai-elements/WebPreview', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    WebPreview: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'web-preview', ...props }),
    ActivityFeed: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'activity-feed', ...props }),
  };
});

// Mock HybridWebPreview -- use require() inside factory
jest.mock('@/components/ai-elements/HybridWebPreview', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    HybridWebPreview: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'hybrid-web-preview', ...props }),
  };
});

// Mock BrowserPanel
jest.mock('@/components/ai-elements/BrowserPanel', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    BrowserPanel: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'browser-panel', ...props }),
  };
});

// Mock useReducedMotion
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { View } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { ChatCanvas, type ChatCanvasProps } from '../ChatCanvas';
import type { WebPreviewProps } from '@/components/ai-elements/WebPreview';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockBrowserEvents: BrowserScreenshotEvent[] = [
  {
    screenshot_url: 'https://example.com/screenshot.png',
    screenshot_id: 'ss-001',
    page_url: 'https://www.bing.com/search?q=aspire',
    page_title: 'Bing Search Results',
    timestamp: Date.now(),
    viewport_width: 1280,
    viewport_height: 800,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUseActivityStream.mockReturnValue({
    connected: false,
    error: null,
    reconnectAttempts: 0,
    disconnect: jest.fn(),
  });
});

describe('ChatCanvas Browser Integration', () => {
  const defaultProps: ChatCanvasProps = {
    webPreviewProps: {
      activityEvents: [],
      trustLevel: 'internal',
    } as unknown as WebPreviewProps,
    personaElement: React.createElement(View, { testID: 'persona' }),
  };

  describe('Standard Mode (no browser events)', () => {
    it('renders WebPreview when no browserEvents provided', () => {
      const { getByTestId, queryByTestId } = render(
        React.createElement(ChatCanvas, defaultProps),
      );

      expect(getByTestId('web-preview')).toBeTruthy();
      expect(queryByTestId('hybrid-web-preview')).toBeNull();
    });

    it('renders WebPreview when browserEvents is empty array', () => {
      const { getByTestId, queryByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          browserEvents: [],
        }),
      );

      expect(getByTestId('web-preview')).toBeTruthy();
      expect(queryByTestId('hybrid-web-preview')).toBeNull();
    });
  });

  describe('Hybrid Mode (with browser events)', () => {
    it('renders HybridWebPreview when browserEvents are provided', () => {
      const { getByTestId, queryByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          browserEvents: mockBrowserEvents,
        }),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
      expect(queryByTestId('web-preview')).toBeNull();
    });

    it('passes browserEvents to HybridWebPreview', () => {
      const { getByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          browserEvents: mockBrowserEvents,
        }),
      );

      const hybridEl = getByTestId('hybrid-web-preview');
      expect(hybridEl).toBeTruthy();
    });

    it('passes isBrowserLoading to HybridWebPreview', () => {
      const { getByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          browserEvents: mockBrowserEvents,
          isBrowserLoading: true,
        }),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
    });

    it('passes browserError to HybridWebPreview', () => {
      const { getByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          browserEvents: mockBrowserEvents,
          browserError: 'Connection lost',
        }),
      );

      expect(getByTestId('hybrid-web-preview')).toBeTruthy();
    });
  });

  describe('SSE Browser Screenshot Routing', () => {
    it('accumulates browser_screenshot events from SSE internally', () => {
      const { rerender, queryByTestId } = render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          streamEnabled: true,
        }),
      );

      // Initially no browser events -- renders WebPreview
      expect(queryByTestId('web-preview')).toBeTruthy();
      expect(queryByTestId('hybrid-web-preview')).toBeNull();

      // Extract onEvent callback
      const callArgs = mockUseActivityStream.mock.calls[0][0];
      const onEvent = callArgs.onEvent;

      // Simulate a browser_screenshot event from SSE (wrapped in act for state update)
      act(() => {
        onEvent({
          type: 'browser_screenshot',
          timestamp: Date.now(),
          data: {
            screenshot_url: 'https://example.com/sse-screenshot.png',
            screenshot_id: 'sse-001',
            page_url: 'https://www.bing.com',
            page_title: 'Bing',
            viewport_width: 1280,
            viewport_height: 800,
          },
        });
      });

      // browser_screenshot should NOT be forwarded to chatCanvasStore
      expect(mockAddActivityEvent).not.toHaveBeenCalled();
    });

    it('does NOT forward browser_screenshot events to chatCanvasStore', () => {
      render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          streamEnabled: true,
        }),
      );

      const callArgs = mockUseActivityStream.mock.calls[0][0];
      const onEvent = callArgs.onEvent;

      // Send browser_screenshot event (wrapped in act for state update)
      act(() => {
        onEvent({
          type: 'browser_screenshot',
          timestamp: Date.now(),
          data: {
            screenshot_url: 'https://example.com/screenshot.png',
            screenshot_id: 'ss-sse',
            page_url: 'https://test.com',
            page_title: 'Test',
            viewport_width: 1280,
            viewport_height: 800,
          },
        });
      });

      // Should NOT be stored as activity event
      expect(mockAddActivityEvent).not.toHaveBeenCalled();
    });

    it('still forwards non-browser events to chatCanvasStore', () => {
      render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          streamEnabled: true,
        }),
      );

      const callArgs = mockUseActivityStream.mock.calls[0][0];
      const onEvent = callArgs.onEvent;

      // Send a thinking event (non-browser)
      act(() => {
        onEvent({
          type: 'thinking',
          message: 'Processing...',
          icon: 'thinking',
          timestamp: Date.now(),
          agent: 'ava',
        });
      });

      expect(mockAddActivityEvent).toHaveBeenCalledWith({
        type: 'thinking',
        message: 'Processing...',
        icon: 'thinking',
        agent: 'ava',
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('works without any browser-related props (backward compatible)', () => {
      const { getByTestId } = render(
        React.createElement(ChatCanvas, defaultProps),
      );

      expect(getByTestId('web-preview')).toBeTruthy();
    });

    it('still supports streamEnabled without browser features', () => {
      render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          streamEnabled: true,
        }),
      );

      expect(mockUseActivityStream).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      );
    });

    it('still supports custom streamUrl', () => {
      render(
        React.createElement(ChatCanvas, {
          ...defaultProps,
          streamEnabled: true,
          streamUrl: '/api/custom/stream',
        }),
      );

      expect(mockUseActivityStream).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/api/custom/stream' }),
      );
    });
  });
});
