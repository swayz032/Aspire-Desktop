/**
 * useBrowserStream Hook Tests
 *
 * Covers:
 *   - Filters browser_screenshot events from SSE stream
 *   - Accumulates browser events in order
 *   - Exposes latestScreenshot
 *   - Enforces maxBuffer limit
 *   - Forwards non-browser events via onActivityEvent callback
 *   - clearEvents() resets buffer
 *   - Passes through connected/error/disconnect from useActivityStream
 */

// ---------------------------------------------------------------------------
// Mocks -- use `mock` prefix for all out-of-scope variables
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockCapturedOnEvent: any = null;
const mockDisconnect = jest.fn();

jest.mock('../useActivityStream', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useActivityStream: (mockOpts: any) => {
    mockCapturedOnEvent = mockOpts.onEvent;
    return {
      connected: true,
      error: null,
      reconnectAttempts: 0,
      disconnect: mockDisconnect,
    };
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { renderHook, act } from '@testing-library/react-native';
import { useBrowserStream, type UseBrowserStreamOptions } from '../useBrowserStream';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeBrowserEvent(id: string, url: string = 'https://example.com/screenshot.png') {
  return {
    type: 'browser_screenshot',
    timestamp: Date.now(),
    data: {
      screenshot_url: url,
      screenshot_id: id,
      page_url: 'https://www.bing.com',
      page_title: 'Bing',
      viewport_width: 1280,
      viewport_height: 800,
    },
  };
}

function makeActivityEvent(type: string, message: string) {
  return {
    type,
    message,
    icon: type,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockCapturedOnEvent = null;
});

describe('useBrowserStream', () => {
  const defaultOptions: UseBrowserStreamOptions = {
    enabled: true,
  };

  it('starts with empty browserEvents', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    expect(result.current.browserEvents).toEqual([]);
    expect(result.current.latestScreenshot).toBeNull();
  });

  it('accumulates browser_screenshot events', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-001'));
    });

    expect(result.current.browserEvents).toHaveLength(1);
    expect(result.current.browserEvents[0].screenshot_id).toBe('ss-001');
    expect(result.current.latestScreenshot?.screenshot_id).toBe('ss-001');
  });

  it('maintains chronological order of events', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-001'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-002'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-003'));
    });

    expect(result.current.browserEvents).toHaveLength(3);
    expect(result.current.browserEvents[0].screenshot_id).toBe('ss-001');
    expect(result.current.browserEvents[1].screenshot_id).toBe('ss-002');
    expect(result.current.browserEvents[2].screenshot_id).toBe('ss-003');
    expect(result.current.latestScreenshot?.screenshot_id).toBe('ss-003');
  });

  it('enforces maxBuffer limit', () => {
    const { result } = renderHook(() =>
      useBrowserStream({ ...defaultOptions, maxBuffer: 3 }),
    );

    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-001'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-002'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-003'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-004'));
    });

    expect(result.current.browserEvents).toHaveLength(3);
    // Oldest should be dropped
    expect(result.current.browserEvents[0].screenshot_id).toBe('ss-002');
    expect(result.current.browserEvents[2].screenshot_id).toBe('ss-004');
  });

  it('forwards non-browser events to onActivityEvent callback', () => {
    const mockOnActivityEvent = jest.fn();
    const { result } = renderHook(() =>
      useBrowserStream({ ...defaultOptions, onActivityEvent: mockOnActivityEvent }),
    );

    act(() => {
      mockCapturedOnEvent?.(makeActivityEvent('thinking', 'Processing...'));
    });

    expect(mockOnActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'thinking', message: 'Processing...' }),
    );
    // Should NOT appear in browserEvents
    expect(result.current.browserEvents).toHaveLength(0);
  });

  it('calls onScreenshot callback for browser events', () => {
    const mockOnScreenshot = jest.fn();
    renderHook(() =>
      useBrowserStream({ ...defaultOptions, onScreenshot: mockOnScreenshot }),
    );

    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-001'));
    });

    expect(mockOnScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ screenshot_id: 'ss-001' }),
    );
  });

  it('clearEvents() resets the buffer', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-001'));
    });
    act(() => {
      mockCapturedOnEvent?.(makeBrowserEvent('ss-002'));
    });

    expect(result.current.browserEvents.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearEvents();
    });

    expect(result.current.browserEvents).toHaveLength(0);
    expect(result.current.latestScreenshot).toBeNull();
  });

  it('exposes connected state from useActivityStream', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    expect(result.current.connected).toBe(true);
  });

  it('exposes disconnect from useActivityStream', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    result.current.disconnect();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('handles browser_screenshot without data gracefully', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    act(() => {
      // Event with type=browser_screenshot but no data -- should be ignored
      mockCapturedOnEvent?.({ type: 'browser_screenshot', timestamp: Date.now() });
    });

    // No data field -- the guard in the hook skips it
    expect(result.current.browserEvents).toHaveLength(0);
  });

  it('fills default values for missing screenshot fields', () => {
    const { result } = renderHook(() => useBrowserStream(defaultOptions));

    act(() => {
      mockCapturedOnEvent?.({
        type: 'browser_screenshot',
        timestamp: Date.now(),
        data: {
          screenshot_url: 'https://example.com/img.png',
          screenshot_id: 'ss-partial',
          // Missing: page_url, page_title, viewport_width, viewport_height
        },
      });
    });

    expect(result.current.browserEvents).toHaveLength(1);
    expect(result.current.browserEvents[0].page_url).toBe('');
    expect(result.current.browserEvents[0].page_title).toBe('');
    expect(result.current.browserEvents[0].viewport_width).toBe(1280);
    expect(result.current.browserEvents[0].viewport_height).toBe(800);
  });
});
