#!/usr/bin/env node
/**
 * Pass 18+ §16.M extension — clears the "at least one transfer rule required"
 * error on `transfer_to_agent` system tool across the EL agents.
 *
 * Two distinct routing surfaces (per user clarification):
 *
 * 1) INTERNAL hub-and-spoke (the desktop owner's experience):
 *    Ava is the central hub on the desktop homepage. The internal specialists
 *    (Eli, Nora, Finn, Sarah Front Desk) transfer back to Ava when the owner's
 *    intent shifts beyond their domain. Ava routes outward to those 4
 *    specialists by intent.
 *
 * 2) EXTERNAL receptionist (Sarah Receptionist):
 *    Sarah Receptionist handles inbound external CALLERS (customers/leads).
 *    She is NOT part of the internal Ava hub. She routes to TEAM MEMBERS /
 *    EMPLOYEES only, via transfer_to_NUMBER (5 dynamic-variable rules:
 *    owner / sales / support / billing / scheduling — populated per office
 *    by the personalization webhook from front_desk_routing_contacts).
 *    transfer_to_AGENT on Sarah Receptionist is DISABLED (null) — she does
 *    not hand external callers off to Ava or any other internal agent.
 *
 * Per-agent transfer_to_agent config:
 *   Ava                 ON  with 4 transfers — routes outward to internal
 *                            specialists by intent (Eli/Nora/Finn/Sarah-FD).
 *   Eli                 ON  with 1 rule  → Ava (back-to-hub when needed)
 *   Nora                ON  with 1 rule  → Ava
 *   Finn                ON  with 1 rule  → Ava
 *   Sarah Front Desk    ON  with 1 rule  → Ava (internal call desk specialist)
 *   Sarah Receptionist  OFF — external-only; routes to team via transfer_to_number
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
// Ava's INTERNAL outward routing rules (4 specialists). Sarah Receptionist is
// EXCLUDED — she is the external caller-facing agent, not part of the
// internal Ava hub. To configure inbound call handling, the owner uses the
// Front Desk Setup page in the desktop UI, not a Sarah Receptionist transfer.
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
  console.log(`  ✓ synced ${AVA_TRANSFER_TO_AGENT_RULES.length} transfer_to_agent rules (Ava as internal chief-of-staff)`);
}

/**
 * Disable transfer_to_agent on an agent (set to null). Used for Sarah
 * Receptionist who is external-only and never transfers to internal agents.
 */
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

/**
 * Specialist-back-to-Ava rule. Each specialist gets a single transfer_to_agent
 * rule that hands the conversation back to Ava when the owner's intent moves
 * beyond the specialist's domain.
 */
function backToAvaRule(specialistDomain) {
  return {
    agent_id: AGENTS.ava,
    condition:
      `When the owner's intent moves beyond ${specialistDomain} — for example they ` +
      `want a brief from across the office, want to start a different workflow, ` +
      `or just want to talk to Ava again — hand the conversation back to Ava.`,
    delay_ms: 600,
    transfer_message: "Bringing Ava back in.",
    enable_transferred_agent_first_message: true,
  };
}

// Internal specialists only. Sarah Receptionist is intentionally absent —
// she is external-facing and her transfer_to_agent stays disabled.
const SPECIALIST_DOMAINS = {
  eli: 'email triage and inbox work',
  nora: 'meetings, scheduling, and conference recap',
  finn: 'finance, books, invoices, quotes, payroll, and cash review',
  'sarah-frontdesk': 'missed-call triage, voicemails, callbacks, and SMS',
};

async function syncSpecialistBackToAva(name, agentId) {
  console.log(`\n=== ${name} (${agentId}) ===`);

  const before = await api('GET', `/convai/agents/${agentId}`);
  const existingTools = before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const beforeRules = existingTools.transfer_to_agent?.params?.transfers || [];
  console.log(
    `  before: transfer_to_agent ${existingTools.transfer_to_agent ? 'ON' : 'OFF'}, ` +
      `transfers=${beforeRules.length}`,
  );

  const existingTta = existingTools.transfer_to_agent || {};
  const built_in_tools = { ...existingTools };
  built_in_tools.transfer_to_agent = {
    ...existingTta,
    type: existingTta.type || 'system',
    name: 'transfer_to_agent',
    description:
      existingTta.description ||
      'Transfer the conversation to another internal agent.',
    params: {
      system_tool_type: 'transfer_to_agent',
      transfers: [backToAvaRule(SPECIALIST_DOMAINS[name])],
    },
  };

  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${agentId}`);
  const afterRules =
    after?.conversation_config?.agent?.prompt?.built_in_tools
      ?.transfer_to_agent?.params?.transfers || [];
  console.log(`  after:  transfer_to_agent ON, transfers=${afterRules.length}`);
  if (afterRules.length !== 1) {
    throw new Error(
      `${name} expected 1 back-to-Ava rule, got ${afterRules.length}`,
    );
  }
  if (afterRules[0].agent_id !== AGENTS.ava) {
    throw new Error(
      `${name} rule's agent_id should be Ava (${AGENTS.ava}), got ${afterRules[0].agent_id}`,
    );
  }
  console.log('  ✓ rule → Ava installed');
}

(async () => {
  let failures = 0;

  // Ava — chief-of-staff, ENABLE with 5 outward transfer rules
  try {
    await syncAva();
  } catch (e) {
    console.error(`✗ ava failed: ${e.message}`);
    failures++;
  }

  // INTERNAL specialists — ENABLE with 1 back-to-Ava rule each (hub-and-spoke).
  for (const name of ['eli', 'nora', 'finn', 'sarah-frontdesk']) {
    try {
      await syncSpecialistBackToAva(name, AGENTS[name]);
    } catch (e) {
      console.error(`✗ ${name} failed: ${e.message}`);
      failures++;
    }
  }

  // EXTERNAL: Sarah Receptionist — DISABLE transfer_to_agent.
  // She is the external receptionist and routes only via transfer_to_NUMBER
  // (5 dynamic-variable rules → office routing contacts: owner/sales/support/
  // billing/scheduling phones). She MUST NOT transfer to internal agents.
  try {
    await disableTransferToAgent('sarah-receptionist', AGENTS['sarah-receptionist']);
  } catch (e) {
    console.error(`✗ sarah-receptionist failed: ${e.message}`);
    failures++;
  }

  console.log(
    `\nDone. ${failures === 0 ? 'All 6 agents synced ✓' : `${failures} failure(s) ✗`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
