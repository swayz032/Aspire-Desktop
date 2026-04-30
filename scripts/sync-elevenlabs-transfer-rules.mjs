#!/usr/bin/env node
/**
 * Pass 16 §16.M — clear the "at least one transfer rule required" error
 * on all 6 Aspire ElevenLabs agents.
 *
 * Per-agent action:
 *   Sarah Receptionist  ON  with 5 dynamic-variable transfer rules covering
 *                            owner / sales / support / billing / scheduling.
 *                            Each rule's destination is `{{ routing_<role>_phone }}`,
 *                            populated by the personalization webhook (§16.D)
 *                            from front_desk_routing_contacts at call start.
 *   Sarah Front Desk    OFF (set to null) — internal owner-facing, no transfers.
 *   Nora                OFF — meeting assistant, not a router.
 *   Eli                 OFF — email specialist.
 *   Finn                OFF — finance hub manager (advisory only).
 *   Ava                 OFF for transfer_to_number — Ava routes via
 *                            `transfer_to_agent` (different system tool).
 *
 * Verified contracts:
 *   - EL Phone Numbers API (POST /v1/convai/phone-numbers, PATCH /v1/convai/
 *     phone-numbers/{id}) confirmed via OpenAPI inspection 2026-04-29.
 *   - Transfer-rule schema verified per EL docs
 *     `agents-platform/customization/tools/system-tools/transfer-to-human`.
 *   - Dynamic-variable destinations were added in EL Nov 5 2025 release —
 *     the `PhoneNumberDynamicVariableTransferDestination` discriminator is
 *     what enables `{{ routing_owner_phone }}` placeholders.
 *
 * Idempotent: re-running this script produces no API drift. Always GETs
 * current agent shape before PATCHing so we don't clobber unrelated config.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-transfer-rules.mjs
 *
 * Or via Railway:
 *   railway run -e dev node scripts/sync-elevenlabs-transfer-rules.mjs
 */

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) {
  console.error('No ELEVENLABS_API_KEY in env. Aborting.');
  process.exit(1);
}
const BASE = 'https://api.elevenlabs.io/v1';

// Agent IDs verified 2026-04-29 via mcp__elevenlabs__list_agents.
const AGENTS = {
  'sarah-receptionist': 'agent_6501kp71h69jfqysgd055hemqhrq',
  'sarah-frontdesk':    'agent_8901kmqdjnrte7psp6en4f85m4kt',
  'nora':               'agent_1901kmqdjmwmfqg9rqr5jngfydnw',
  'eli':                'agent_4201kmqdjm1tfhfaggnnfjax3m6d',
  'finn':               'agent_2201kmqdjjyben0tyg2t5eexnmzg',
  'ava':                'agent_1201kmqdjgxvfxxteedpkvjej7er',
};

/**
 * Sarah Receptionist's 5 transfer rules — each uses a dynamic-variable
 * destination so the personalization webhook populates the actual phone
 * number per tenant at call start. Empty-string check in `condition` keeps
 * Sarah from attempting an invalid transfer when a routing role isn't
 * configured for an office.
 *
 * Transfer type `conference` = warm transfer (Sarah introduces caller before
 * leaving the line) — matches Sarah v2 §05 routing/transfer policy. SMB-
 * receptionist convention.
 */
const SARAH_RECEPTIONIST_TRANSFER_RULES = [
  {
    transfer_destination: {
      type: 'phone',
      phone_number: '{{ routing_owner_phone }}',
    },
    condition:
      'When the caller is asking to speak with the owner, founder, manager, or person in charge — and {{ routing_owner_phone }} is not empty.',
    transfer_type: 'conference',
  },
  {
    transfer_destination: {
      type: 'phone',
      phone_number: '{{ routing_sales_phone }}',
    },
    condition:
      'When the caller is asking about new business, sales, quotes, estimates, or pricing — and {{ routing_sales_phone }} is not empty.',
    transfer_type: 'conference',
  },
  {
    transfer_destination: {
      type: 'phone',
      phone_number: '{{ routing_support_phone }}',
    },
    condition:
      'When the caller has a support, service, warranty, or product issue — and {{ routing_support_phone }} is not empty.',
    transfer_type: 'conference',
  },
  {
    transfer_destination: {
      type: 'phone',
      phone_number: '{{ routing_billing_phone }}',
    },
    condition:
      'When the caller is asking about an invoice, payment, or billing question — and {{ routing_billing_phone }} is not empty.',
    transfer_type: 'conference',
  },
  {
    transfer_destination: {
      type: 'phone',
      phone_number: '{{ routing_scheduling_phone }}',
    },
    condition:
      'When the caller wants to schedule, reschedule, or confirm an appointment — and {{ routing_scheduling_phone }} is not empty.',
    transfer_type: 'conference',
  },
];

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${method} ${path}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function syncSarahReceptionist(agentId) {
  console.log(`\n=== sarah-receptionist (${agentId}) ===`);

  const before = await api('GET', `/convai/agents/${agentId}`);
  const existingTools =
    before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const beforeRules =
    existingTools.transfer_to_number?.params?.transfers || [];
  console.log(`  before: ${beforeRules.length} transfer rule(s)`);

  const built_in_tools = { ...existingTools };
  built_in_tools.transfer_to_number = {
    name: 'transfer_to_number',
    description:
      'Transfer the caller to a human routing contact when the conversation calls for it.',
    params: {
      system_tool_type: 'transfer_to_number',
      transfers: SARAH_RECEPTIONIST_TRANSFER_RULES,
    },
  };

  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${agentId}`);
  const afterRules =
    after?.conversation_config?.agent?.prompt?.built_in_tools
      ?.transfer_to_number?.params?.transfers || [];
  console.log(`  after:  ${afterRules.length} transfer rule(s)`);
  console.log(
    `  rules: ${afterRules
      .map((r, i) => `[${i + 1}] ${r.transfer_destination?.phone_number}`)
      .join(', ')}`,
  );
  if (afterRules.length !== SARAH_RECEPTIONIST_TRANSFER_RULES.length) {
    throw new Error(
      `Sarah Receptionist rule count mismatch — expected ${SARAH_RECEPTIONIST_TRANSFER_RULES.length}, got ${afterRules.length}`,
    );
  }
  console.log('  ✓ synced 5 dynamic-variable transfer rules');
}

async function disableTransferToNumber(name, agentId) {
  console.log(`\n=== ${name} (${agentId}) ===`);

  const before = await api('GET', `/convai/agents/${agentId}`);
  const existingTools =
    before?.conversation_config?.agent?.prompt?.built_in_tools || {};
  const wasOn = existingTools.transfer_to_number != null;
  console.log(`  before: transfer_to_number ${wasOn ? 'ON' : 'OFF (or null)'}`);

  if (!wasOn) {
    console.log('  ✓ already off — nothing to do (idempotent)');
    return;
  }

  // Set transfer_to_number to null to disable.
  // EL accepts null in the PATCH body to clear a system tool slot.
  const built_in_tools = { ...existingTools, transfer_to_number: null };

  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { built_in_tools } } },
  });

  const after = await api('GET', `/convai/agents/${agentId}`);
  const stillOn =
    after?.conversation_config?.agent?.prompt?.built_in_tools
      ?.transfer_to_number != null;
  console.log(`  after:  transfer_to_number ${stillOn ? 'ON ✗' : 'OFF ✓'}`);
  if (stillOn) {
    throw new Error(
      `${name} transfer_to_number still ON after PATCH — EL did not accept disable`,
    );
  }
}

(async () => {
  let failures = 0;

  // Sarah Receptionist — enable with 5 dynamic-variable rules
  try {
    await syncSarahReceptionist(AGENTS['sarah-receptionist']);
  } catch (e) {
    console.error(`✗ sarah-receptionist failed: ${e.message}`);
    failures++;
  }

  // The other 5 agents — disable transfer_to_number
  for (const name of [
    'sarah-frontdesk',
    'nora',
    'eli',
    'finn',
    'ava',
  ]) {
    try {
      await disableTransferToNumber(name, AGENTS[name]);
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
