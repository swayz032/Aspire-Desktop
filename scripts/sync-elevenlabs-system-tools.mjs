#!/usr/bin/env node
/**
 * Enable system tools per spec for all 6 agents + fix Sarah Front Desk's
 * first message.
 *
 * Per-agent system tools (from each agent's tools contract):
 *   - Ava (chief of staff)        : end_call, skip_turn, transfer_to_agent, update_state
 *   - Finn (specialist)           : end_call, skip_turn, transfer_to_agent, update_state
 *   - Eli (specialist)            : end_call, skip_turn, transfer_to_agent, update_state
 *   - Nora (specialist)           : end_call, skip_turn, transfer_to_agent, update_state
 *   - Sarah Receptionist (extern) : end_call, skip_turn, transfer_to_number, update_state
 *   - Sarah Front Desk (intern)   : end_call, skip_turn, update_state
 *
 * `update_state` is the new Alpha tool (state across turns) — enabled on all
 * stateful agents.
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) { console.error('No ELEVENLABS_API_KEY in env. Aborting.'); process.exit(1); }
const BASE = 'https://api.elevenlabs.io/v1';

// Per-agent config
const AGENTS = [
  {
    name: 'ava',
    agent_id: 'agent_1201kmqdjgxvfxxteedpkvjej7er',
    system_tools: ['end_call', 'skip_turn', 'transfer_to_agent'],
    first_message: null, // keep existing
  },
  {
    name: 'finn',
    agent_id: 'agent_2201kmqdjjyben0tyg2t5eexnmzg',
    system_tools: ['end_call', 'skip_turn', 'transfer_to_agent'],
    first_message: null,
  },
  {
    name: 'eli',
    agent_id: 'agent_4201kmqdjm1tfhfaggnnfjax3m6d',
    system_tools: ['end_call', 'skip_turn', 'transfer_to_agent'],
    first_message: null,
  },
  {
    name: 'nora',
    agent_id: 'agent_1901kmqdjmwmfqg9rqr5jngfydnw',
    system_tools: ['end_call', 'skip_turn', 'transfer_to_agent'],
    first_message: null,
  },
  {
    name: 'sarah-receptionist',
    agent_id: 'agent_6501kp71h69jfqysgd055hemqhrq',
    system_tools: ['end_call', 'skip_turn', 'transfer_to_number'],
    first_message: null, // public-facing greeting comes from workflow node
  },
  {
    name: 'sarah-frontdesk',
    agent_id: 'agent_8901kmqdjnrte7psp6en4f85m4kt',
    system_tools: ['end_call', 'skip_turn'],
    // Owner already knows who Sarah is — drop the introduction.
    // Short, direct, internal. Lets Sarah jump into the desk briefing.
    first_message: 'What needs attention first?',
  },
];

// Built-in tool config shapes — ElevenLabs requires `params` (system-tool config object).
const TOOL_SHAPES = {
  end_call: { name: 'end_call', description: 'End the conversation when the caller is finished or the task is complete.', params: { system_tool_type: 'end_call' } },
  skip_turn: { name: 'skip_turn', description: 'Skip a turn when the caller is mid-thought and the agent should stay quiet.', params: { system_tool_type: 'skip_turn' } },
  language_detection: { name: 'language_detection', description: 'Detect the caller language at the start of the call.', params: { system_tool_type: 'language_detection' } },
  transfer_to_agent: { name: 'transfer_to_agent', description: 'Transfer the conversation to another internal agent.', params: { system_tool_type: 'transfer_to_agent', transfers: [] } },
  transfer_to_number: { name: 'transfer_to_number', description: 'Transfer the live call to an external phone number from the routing contacts list.', params: { system_tool_type: 'transfer_to_number', transfers: [] } },
  play_keypad_touch_tone: { name: 'play_keypad_touch_tone', description: 'Play a DTMF tone.', params: { system_tool_type: 'play_keypad_touch_tone' } },
  voicemail_detection: { name: 'voicemail_detection', description: 'Detect a voicemail greeting and end the call.', params: { system_tool_type: 'voicemail_detection', voicemail_message: '' } },
  update_state: { name: 'update_state', description: 'Persist short-lived turn-state for the active session (Alpha).', params: { system_tool_type: 'update_state', update_state: { updates: [] } } },
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

function buildBuiltInTools(enabledList) {
  const all = Object.keys(TOOL_SHAPES);
  const out = {};
  for (const name of all) {
    out[name] = enabledList.includes(name) ? TOOL_SHAPES[name] : null;
  }
  // Always-null Alpha/private tools we don't touch
  for (const t of ['memory_entry_search', 'memory_entry_create', 'memory_entry_update', 'memory_entry_delete', 'agent_prompt_change', 'procedure_update', 'transfer_to_genesys_chat']) {
    out[t] = null;
  }
  return out;
}

async function syncAgent(agent) {
  console.log(`\n=== ${agent.name} (${agent.agent_id}) ===`);

  // Build the patch
  const built_in_tools = buildBuiltInTools(agent.system_tools);
  const conversation_config = {
    agent: {
      prompt: { built_in_tools },
    },
  };
  if (agent.first_message !== null) {
    conversation_config.agent.first_message = agent.first_message;
  }

  // BEFORE state
  const before = await api('GET', `/convai/agents/${agent.agent_id}`);
  const beforeFirst = before?.conversation_config?.agent?.first_message;
  const beforeTools = before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const beforeActive = Object.entries(beforeTools).filter(([, v]) => v != null).map(([k]) => k);
  console.log(`  before first_message: ${JSON.stringify(beforeFirst).slice(0, 100)}`);
  console.log(`  before active sys tools: [${beforeActive.join(', ') || 'none'}]`);

  // PATCH
  await api('PATCH', `/convai/agents/${agent.agent_id}`, { conversation_config });

  // AFTER state
  const after = await api('GET', `/convai/agents/${agent.agent_id}`);
  const afterFirst = after?.conversation_config?.agent?.first_message;
  const afterTools = after?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const afterActive = Object.entries(afterTools).filter(([, v]) => v != null).map(([k]) => k);
  console.log(`  AFTER  first_message: ${JSON.stringify(afterFirst).slice(0, 100)}`);
  console.log(`  AFTER  active sys tools: [${afterActive.join(', ')}]`);
  console.log(`  ✓ synced`);
}

(async () => {
  for (const agent of AGENTS) {
    try {
      await syncAgent(agent);
    } catch (e) {
      console.error(`  ✗ ${agent.name} failed: ${String(e.message || e).slice(0, 400)}`);
    }
  }
  console.log('\nDone.');
})();
