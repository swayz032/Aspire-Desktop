/**
 * Scope tab route (Wave 19+ — Story Mode v2).
 *
 * Delegates to <ScopeTab /> for rendering. Adds `useChapterDeepLink()` to
 * round-trip the active chapter key between the URL (`?chapter=<key>`) and
 * scopeUiStore so a refresh or shared link preserves the contractor's
 * chapter selection.
 *
 * Law #7: render layer only — the hook reads URL params + dispatches store
 * actions, no autonomous decisions.
 */
import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScopeTab } from '@/components/service-hub/estimate-studio/scope/ScopeTab';
import { scopeUiActions, useScopeUi } from '@/lib/scopeUiStore';

/**
 * Round-trip the active chapter key between the URL (`?chapter=<key>`)
 * and scopeUiStore. Exported so a test can mount it in isolation.
 *
 *   - On mount: hydrate the store from the URL if a chapter param exists
 *     AND differs from current state.
 *   - On store change: write the new chapter key back to the URL via
 *     router.setParams when it differs from the current URL value.
 *
 * Both directions are guarded to prevent the obvious A→B→A loop.
 */
export function useChapterDeepLink(): void {
  const params = useLocalSearchParams<{ chapter?: string }>();
  const router = useRouter();
  const ui = useScopeUi();
  const urlChapter = typeof params.chapter === 'string' ? params.chapter : undefined;

  // Hydrate URL → store.
  useEffect(() => {
    if (urlChapter && urlChapter !== ui.activeChapterKey) {
      scopeUiActions().setActiveChapterKey(urlChapter);
    }
    // urlChapter is the only value we want to react to here; intentional
    // narrow dep array — including ui.activeChapterKey would cause a loop
    // after the write-back effect fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlChapter]);

  // Write store → URL.
  useEffect(() => {
    if (ui.activeChapterKey && ui.activeChapterKey !== urlChapter) {
      router.setParams({ chapter: ui.activeChapterKey });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.activeChapterKey]);
}

export default function ScopeRoute(): React.ReactElement {
  useChapterDeepLink();
  return <ScopeTab />;
}
