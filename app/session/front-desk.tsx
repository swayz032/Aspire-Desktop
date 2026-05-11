/**
 * Front Desk Hub — route wrapper (Pass 1 skeleton).
 *
 * Mirrors `app/finance-hub/index.tsx` route-wrapper pattern: a thin shell
 * that renders inside `DesktopShell` (existing Aspire desktop chrome —
 * sidebar + header) and delegates the page composition to
 * `<FrontDeskHub />`.
 *
 * The full Front Desk operating hub spec lives at
 * `C:\Users\tonio\Downloads\aspire_front_desk_hub_claude_code_spec_sheet.pdf`
 * v1.0 2026-05-08. Pass 1 ships:
 *   - Route + 2-column layout skeleton
 *   - Persona-aware ReceptionistStage (Voice mode → Tiffany/Sarah orb)
 *   - DialPadCard extracted from the legacy `app/session/calls.tsx`
 *
 * Cards / inbox content / SMS workspace / detail drawer / backend wiring
 * land in Passes 2-5. The legacy `/session/calls` route stays alive
 * untouched until Pass 5 redirects it.
 */

import React from 'react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { FrontDeskHub } from '@/components/front-desk/FrontDeskHub';

export default function FrontDeskRoute() {
  return (
    <PageErrorBoundary pageName="front-desk-hub">
      <DesktopShell>
        <FrontDeskHub />
      </DesktopShell>
    </PageErrorBoundary>
  );
}
