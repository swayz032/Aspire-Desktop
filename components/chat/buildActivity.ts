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

/**
 * Map risk tier string to an appropriate Ionicons icon.
 */
function riskTierIcon(tier: string): keyof typeof Ionicons.glyphMap {
  switch (tier.toUpperCase()) {
    case 'RED':
      return 'alert-circle';
    case 'YELLOW':
      return 'warning';
    default:
      return 'shield-checkmark';
  }
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Build activity events from an orchestrator response.
 *
 * If the orchestrator returns an explicit `activity` array, those steps
 * are used directly. Otherwise, pipeline steps are synthesized from
 * route, risk_tier, action, and governance metadata.
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

  // Case 2: Conversational response with no action — skip timeline
  const hasAction =
    data.route?.skill_pack ||
    data.action ||
    (data.governance?.receipt_ids && data.governance.receipt_ids.length > 0);

  if (!hasAction) {
    return [];
  }

  // Case 3: Synthesize from pipeline metadata
  const agentLabel = agent.charAt(0).toUpperCase() + agent.slice(1);
  const events: AgentActivityEvent[] = [
    {
      id: nextEventId(),
      type: 'thinking',
      label: agent === 'finn' ? 'Processing financial request...' : 'Processing intent...',
      status: 'completed',
      timestamp: now,
      icon: 'sparkles',
    },
  ];

  if (data.route?.skill_pack) {
    events.push({
      id: nextEventId(),
      type: 'step',
      label: `Routing to ${data.route.skill_pack}`,
      status: 'completed',
      timestamp: now + 1,
      icon: 'git-network',
    });
  }

  if (data.risk_tier) {
    events.push({
      id: nextEventId(),
      type: 'step',
      label: `Risk tier: ${data.risk_tier}`,
      status: 'completed',
      timestamp: now + 2,
      icon: riskTierIcon(data.risk_tier),
    });
  }

  if (
    data.governance?.approvals_required &&
    data.governance.approvals_required.length > 0
  ) {
    events.push({
      id: nextEventId(),
      type: 'step',
      label: `Approval required (${data.governance.approvals_required.join(', ')})`,
      status: 'completed',
      timestamp: now + 3,
      icon: 'hand-left',
    });
  }

  if (data.action) {
    events.push({
      id: nextEventId(),
      type: 'tool_call',
      label: `Executing: ${data.action}`,
      status: 'completed',
      timestamp: now + 4,
      icon: 'hammer',
    });
  }

  if (data.governance?.receipt_ids && data.governance.receipt_ids.length > 0) {
    events.push({
      id: nextEventId(),
      type: 'step',
      label: `Receipt: ${data.governance.receipt_ids[0].slice(0, 12)}...`,
      status: 'completed',
      timestamp: now + 5,
      icon: 'receipt',
    });
  }

  events.push({
    id: nextEventId(),
    type: 'done',
    label: 'Complete',
    status: 'completed',
    timestamp: now + 6,
    icon: 'checkmark-circle',
  });

  return events;
}

/**
 * Reset the internal event counter. Useful for tests.
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}
