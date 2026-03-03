/**
 * Unified Activity Event Builder
 *
 * Merges duplicated logic from:
 *   - AvaDeskPanel.buildActivityFromResponse (~lines 48-118)
 *   - FinnDeskPanel.buildFinnActivity (~lines 132-158)
 *
 * Produces an array of AgentActivityEvent objects from orchestrator
 * response metadata. Used to populate the ActivityTimeline UI.
 */

import type { Ionicons } from '@expo/vector-icons';
import type { AgentActivityEvent, AgentId, OrchestratorResponse } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let eventCounter = 0;

/** Generate a unique event ID. */
function nextEventId(): string {
  eventCounter += 1;
  return `evt_${Date.now()}_${eventCounter}`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build activity events from an orchestrator response.
 *
 * Chain-of-thought is explicit-only: only use activity steps provided by backend.
 * We do not synthesize generic "intent/routing/risk" steps in the UI.
 *
 * Conversational responses (no action taken) return an empty array
 * so the UI can skip the activity timeline entirely.
 *
 * @param data  Orchestrator response body (or relevant subset)
 * @param agent Which agent produced this response (for labeling)
 * @returns     Array of activity events ready for timeline display
 */
export function buildActivityFromResponse(
  data: OrchestratorResponse,
  agent: AgentId,
): AgentActivityEvent[] {
  const now = Date.now();

  // Case 1: Orchestrator returned explicit activity steps
  if (data.activity && Array.isArray(data.activity) && data.activity.length > 0) {
    return data.activity.map((step, idx) => ({
      id: nextEventId(),
      type: (step.type as AgentActivityEvent['type']) || 'step',
      label: step.message,
      status: 'completed' as const,
      timestamp: now + idx,
      icon: (step.icon as keyof typeof Ionicons.glyphMap) || 'cog',
    }));
  }
  return [];
}

/**
 * Reset the internal event counter. Useful for tests.
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}
