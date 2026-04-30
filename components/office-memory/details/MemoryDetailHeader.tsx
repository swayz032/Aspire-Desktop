/**
 * MemoryDetailHeader (Pass 15) — wraps the existing MemoryDetailHeader and
 * provides a default no-op `onAction` so per-type detail components can use
 * the same chrome with a smaller call signature `{ memory, onBack }`.
 *
 * Per Pass 15 spec, every per-type detail component composes Header + a center
 * column + RightRail. Re-exporting from this path keeps the import surface
 * tight (`components/office-memory/details/...`) and isolates Pass 15 changes
 * from the older detail page.
 *
 * The actual chrome (back link, datetime + duration, entity chip, actions menu)
 * lives in `../MemoryDetailHeader.tsx` — that file is the single source of
 * truth for header visuals.
 */

import React, { useCallback } from 'react';
import { View } from 'react-native';
import {
  MemoryDetailHeader as MemoryDetailHeaderBase,
  type MemoryDetailAction,
} from '../MemoryDetailHeader';
import type { MemoryDetail } from '../types';

export interface MemoryDetailHeaderProps {
  memory: MemoryDetail;
  onBack: () => void;
  /** Optional action handler. Defaults to console-log so the header is
   *  always interactive even when the page hasn't wired actions yet. */
  onAction?: (action: MemoryDetailAction) => void;
}

export function MemoryDetailHeader({ memory, onBack, onAction }: MemoryDetailHeaderProps) {
  const handleAction = useCallback(
    (a: MemoryDetailAction) => {
      if (onAction) onAction(a);
      else if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.info(`[memory-detail] action ${a} on ${memory.id}`);
      }
    },
    [onAction, memory.id],
  );

  // The base header pulls in cardAnimations.ts which is web-safe; native
  // renders fine without modification. We just forward the props.
  return (
    <View>
      <MemoryDetailHeaderBase
        memory={memory}
        onBack={onBack}
        onAction={handleAction}
      />
    </View>
  );
}

export default MemoryDetailHeader;
