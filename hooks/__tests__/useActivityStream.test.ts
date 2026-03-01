/**
 * Tests for useActivityStream hook
 *
 * Covers:
 *   - Web-only guard (no-op on native)
 *   - EventSource connection lifecycle
 *   - Event parsing and dispatch
 *   - Heartbeat filtering
 *   - Auto-reconnect with exponential backoff
 *   - Max reconnect attempts
 *   - Cleanup on unmount
 *   - Disconnect method
 *   - Error handling
 */

import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type EventSourceListener = ((evt: { data: string }) => void) | null;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  onopen: (() => void) | null = null;
  onmessage: EventSourceListener = null;
  onerror: (() => void) | null = null;
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError() {
    this.onerror?.();
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

// Install global mock
(global as Record<string, unknown>).EventSource = MockEventSource;

import { useActivityStream, type StreamEvent } from '../useActivityStream';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function getLastInstance(): MockEventSource {
  const instances = MockEventSource.instances;
  return instances[instances.length - 1];
}

// Save original Platform.OS value
const originalOS = Platform.OS;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  MockEventSource.reset();
  // Ensure Platform.OS is 'web' by default for tests
  Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
});

afterEach(() => {
  jest.useRealTimers();
  // Restore original Platform.OS
  Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
});

describe('useActivityStream', () => {
  it('does not create EventSource on native platform', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('does not create EventSource when disabled', () => {
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: false, onEvent }),
    );

    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('creates EventSource when enabled on web', () => {
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(getLastInstance().url).toContain('/api/orchestrator/intent');
  });

  it('uses custom URL when provided', () => {
    const onEvent = jest.fn();
    const customUrl = '/api/custom/stream';

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent, url: customUrl }),
    );

    expect(getLastInstance().url).toBe(customUrl);
  });

  it('sets connected=true on open', () => {
    const onEvent = jest.fn();

    const { result } = renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    expect(result.current.connected).toBe(false);

    act(() => {
      getLastInstance().simulateOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('calls onConnectionChange on open', () => {
    const onEvent = jest.fn();
    const onConnectionChange = jest.fn();

    renderHook(() =>
      useActivityStream({
        enabled: true,
        onEvent,
        onConnectionChange,
      }),
    );

    act(() => {
      getLastInstance().simulateOpen();
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it('dispatches events via onEvent callback', () => {
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    act(() => {
      getLastInstance().simulateOpen();
    });

    const event: StreamEvent = {
      type: 'thinking',
      message: 'Processing...',
      timestamp: Date.now(),
    };

    act(() => {
      getLastInstance().simulateMessage(event as Record<string, unknown>);
    });

    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('filters out heartbeat events', () => {
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    act(() => {
      getLastInstance().simulateOpen();
    });

    act(() => {
      getLastInstance().simulateMessage({
        type: 'heartbeat',
        timestamp: Date.now(),
      });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('handles malformed event data gracefully', () => {
    const onEvent = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    act(() => {
      getLastInstance().simulateOpen();
    });

    // Send invalid JSON -- should not throw
    act(() => {
      getLastInstance().onmessage?.({ data: 'not-json{{{' });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reconnects with exponential backoff on error', () => {
    const onEvent = jest.fn();
    const onError = jest.fn();

    renderHook(() =>
      useActivityStream({ enabled: true, onEvent, onError }),
    );

    // First connection
    expect(MockEventSource.instances).toHaveLength(1);

    // Simulate error
    act(() => {
      getLastInstance().simulateError();
    });

    expect(onError).toHaveBeenCalled();

    // After 100ms (first backoff), should reconnect
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(MockEventSource.instances).toHaveLength(2);
  });

  it('increases reconnect delay exponentially', () => {
    const onEvent = jest.fn();

    const { result } = renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    // First error -> 100ms delay
    act(() => {
      getLastInstance().simulateError();
    });
    expect(result.current.reconnectAttempts).toBe(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(MockEventSource.instances).toHaveLength(2);

    // Second error -> 200ms delay
    act(() => {
      getLastInstance().simulateError();
    });
    expect(result.current.reconnectAttempts).toBe(2);

    act(() => {
      jest.advanceTimersByTime(199);
    });
    // Should not reconnect yet (only 199ms passed, need 200)
    expect(MockEventSource.instances).toHaveLength(2);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    // Now it should reconnect
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it('stops reconnecting after max attempts', () => {
    const onEvent = jest.fn();
    const maxAttempts = 3;

    renderHook(() =>
      useActivityStream({
        enabled: true,
        onEvent,
        maxReconnectAttempts: maxAttempts,
      }),
    );

    // Exhaust all reconnect attempts
    for (let i = 0; i < maxAttempts; i++) {
      act(() => {
        getLastInstance().simulateError();
      });
      act(() => {
        jest.advanceTimersByTime(5000); // Advance past max delay
      });
    }

    const countAfterMax = MockEventSource.instances.length;

    // One more error -- should NOT create new instance
    act(() => {
      getLastInstance().simulateError();
    });
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(MockEventSource.instances).toHaveLength(countAfterMax);
  });

  it('resets reconnect counter on successful open', () => {
    const onEvent = jest.fn();

    const { result } = renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    // Error, then reconnect
    act(() => {
      getLastInstance().simulateError();
    });
    expect(result.current.reconnectAttempts).toBe(1);

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Successful reconnect
    act(() => {
      getLastInstance().simulateOpen();
    });

    expect(result.current.reconnectAttempts).toBe(0);
    expect(result.current.connected).toBe(true);
  });

  it('closes EventSource on unmount', () => {
    const onEvent = jest.fn();

    const { unmount } = renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    const instance = getLastInstance();

    act(() => {
      instance.simulateOpen();
    });

    unmount();

    expect(instance.readyState).toBe(2); // CLOSED
  });

  it('disconnect() closes connection and prevents reconnect', () => {
    const onEvent = jest.fn();

    const { result } = renderHook(() =>
      useActivityStream({ enabled: true, onEvent }),
    );

    act(() => {
      getLastInstance().simulateOpen();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connected).toBe(false);
  });
});
