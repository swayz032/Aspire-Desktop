/**
 * Materials tab — Service Hub Phase 5, Pass B.
 *
 * Pass B scope: full UI shell with mocked data. No backend calls. The
 * `MaterialsTab` component owns search + bundle state via mock hooks
 * (`useMaterialsSearch`, `useMaterialsBundle`) whose return shapes are locked
 * for Pass C (live SerpApi wire).
 */
import React from 'react';
import { MaterialsTab } from '@/components/service-hub/estimate-studio/materials/MaterialsTab';

export default function MaterialsRoute() {
  return <MaterialsTab />;
}
