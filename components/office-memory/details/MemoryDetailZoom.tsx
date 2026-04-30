/**
 * MemoryDetailZoom — Zoom-specific extension of the meeting detail layout.
 *
 * Thin wrapper that passes `zoom={true}` to MemoryDetailMeeting so the
 * Zoom-specific banner (meeting id / host / participant count) renders at
 * the top of the center stage. Recording semantics already align: meeting
 * recordings default to video, which matches Zoom's native artifact.
 *
 * Kept DRY on purpose — Zoom diverges from generic meetings only in the
 * header chips and the `recording.kind = 'video'` default. If a future
 * pass introduces deeper Zoom-specific affordances (chapter markers from
 * Zoom AI Companion, breakout-room transcripts, etc.), they should land
 * inline here rather than re-implementing the meeting layout.
 */

import React from 'react';
import { MemoryDetailMeeting } from './MemoryDetailMeeting';
import type { MemoryDetail } from '../types';

export interface MemoryDetailZoomProps {
  memory: MemoryDetail;
}

export function MemoryDetailZoom({ memory }: MemoryDetailZoomProps) {
  return <MemoryDetailMeeting memory={memory} zoom />;
}

export default MemoryDetailZoom;
