import { useState, useEffect } from 'react';

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

export function useBreakpoint() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  return {
    isDesktop: true,
    isTablet: false,
    isMobile: false,
    width: 1440,
    mounted,
  };
}
