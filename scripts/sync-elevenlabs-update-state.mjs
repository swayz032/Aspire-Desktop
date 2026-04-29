#!/usr/bin/env node
/**
 * Enable the `update_state` Alpha system tool on all 6 agents with per-agent
 * state schemas designed from each agent's role.
 *
 * Schema per ElevenLabs validator:
 *   built_in_tools.update_state.params = {
 *     system_tool_type: 'update_state',
 *     update_state: { updates: [{ name, description, type }, ...] }
 *   }
 *
 * State slots are designed from each agent's tools contract + the V1 spine
 * (correlation_id-bound handoffs, freshness_seq brief invalidation, intent
 * capture flow).
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) { console.error('No ELEVENLABS_API_KEY in env.'); process.exit(1); }
const BASE = 'https://api.elevenlabs.io/v1';

// Per-agent state schemas
const AGENT_STATE = {
  ava: {
    agent_id: 'agent_1201kmqdjgxvfxxteedpkvjej7er',
    updates: [
      { name: 'active_handoff_id', description: 'Correlation ID of the active cross-runtime handoff (voice→video) Ava is coordinating.', type: 'string' },
      { name: 'last_routed_agent', description: 'Which specialist Ava just routed to: eli, nora, finn, sarah-receptionist, sarah-frontdesk, tim.', type: 'string' },
      { name: 'pending_intent_summary', description: 'The owner intent currently queued for execution but not yet completed.', type: 'string' },
      { name: 'office_brief_freshness_seq', description: 'Monotonic counter of the office brief Ava is operating on; bumps when brief refreshes.', type: 'number' },
    ],
  },
  finn: {
    agent_id: 'agent_2201kmqdjjyben0tyg2t5eexnmzg',
    updates: [
      { name: 'active_finance_topic', description: 'Current finance domain in conversation: cash, books, invoices, quotes, payroll, tax, or rules.', type: 'string' },
      { name: 'linked_invoice_id', description: 'Invoice currently being discussed (if any).', type: 'string' },
      { name: 'linked_quote_id', description: 'Quote currently being discussed (if any).', type: 'string' },
      { name: 'provider_freshness', description: 'Bank/books/payments provider sync state: fresh, stale, or unavailable.', type: 'string' },
      { name: 'pending_writeback_id', description: 'Writeback preview ID waiting for owner apply approval.', type: 'string' },
    ],
  },
  eli: {
    agent_id: 'agent_4201kmqdjm1tfhfaggnnfjax3m6d',
    updates: [
      { name: 'active_thread_id', description: 'Email thread currently in scope.', type: 'string' },
      { name: 'draft_id', description: 'Current email draft Eli has prepared.', type: 'string' },
      { name: 'triage_bucket', description: 'Active triage focus: urgent_now, needs_reply, waiting, reference, or noise.', type: 'string' },
      { name: 'recipient_confirmed', description: 'Whether the owner confirmed the recipient list before send.', type: 'boolean' },
    ],
  },
  nora: {
    agent_id: 'agent_1901kmqdjmwmfqg9rqr5jngfydnw',
    updates: [
      { name: 'active_meeting_id', description: 'Meeting currently in scope.', type: 'string' },
      { name: 'meeting_phase', description: 'Lifecycle phase: scheduling, briefing, conference, or recap.', type: 'string' },
      { name: 'recording_mode', description: 'Recording mode for the active meeting: auto, manual, or off.', type: 'string' },
      { name: 'meeting_purpose', description: 'Purpose hint for the active meeting: internal, client, vendor, deal, or network.', type: 'string' },
      { name: 'pending_recap_id', description: 'Recap packet awaiting owner approval to distribute.', type: 'string' },
    ],
  },
  'sarah-receptionist': {
    agent_id: 'agent_6501kp71h69jfqysgd055hemqhrq',
    updates: [
      { name: 'caller_intent', description: 'Detected caller intent: connect, message, question, wrong_number, or abusive.', type: 'string' },
      { name: 'caller_name', description: 'Caller name captured during intake.', type: 'string' },
      { name: 'callback_number', description: 'Callback phone number captured during intake.', type: 'string' },
      { name: 'transfer_target', description: 'Which routing contact the caller asked for (role + name).', type: 'string' },
      { name: 'is_open_now', description: 'Business hours state at call start: true if open.', type: 'boolean' },
    ],
  },
  'sarah-frontdesk': {
    agent_id: 'agent_8901kmqdjnrte7psp6en4f85m4kt',
    updates: [
      { name: 'active_callback_id', description: 'Callback currently being prepped or discussed with the owner.', type: 'string' },
      { name: 'triage_focus', description: 'Active triage focus: missed_calls, voicemails, texts, or callbacks.', type: 'string' },
      { name: 'urgency_threshold', description: 'Filter level: high (urgent only) or normal (everything).', type: 'string' },
      { name: 'draft_id', description: 'Current draft (callback note or follow-up text) Sarah has prepared.', type: 'string' },
    ],
  },
};

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${method} ${p}: ${text.slice(0, 400)}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function syncAgent(name, cfg) {
  console.log(`\n=== ${name} (${cfg.agent_id}) ===`);

  // Fetch existing built_in_tools so we don't clobber other system tools
  const before = await api('GET', `/convai/agents/${cfg.agent_id}`);
  const existing = before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const activeBefore = Object.entries(existing).filter(([, v]) => v != null).map(([k]) => k);
  console.log(`  before active sys tools: [${activeBefore.join(', ')}]`);

  // Build a fresh built_in_tools dict that preserves enabled tools and ADDS update_state
  const built_in_tools = { ...existing };

  // CORRECT schema (discovered by API probing 2026-04-29):
  //   params.updates is FLAT (NOT nested under update_state).
  //   Each update is a dynamic_variable with an AST-node `expression` for initial value.
  //   `null_literal` initializes the slot empty — agent populates via the tool at runtime.
  const updateSlots = cfg.updates.map((u) => ({
    type: 'dynamic_variable',
    variable_name: u.name,
    description: u.description,
    expression: { type: 'null_literal' },
  }));
  built_in_tools.update_state = {
    name: 'update_state',
    description: 'Persist short-lived per-session state slots so the agent can recall context across turns within a single conversation.',
    params: { system_tool_type: 'update_state', updates: updateSlots },
  };

  console.log(`  pushing ${updateSlots.length} state slots: ${updateSlots.map((u) => u.variable_name).join(', ')}`);

  await api('PATCH', `/convai/agents/${cfg.agent_id}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${cfg.agent_id}`);
  const afterTools = after?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const activeAfter = Object.entries(afterTools).filter(([, v]) => v != null).map(([k]) => k);
  const usSlot = afterTools.update_state?.params?.update_state?.updates || [];
  console.log(`  AFTER  active sys tools: [${activeAfter.join(', ')}]`);
  console.log(`  AFTER  update_state slots: ${usSlot.map((u) => u.name).join(', ')}`);
  console.log(`  ✓ synced (${cfg.updates.length} state slots)`);
}

(async () => {
  for (const [name, cfg] of Object.entries(AGENT_STATE)) {
    try {
      await syncAgent(name, cfg);
    } catch (e) {
      console.error(`  ✗ ${name} failed: ${String(e.message || e).slice(0, 500)}`);
    }
  }
  console.log('\nDone.');
})();
