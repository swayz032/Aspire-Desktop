#!/usr/bin/env node
/**
 * Sarah Receptionist — voicemail/keypad tools + per-node KB scoping
 * (Pass 19 §3.4 — KB scoped per-subagent, plus voicemail + DTMF tool wiring).
 *
 * What this does, idempotently:
 *  1) Enables voicemail_detection on the agent — registers the system tool
 *     with a description + a configurable voicemail_message so Sarah leaves
 *     a structured message instead of silently dropping voicemails.
 *  2) Enables play_keypad_touch_tone with a description so the LLM uses it
 *     during IVR navigation (e.g. "press 1 for support" trees).
 *  3) Scopes RECEPTIONIST_SARAH_* knowledge-base docs onto the right
 *     workflow nodes via `additional_knowledge_base` — instead of relying
 *     on the global agent KB which forces every node to RAG against every
 *     doc, we narrow:
 *       - greeting        -> voice rules
 *       - transfer        -> routing+transfer policy
 *       - take_message    -> message capture canon
 *       - answer_faq      -> call workflows + safety/privacy canon
 *       - wrap_up         -> voice rules
 *       - after_hours     -> call workflows + safety/privacy canon
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-sarah-tools-and-kb.mjs
 *   ELEVENLABS_API_KEY=... DRY_RUN=1 node scripts/sync-elevenlabs-sarah-tools-and-kb.mjs
 *
 * Re-running is safe — script GETs current state first and only PATCHes
 * fields that drifted from canonical.
 */

const SCRIPT_NAME = 'sarah-tools-and-kb';
const AGENT_ID = 'agent_6501kp71h69jfqysgd055hemqhrq';
const API = 'https://api.elevenlabs.io';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const log = (...a) => console.log(`[${new Date().toISOString()}] [${SCRIPT_NAME}]`, ...a);
const die = (msg) => { console.error(`[${SCRIPT_NAME}] ERROR: ${msg}`); process.exit(1); };

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) die('ELEVENLABS_API_KEY not set');

// ---------------------------------------------------------------------------
// Canonical config
// ---------------------------------------------------------------------------

const VOICEMAIL_MESSAGE_DEFAULT =
  "Hi, this is Sarah calling on behalf of {{ business_name }}. " +
  "We tried to reach you and got your voicemail. Please call us back at your " +
  "convenience — we'll be happy to help. Thank you!";

const TOOL_VOICEMAIL = {
  type: 'system',
  name: 'voicemail_detection',
  description:
    'Detect when an outbound call lands on voicemail (instead of a human ' +
    'pickup) and leave a brief, structured message identifying ' +
    '{{ business_name }} and asking for a callback. Trigger automatically ' +
    'when voicemail beeps or a recorded greeting is detected.',
  response_timeout_secs: 30,
  disable_interruptions: false,
  force_pre_tool_speech: false,
  pre_tool_speech: 'auto',
  assignments: [],
  tool_call_sound: null,
  tool_call_sound_behavior: 'auto',
  tool_error_handling_mode: 'auto',
  params: {
    system_tool_type: 'voicemail_detection',
    voicemail_message: VOICEMAIL_MESSAGE_DEFAULT,
  },
};

const TOOL_KEYPAD = {
  type: 'system',
  name: 'play_keypad_touch_tone',
  description:
    'Play DTMF (touch-tone) digits when navigating an automated phone tree ' +
    "after a transfer — e.g. when the destination's IVR says 'press 1 for " +
    "support'. Only use after a transfer has connected, never on the live " +
    'caller-side conversation. Pass the exact digits as a string.',
  response_timeout_secs: 20,
  disable_interruptions: false,
  force_pre_tool_speech: false,
  pre_tool_speech: 'auto',
  assignments: [],
  tool_call_sound: null,
  tool_call_sound_behavior: 'auto',
  tool_error_handling_mode: 'auto',
  params: {
    system_tool_type: 'play_keypad_touch_tone',
  },
};

// Map of canonical KB doc name -> document_id resolved at runtime via GET /v1/convai/knowledge-base.
const KB_NAMES_NEEDED = [
  '02_RECEPTIONIST_SARAH_VOICE_RULES_v2',
  '03_RECEPTIONIST_SARAH_CALL_WORKFLOWS_v2',
  '04_RECEPTIONIST_SARAH_MESSAGE_CAPTURE_CANON_v2',
  '05_RECEPTIONIST_SARAH_ROUTING_AND_TRANSFER_POLICY_v2',
  '06_RECEPTIONIST_SARAH_SAFETY_AND_PRIVACY_CANON_v2',
];

const NODE_KB_PLAN = {
  greeting:    ['02_RECEPTIONIST_SARAH_VOICE_RULES_v2'],
  transfer:    ['05_RECEPTIONIST_SARAH_ROUTING_AND_TRANSFER_POLICY_v2'],
  take_message:['04_RECEPTIONIST_SARAH_MESSAGE_CAPTURE_CANON_v2'],
  answer_faq:  ['03_RECEPTIONIST_SARAH_CALL_WORKFLOWS_v2', '06_RECEPTIONIST_SARAH_SAFETY_AND_PRIVACY_CANON_v2'],
  wrap_up:     ['02_RECEPTIONIST_SARAH_VOICE_RULES_v2'],
  after_hours: ['03_RECEPTIONIST_SARAH_CALL_WORKFLOWS_v2', '06_RECEPTIONIST_SARAH_SAFETY_AND_PRIVACY_CANON_v2'],
};

// ---------------------------------------------------------------------------
// EL API helpers
// ---------------------------------------------------------------------------

async function call(method, path, body) {
  const url = `${API}${path}`;
  const opts = {
    method,
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

function kbItem(id, name) {
  return { id, name, type: 'text', usage_mode: 'auto' };
}

// ---------------------------------------------------------------------------
// Diff helpers (idempotency)
// ---------------------------------------------------------------------------

function toolMatches(actual, canonical) {
  if (!actual) return false;
  const sameDesc = actual.description === canonical.description;
  const sameSysType = actual.params?.system_tool_type === canonical.params.system_tool_type;
  const sameVm = canonical.params.voicemail_message
    ? actual.params?.voicemail_message === canonical.params.voicemail_message
    : true;
  return sameDesc && sameSysType && sameVm;
}

function nodeKbMatches(node, expectedIds) {
  const cur = (node.additional_knowledge_base || []).map((k) => k.id).sort();
  const exp = [...expectedIds].sort();
  return cur.length === exp.length && cur.every((v, i) => v === exp[i]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Starting (DRY_RUN=${DRY_RUN})`);
  log(`Agent: ${AGENT_ID}`);

  // 1. Resolve KB ids ───────────────────────────────────────────────────────
  log('GET /v1/convai/knowledge-base — resolving canonical KB doc IDs...');
  const kbList = await call('GET', '/v1/convai/knowledge-base');
  const docs = kbList.documents || (Array.isArray(kbList) ? kbList : []);
  const byName = new Map(docs.map((d) => [d.name, d.id]));
  for (const name of KB_NAMES_NEEDED) {
    if (!byName.has(name)) die(`KB doc missing in workspace: ${name}`);
  }
  log(`  Resolved ${KB_NAMES_NEEDED.length} canonical KB docs`);

  // 2. GET current agent state ─────────────────────────────────────────────
  log('GET agent state...');
  const agent = await call('GET', `/v1/convai/agents/${AGENT_ID}`);
  const tools = agent.conversation_config?.agent?.prompt?.built_in_tools || {};
  const wf = agent.workflow || { nodes: {}, edges: [] };
  const nodes = wf.nodes || {};

  // 3. Diff ──────────────────────────────────────────────────────────────────
  const vmOk = toolMatches(tools.voicemail_detection, TOOL_VOICEMAIL);
  const kpOk = toolMatches(tools.play_keypad_touch_tone, TOOL_KEYPAD);
  log(`  voicemail_detection canonical: ${vmOk ? 'OK' : 'NEEDS UPDATE'}`);
  log(`  play_keypad_touch_tone canonical: ${kpOk ? 'OK' : 'NEEDS UPDATE'}`);

  const nodeUpdates = {};
  for (const [nodeId, kbNames] of Object.entries(NODE_KB_PLAN)) {
    const node = nodes[nodeId];
    if (!node) {
      log(`  WARNING: workflow node missing: ${nodeId} (skipping KB attach)`);
      continue;
    }
    const expectedIds = kbNames.map((n) => byName.get(n));
    if (nodeKbMatches(node, expectedIds)) {
      log(`  node[${nodeId}] KB: OK (${expectedIds.length} docs)`);
    } else {
      log(`  node[${nodeId}] KB: NEEDS UPDATE (${expectedIds.length} docs)`);
      nodeUpdates[nodeId] = {
        ...node,
        additional_knowledge_base: kbNames.map((n) => kbItem(byName.get(n), n)),
      };
    }
  }

  const needsToolPatch = !vmOk || !kpOk;
  const needsWorkflowPatch = Object.keys(nodeUpdates).length > 0;

  if (!needsToolPatch && !needsWorkflowPatch) {
    log('Nothing to do — agent already canonical.');
    return;
  }

  // 4. Build PATCH body ─────────────────────────────────────────────────────
  const patchBody = {};

  if (needsToolPatch) {
    // PATCH semantics: send ONLY the built_in_tools delta. The agent already
    // has both `tools` and `tool_ids` populated on disk, and EL refuses any
    // PATCH that surfaces both in the same request body
    // ("Cannot specify both tools and tool IDs"). Sending only the
    // built_in_tools field at the deepest path avoids the conflict and EL
    // merges the rest. Preserve every other tool that was already there.
    const newTools = { ...tools };
    if (!vmOk) newTools.voicemail_detection = TOOL_VOICEMAIL;
    if (!kpOk) newTools.play_keypad_touch_tone = TOOL_KEYPAD;
    patchBody.conversation_config = {
      agent: {
        prompt: {
          built_in_tools: newTools,
        },
      },
    };
  }

  if (needsWorkflowPatch) {
    const mergedNodes = { ...nodes, ...nodeUpdates };
    patchBody.workflow = { ...wf, nodes: mergedNodes };
  }

  if (DRY_RUN) {
    log('DRY_RUN — would PATCH:');
    log(`  needsToolPatch=${needsToolPatch} needsWorkflowPatch=${needsWorkflowPatch}`);
    log(`  nodes touched: ${Object.keys(nodeUpdates).join(', ')}`);
    return;
  }

  // 5. PATCH ─────────────────────────────────────────────────────────────────
  log('PATCH /v1/convai/agents/{id}...');
  await call('PATCH', `/v1/convai/agents/${AGENT_ID}`, patchBody);
  log('PATCH applied.');

  // 6. Verify ────────────────────────────────────────────────────────────────
  log('Verifying...');
  const after = await call('GET', `/v1/convai/agents/${AGENT_ID}`);
  const aTools = after.conversation_config?.agent?.prompt?.built_in_tools || {};
  const aNodes = after.workflow?.nodes || {};

  const okVm = toolMatches(aTools.voicemail_detection, TOOL_VOICEMAIL);
  const okKp = toolMatches(aTools.play_keypad_touch_tone, TOOL_KEYPAD);
  log(`  voicemail_detection: ${okVm ? 'OK' : 'STILL DRIFTED'}`);
  log(`  play_keypad_touch_tone: ${okKp ? 'OK' : 'STILL DRIFTED'}`);
  let allKbOk = true;
  for (const [nodeId, kbNames] of Object.entries(NODE_KB_PLAN)) {
    const expectedIds = kbNames.map((n) => byName.get(n));
    const after_node = aNodes[nodeId] || {};
    const nodeOk = nodeKbMatches(after_node, expectedIds);
    log(`  node[${nodeId}]: ${nodeOk ? 'OK' : 'STILL DRIFTED'}`);
    if (!nodeOk) allKbOk = false;
  }

  if (okVm && okKp && allKbOk) {
    log('VERIFICATION PASSED');
  } else {
    log('VERIFICATION FAILED — check above for drift');
    process.exit(2);
  }
}

main().catch((err) => die(err.message || String(err)));
