#!/usr/bin/env node
/**
 * Pass 18+ §16.M extension — clears the "at least one transfer rule required"
 * error on `transfer_to_agent` system tool across all 6 EL agents.
 *
 * The earlier sync-elevenlabs-transfer-rules.mjs only addressed
 * `transfer_to_number`. Discovery via GET /v1/convai/agents/{id}: Nora, Eli,
 * Finn, and Ava ALL have `transfer_to_agent` enabled with `transfers: []`
 * (empty array) which triggers EL's validation error.
 *
 * Per-agent action:
 *   Ava                 ON  with 5 transfers — routes to specialists based
 *                            on conversation intent (Eli/Nora/Finn/Sarah-R/Sarah-FD).
 *                            Ava IS the chief-of-staff orchestrator.
 *   Eli                 OFF — email specialist; conversation ends with him.
 *   Nora                OFF — meeting assistant; conversation ends with her.
 *   Finn                OFF — finance hub manager; advisory only.
 *   Sarah Receptionist  OFF — already null (verified).
 *   Sarah Front Desk    OFF — already null (verified).
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-transfer-to-agent.mjs
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) {
  console.error('No ELEVENLABS_API_KEY in env. Aborting.');
  process.exit(1);
}
const BASE = 'https://api.elevenlabs.io/v1';

// Agent IDs verified 2026-04-29 via mcp__elevenlabs__list_agents.
const AGENTS = {
  ava:                  'agent_1201kmqdjgxvfxxteedpkvjej7er',
  eli:                  'agent_4201kmqdjm1tfhfaggnnfjax3m6d',
  nora:                 'agent_1901kmqdjmwmfqg9rqr5jngfydnw',
  finn:                 'agent_2201kmqdjjyben0tyg2t5eexnmzg',
  'sarah-receptionist': 'agent_6501kp71h69jfqysgd055hemqhrq',
  'sarah-frontdesk':    'agent_8901kmqdjnrte7psp6en4f85m4kt',
};

/**
 * Ava's chief-of-staff routing rules. She transfers to specialists based on
 * conversation intent. Each rule has agent_id + condition + transfer_message.
 *
 * conversation_config.agent.prompt.built_in_tools.transfer_to_agent.params.transfers
 * shape per EL contract (verified by inspecting current agent JSON):
 *   {
 *     agent_id: "agent_...",
 *     condition: "natural language description",
 *     delay_ms?: number,
 *     transfer_message?: string,
 *     enable_transferred_agent_first_message?: boolean,
 *   }
 */
const AVA_TRANSFER_TO_AGENT_RULES = [
  {
    agent_id: AGENTS.eli,
    condition:
      'When the owner wants to triage their inbox, draft an email reply, or do anything email-related — Eli is the email specialist.',
    delay_ms: 800,
    transfer_message: "Connecting you with Eli, your email specialist.",
    enable_transferred_agent_first_message: true,
  },
  {
    agent_id: AGENTS.nora,
    condition:
      'When the owner wants to schedule a meeting, prep for an upcoming call, set up a video conference, or get a recap of a recent meeting — Nora is the meeting assistant.',
    delay_ms: 800,
    transfer_message: "Bringing in Nora to handle the meeting side.",
    enable_transferred_agent_first_message: true,
  },
  {
    agent_id: AGENTS.finn,
    condition:
      'When the owner wants finance, books, invoices, quotes, payroll, tax review, cash position, or any money-related question — Finn is the finance hub manager.',
    delay_ms: 800,
    transfer_message: "Let me hand you to Finn for the finance side.",
    enable_transferred_agent_first_message: true,
  },
  {
    agent_id: AGENTS['sarah-frontdesk'],
    condition:
      'When the owner wants to triage missed calls, listen to voicemails, prep callbacks, or work the front desk queue — Sarah Front Desk runs the call desk.',
    delay_ms: 800,
    transfer_message: "Switching you to Sarah at the front desk.",
    enable_transferred_agent_first_message: true,
  },
  {
    agent_id: AGENTS['sarah-receptionist'],
    condition:
      'When the owner wants to test or configure how inbound external calls are handled — Sarah Receptionist is the public-facing receptionist.',
    delay_ms: 800,
    transfer_message: "Looping in Sarah Receptionist for the inbound call setup.",
    enable_transferred_agent_first_message: true,
  },
];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${method} ${path}: ${text.slice(0, 600)}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function syncAva() {
  const agentId = AGENTS.ava;
  console.log(`\n=== ava (${agentId}) ===`);

  const before = await api('GET', `/convai/agents/${agentId}`);
  const existingTools = before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const beforeRules = existingTools.transfer_to_agent?.params?.transfers || [];
  console.log(`  before: transfer_to_agent transfers=${beforeRules.length}`);

  // Preserve other system tools; only mutate transfer_to_agent.
  const built_in_tools = { ...existingTools };
  // Build the new transfer_to_agent block, preserving the existing config
  // (response_timeout, sound, etc.) and replacing only the params.transfers list.
  const existingTta = existingTools.transfer_to_agent || {};
  built_in_tools.transfer_to_agent = {
    ...existingTta,
    type: existingTta.type || 'system',
    name: 'transfer_to_agent',
    description: existingTta.description || 'Transfer the conversation to another internal agent.',
    params: {
      system_tool_type: 'transfer_to_agent',
      transfers: AVA_TRANSFER_TO_AGENT_RULES,
    },
  };

  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${agentId}`);
  const afterRules =
    after?.conversation_config?.agent?.prompt?.built_in_tools
      ?.transfer_to_agent?.params?.transfers || [];
  console.log(`  after:  transfer_to_agent transfers=${afterRules.length}`);
  console.log(
    `  rules: ${afterRules
      .map((r, i) => `[${i + 1}] → ${r.agent_id?.slice(-12) || '(no agent)'}`)
      .join(', ')}`,
  );
  if (afterRules.length !== AVA_TRANSFER_TO_AGENT_RULES.length) {
    throw new Error(
      `Ava transfer_to_agent rule count mismatch — expected ${AVA_TRANSFER_TO_AGENT_RULES.length}, got ${afterRules.length}`,
    );
  }
  console.log('  ✓ synced 5 transfer_to_agent rules (Ava as chief-of-staff)');
}

async function disableTransferToAgent(name, agentId) {
  console.log(`\n=== ${name} (${agentId}) ===`);

  const before = await api('GET', `/convai/agents/${agentId}`);
  const existingTools = before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const wasOn = existingTools.transfer_to_agent != null;
  console.log(`  before: transfer_to_agent ${wasOn ? 'ON' : 'OFF (or null)'}`);

  if (!wasOn) {
    console.log('  ✓ already off — nothing to do (idempotent)');
    return;
  }

  // Set transfer_to_agent to null to disable.
  const built_in_tools = { ...existingTools, transfer_to_agent: null };

  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${agentId}`);
  const stillOn =
    after?.conversation_config?.agent?.prompt?.built_in_tools
      ?.transfer_to_agent != null;
  console.log(`  after:  transfer_to_agent ${stillOn ? 'ON ✗' : 'OFF ✓'}`);
  if (stillOn) {
    throw new Error(
      `${name} transfer_to_agent still ON after PATCH — EL did not accept disable`,
    );
  }
}

(async () => {
  let failures = 0;

  // Ava — chief-of-staff, ENABLE with 5 transfer rules
  try {
    await syncAva();
  } catch (e) {
    console.error(`✗ ava failed: ${e.message}`);
    failures++;
  }

  // Specialists — DISABLE transfer_to_agent (they don't route)
  for (const name of ['eli', 'nora', 'finn', 'sarah-receptionist', 'sarah-frontdesk']) {
    try {
      await disableTransferToAgent(name, AGENTS[name]);
    } catch (e) {
      console.error(`✗ ${name} failed: ${e.message}`);
      failures++;
    }
  }

  console.log(
    `\nDone. ${failures === 0 ? 'All 6 agents synced ✓' : `${failures} failure(s) ✗`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
