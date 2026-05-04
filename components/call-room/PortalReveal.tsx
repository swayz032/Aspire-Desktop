/**
 * PortalReveal — Pass-through wrapper (overlay removed 2026-05-04).
 *
 * Previously this component rendered an Apple-style "container transform"
 * blue overlay that morphed from the call button rect to fullscreen and
 * faded out. The user reported "that blue thing just looks like a ugly
 * overlay" so the entire transition has been removed.
 *
 * The component is kept as a thin wrapper because callers (app/call-room.tsx)
 * still pass `origin` and `onRevealComplete` props. We fire onRevealComplete
 * immediately on mount and just render children. If we ever want to add
 * a different transition (fade-from-black, scale, etc.) it slots in here.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

export interface PortalOrigin {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortalRevealProps {
  children: React.ReactNode;
  /** Kept for API compatibility with /session/calls handleCall — ignored. */
  origin: PortalOrigin | null;
  /** Fires once on mount. Kept for API compatibility. */
  onRevealComplete?: () => void;
}

export function PortalReveal({
  children,
  onRevealComplete,
}: PortalRevealProps): React.ReactElement {
  useEffect(() => {
    onRevealComplete?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});
