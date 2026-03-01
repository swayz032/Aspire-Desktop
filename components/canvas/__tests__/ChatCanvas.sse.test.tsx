/**
 * Tests for ChatCanvas SSE integration
 *
 * Covers:
 *   - ChatCanvas renders with streamEnabled=false (default, no SSE)
 *   - ChatCanvas renders with streamEnabled=true
 *   - Activity events from SSE are routed to chatCanvasStore
 *   - Heartbeat events are filtered (not stored)
 *   - Response events are filtered (not stored)
 *   - Custom streamUrl is passed through
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

// Mock HybridWebPreview -- use require() inside factory
jest.mock('@/components/ai-elements/HybridWebPreview', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    HybridWebPreview: (mockProps: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'hybrid-web-preview', ...mockProps }),
  };
});

// Mock useReducedMotion
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// Mock WebPreview -- use require() inside factory
jest.mock('@/components/ai-elements/WebPreview', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    WebPreview: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: 'web-preview', ...props }),
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ChatCanvas, type ChatCanvasProps } from '../ChatCanvas';
import type { WebPreviewProps } from '@/components/ai-elements/WebPreview';

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

describe('ChatCanvas SSE Integration', () => {
  const defaultProps: ChatCanvasProps = {
    webPreviewProps: {
      activityEvents: [],
      trustLevel: 'verified',
    } as unknown as WebPreviewProps,
    personaElement: React.createElement(View, { testID: 'persona' }),
  };

  it('renders without streaming by default', () => {
    render(React.createElement(ChatCanvas, defaultProps));

    expect(mockUseActivityStream).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });

  it('enables streaming when streamEnabled=true', () => {
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

  it('passes custom streamUrl to useActivityStream', () => {
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

  it('routes thinking events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    // Extract the onEvent callback
    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    // Simulate a thinking event
    onEvent({
      type: 'thinking',
      message: 'Processing...',
      icon: 'thinking',
      timestamp: Date.now(),
      agent: 'ava',
    });

    expect(mockAddActivityEvent).toHaveBeenCalledWith({
      type: 'thinking',
      message: 'Processing...',
      icon: 'thinking',
      agent: 'ava',
    });
  });

  it('routes step events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'step',
      message: 'Found 5 results',
      icon: 'list',
      timestamp: Date.now(),
      agent: 'adam',
    });

    expect(mockAddActivityEvent).toHaveBeenCalledTimes(1);
  });

  it('routes error events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'error',
      message: 'Something went wrong',
      icon: 'error',
      timestamp: Date.now(),
    });

    expect(mockAddActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: 'Something went wrong' }),
    );
  });

  it('does NOT route heartbeat events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'heartbeat',
      timestamp: Date.now(),
    });

    expect(mockAddActivityEvent).not.toHaveBeenCalled();
  });

  it('does NOT route connected events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'connected',
      receipt_id: 'r-123',
      stream_id: 's-456',
      timestamp: Date.now(),
    });

    expect(mockAddActivityEvent).not.toHaveBeenCalled();
  });

  it('does NOT route response events to chatCanvasStore', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'response',
      data: { narration: 'Done' },
      timestamp: Date.now(),
    });

    expect(mockAddActivityEvent).not.toHaveBeenCalled();
  });

  it('handles events with missing message gracefully', () => {
    render(
      React.createElement(ChatCanvas, {
        ...defaultProps,
        streamEnabled: true,
      }),
    );

    const callArgs = mockUseActivityStream.mock.calls[0][0];
    const onEvent = callArgs.onEvent;

    onEvent({
      type: 'done',
      timestamp: Date.now(),
    });

    expect(mockAddActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'done', message: '' }),
    );
  });
});
