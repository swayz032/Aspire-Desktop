/**
 * useBrowserStream -- Hook for filtering and accumulating browser_screenshot
 * events from the Canvas SSE activity stream.
 *
 * Features:
 *   - Filters `browser_screenshot` events from the SSE stream
 *   - Maintains ordered array of browser screenshot events
 *   - Exposes latest screenshot for display in BrowserPanel
 *   - Configurable max buffer size (prevents unbounded memory growth)
 *   - Web-only (delegates to useActivityStream which is web-only)
 *
 * Law compliance:
 *   - Law #7: Hook is transport only -- does not make decisions
 *   - Law #9: PII redaction happens server-side; client receives clean data
 */

import { useState, useCallback, useRef } from 'react';
import { useActivityStream, type StreamEvent } from './useActivityStream';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserScreenshotEvent {
  /** Presigned URL to the screenshot image */
  screenshot_url: string;
  /** Unique identifier for this screenshot */
  screenshot_id: string;
  /** URL of the page that was captured */
  page_url: string;
  /** Title of the page that was captured */
  page_title: string;
  /** Unix timestamp (ms) when screenshot was taken */
  timestamp: number;
  /** Viewport width of the captured page */
  viewport_width: number;
  /** Viewport height of the captured page */
  viewport_height: number;
}

export interface UseBrowserStreamOptions {
  /** Whether the stream should be active */
  enabled: boolean;
  /** SSE endpoint URL override */
  url?: string;
  /** Maximum number of screenshots to retain in buffer (default: 50) */
  maxBuffer?: number;
  /** Callback for each browser screenshot event */
  onScreenshot?: (event: BrowserScreenshotEvent) => void;
  /** Callback for non-browser activity events (forwarded from SSE) */
  onActivityEvent?: (event: StreamEvent) => void;
}

export interface UseBrowserStreamReturn {
  /** All browser screenshot events (ordered chronologically) */
  browserEvents: BrowserScreenshotEvent[];
  /** The most recent screenshot event, or null if none received */
  latestScreenshot: BrowserScreenshotEvent | null;
  /** Whether the SSE connection is currently open */
  connected: boolean;
  /** Current error, if any */
  error: Error | null;
  /** Clear all stored browser events */
  clearEvents: () => void;
  /** Manually disconnect the stream */
  disconnect: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_BUFFER = 50;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowserStream(
  options: UseBrowserStreamOptions,
): UseBrowserStreamReturn {
  const {
    enabled,
    url,
    maxBuffer = DEFAULT_MAX_BUFFER,
    onScreenshot,
    onActivityEvent,
  } = options;

  const [browserEvents, setBrowserEvents] = useState<BrowserScreenshotEvent[]>([]);

  // Stable callback refs to avoid re-creating EventSource
  const onScreenshotRef = useRef(onScreenshot);
  onScreenshotRef.current = onScreenshot;
  const onActivityEventRef = useRef(onActivityEvent);
  onActivityEventRef.current = onActivityEvent;

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      // Check if this is a browser_screenshot event
      if (event.type === 'browser_screenshot' && event.data) {
        const data = event.data as Record<string, unknown>;
        const screenshotEvent: BrowserScreenshotEvent = {
          screenshot_url: (data.screenshot_url as string) ?? '',
          screenshot_id: (data.screenshot_id as string) ?? '',
          page_url: (data.page_url as string) ?? '',
          page_title: (data.page_title as string) ?? '',
          timestamp: event.timestamp ?? Date.now(),
          viewport_width: (data.viewport_width as number) ?? 1280,
          viewport_height: (data.viewport_height as number) ?? 800,
        };

        setBrowserEvents((prev) => {
          const next = [...prev, screenshotEvent];
          // Enforce max buffer -- drop oldest entries
          if (next.length > maxBuffer) {
            return next.slice(next.length - maxBuffer);
          }
          return next;
        });

        onScreenshotRef.current?.(screenshotEvent);
        return;
      }

      // Forward non-browser events to activity callback
      onActivityEventRef.current?.(event);
    },
    [maxBuffer],
  );

  const { connected, error, disconnect } = useActivityStream({
    enabled,
    url,
    onEvent: handleStreamEvent,
  });

  const clearEvents = useCallback(() => {
    setBrowserEvents([]);
  }, []);

  const latestScreenshot =
    browserEvents.length > 0 ? browserEvents[browserEvents.length - 1] : null;

  return {
    browserEvents,
    latestScreenshot,
    connected,
    error,
    clearEvents,
    disconnect,
  };
}
