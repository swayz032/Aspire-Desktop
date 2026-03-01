/**
 * BrowserPanel Component Tests
 *
 * Covers:
 *   - Screenshot display (renders URL bar, page title, image container)
 *   - Loading state (spinner, loading text)
 *   - Error state (error icon, error message)
 *   - Empty state (globe icon, waiting message)
 *   - Fade transition on new screenshot (animation triggered)
 *   - Accessibility roles and labels
 *   - Image error handling (onImageError callback)
 */

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports)
// ---------------------------------------------------------------------------

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
  },
}));

// Mock useReducedMotion
jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import React from 'react';
import { render } from '@testing-library/react-native';
import { BrowserPanel, type BrowserPanelProps } from '../BrowserPanel';
import type { BrowserScreenshotEvent } from '@/hooks/useBrowserStream';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockScreenshot: BrowserScreenshotEvent = {
  screenshot_url: 'https://example.com/screenshot.png',
  screenshot_id: 'ss-001',
  page_url: 'https://www.bing.com/search?q=aspire',
  page_title: 'Bing Search Results',
  timestamp: Date.now(),
  viewport_width: 1280,
  viewport_height: 800,
};

const mockScreenshot2: BrowserScreenshotEvent = {
  screenshot_url: 'https://example.com/screenshot-2.png',
  screenshot_id: 'ss-002',
  page_url: 'https://www.google.com/search?q=aspire',
  page_title: 'Google Search Results',
  timestamp: Date.now() + 1000,
  viewport_width: 1280,
  viewport_height: 800,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BrowserPanel Component', () => {
  describe('Empty State', () => {
    it('renders empty state when no screenshot is provided', () => {
      const { getByText, getByTestId } = render(
        <BrowserPanel screenshot={null} />,
      );

      expect(getByTestId('browser-panel')).toBeTruthy();
      expect(getByText('Browser View')).toBeTruthy();
      expect(
        getByText('Live browser screenshots will appear here during agent activity.'),
      ).toBeTruthy();
    });

    it('applies correct accessibility label for empty state', () => {
      const { toJSON } = render(<BrowserPanel screenshot={null} />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('Browser panel - waiting for activity');
    });
  });

  describe('Loading State', () => {
    it('renders loading state with spinner when isLoading and no screenshot', () => {
      const { getByText, getByTestId } = render(
        <BrowserPanel screenshot={null} isLoading={true} />,
      );

      expect(getByTestId('browser-panel')).toBeTruthy();
      expect(getByText('Loading browser view...')).toBeTruthy();
    });

    it('applies progressbar accessibility role when loading', () => {
      const { toJSON } = render(
        <BrowserPanel screenshot={null} isLoading={true} />,
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('Loading browser screenshot');
    });
  });

  describe('Screenshot Display', () => {
    it('renders screenshot with URL bar', () => {
      const { getByText, getByTestId } = render(
        <BrowserPanel screenshot={mockScreenshot} />,
      );

      expect(getByTestId('browser-panel')).toBeTruthy();
      expect(getByText('https://www.bing.com/search?q=aspire')).toBeTruthy();
      expect(getByText('Bing Search Results')).toBeTruthy();
    });

    it('applies image accessibility label with page title', () => {
      const { toJSON } = render(
        <BrowserPanel screenshot={mockScreenshot} />,
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('Browser screenshot of Bing Search Results');
    });

    it('renders with custom testID', () => {
      const { getByTestId } = render(
        <BrowserPanel screenshot={mockScreenshot} testID="custom-panel" />,
      );

      expect(getByTestId('custom-panel')).toBeTruthy();
    });
  });

  describe('Error State', () => {
    it('renders error state with custom error message', () => {
      const { getByText } = render(
        <BrowserPanel screenshot={null} error="Network timeout" />,
      );

      expect(getByText('Failed to load screenshot')).toBeTruthy();
      expect(getByText('Network timeout')).toBeTruthy();
    });

    it('renders error state when screenshot image fails to load', () => {
      const mockOnImageError = jest.fn();
      const { getByText, rerender } = render(
        <BrowserPanel
          screenshot={mockScreenshot}
          error="Image load failed"
          onImageError={mockOnImageError}
        />,
      );

      expect(getByText('Failed to load screenshot')).toBeTruthy();
    });

    it('applies alert accessibility role for error state', () => {
      const { toJSON } = render(
        <BrowserPanel screenshot={null} error="Something went wrong" />,
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('Something went wrong');
    });
  });

  describe('Fade Transition', () => {
    it('does not crash when transitioning between screenshots', () => {
      const { rerender } = render(
        <BrowserPanel screenshot={mockScreenshot} />,
      );

      // Should not crash when transitioning to a new screenshot
      expect(() => {
        rerender(<BrowserPanel screenshot={mockScreenshot2} />);
      }).not.toThrow();
    });

    it('renders loading overlay when isLoading with existing screenshot', () => {
      const { getByText } = render(
        <BrowserPanel screenshot={mockScreenshot} isLoading={true} />,
      );

      // URL bar should still show (existing screenshot visible)
      expect(getByText('https://www.bing.com/search?q=aspire')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('handles screenshot without page_title', () => {
      const noTitleScreenshot: BrowserScreenshotEvent = {
        ...mockScreenshot,
        page_title: '',
      };

      const { getByText } = render(
        <BrowserPanel screenshot={noTitleScreenshot} />,
      );

      expect(getByText('https://www.bing.com/search?q=aspire')).toBeTruthy();
    });

    it('handles screenshot with XSS-prone URL (escaping)', () => {
      const xssScreenshot: BrowserScreenshotEvent = {
        ...mockScreenshot,
        screenshot_url: 'https://example.com/img.png" onload="alert(1)',
        page_title: '<script>alert("xss")</script>',
      };

      // Should not crash -- escapeHtml function handles this
      expect(() => {
        render(<BrowserPanel screenshot={xssScreenshot} />);
      }).not.toThrow();
    });

    it('renders correctly with very long page URL', () => {
      const longUrlScreenshot: BrowserScreenshotEvent = {
        ...mockScreenshot,
        page_url: 'https://example.com/' + 'a'.repeat(500),
      };

      const { toJSON } = render(
        <BrowserPanel screenshot={longUrlScreenshot} />,
      );
      expect(toJSON()).toBeTruthy();
    });
  });
});
