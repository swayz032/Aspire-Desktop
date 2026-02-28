import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

// Desktop-only mode: Always return true for desktop detection
// Mobile views have been permanently removed

export function useDesktop(): boolean {
  return true;
}

export function useDesktopWithMounted(): { isDesktop: boolean; mounted: boolean } {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return { isDesktop: true, mounted };
}

const BREAKPOINTS = {
  tablet: 768,
  laptop: 1280,
  desktop: 1440,
  wide: 1920,
} as const;

function getWidth(): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth;
  }
  return 1440;
}

function classify(width: number) {
  return {
    isWide: width >= BREAKPOINTS.wide,
    isDesktop: width >= BREAKPOINTS.desktop,
    isLaptop: width >= BREAKPOINTS.laptop && width < BREAKPOINTS.desktop,
    isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.laptop,
    isMobile: false as const, // mobile permanently removed — kept for backward compat
  };
}

export function useBreakpoint() {
  const [width, setWidth] = useState(1440); // SSR-safe default
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef(0);

  const handleResize = useCallback(() => {
    if (rafRef.current) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      setWidth(getWidth());
      rafRef.current = 0;
    });
  }, []);

  useEffect(() => {
    setWidth(getWidth());
    setMounted(true);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [handleResize]);

  return {
    ...classify(width),
    width,
    mounted,
  };
}
