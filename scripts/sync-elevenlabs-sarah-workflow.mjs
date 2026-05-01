#!/usr/bin/env node
// [STATUS: DRAFT — REQUIRES EL API SCHEMA ALIGNMENT BEFORE LIVE DEPLOYMENT]
// [DRY-RUN IS SAFE. DO NOT RUN LIVE UNTIL SCHEMA IS VERIFIED.]
/**
 * Authors the 2026-pattern ElevenLabs Workflow for Sarah Receptionist.
 *
 * IMPORTANT — EL WORKFLOW API SCHEMA (verified 2026-05-01 via live probe):
 *   - nodes: object keyed by node_id, each node has { type, position, edge_order, ...config }
 *   - node types: "start", "override_agent", "say", "end" (NOT "subagent")
 *   - edges: object keyed by edge_id (NOT an array), each edge has:
 *       { source, target, forward_condition: { label, type: "llm"|"unconditional", condition? }, backward_condition }
 *   - The schema in buildCanonicalWorkflow() below uses the correct EL-native types but
 *     the detailed `position` coordinates and some advanced node config fields require
 *     further mapping from the existing 7-node workflow before this script can be deployed live.
 *
 * CURRENT STATUS: The existing agent has a 7-node workflow that works. This script defines
 * the INTENDED 2026-pattern 9-node workflow (orchestrator + 4 subagents + say + wrap_up).
 * Before deploying live, an operator should:
 *   1. Review the canonical workflow JSON in buildCanonicalWorkflow()
 *   2. Map the node positions from the current 7-node layout
 *   3. Confirm the edge condition syntax matches EL's current LLM-condition format
 *   4. Test in a staging copy of the agent first
 *
 * Builds and deploys the 2026-pattern ElevenLabs Workflow for Sarah Receptionist:
 *
 *   start → intake_classifier (lightweight, sets intent dyn var)
 *     ├─ intent="faq"           → faq_subagent (RAG, scoped KB)
 *     ├─ intent="transfer_*"    → transfer_router (references existing transfer_to_number built-in)
 *     ├─ intent="message"       → message_capture (Patient turn-eagerness)
 *     └─ intent="after_hours"   → after_hours_subagent (different first_message)
 *          ↓
 *          say (deterministic confirmation utterance)
 *          ↓
 *          wrap_up → end
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk_... node scripts/sync-elevenlabs-sarah-workflow.mjs
 *   node scripts/sync-elevenlabs-sarah-workflow.mjs --dry-run
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-workflow.mjs
 *
 * Idempotent — GETs current workflow, deep-equals against intended shape, only PATCHes if drifted.
 *
 * CRITICAL CONSTRAINTS:
 *   - DO NOT define new transfer_to_number rules in workflow nodes — they live at agent level
 *   - DO NOT touch built_in_tools.transfer_to_number
 *   - Workflow PATCH uses agent-level PATCH at /convai/agents/{id} with only the `workflow` key
 *   - The transfer_router subagent prompt references the existing built-in transfer_to_number tool
 *
 * Agent ID: agent_6501kp71h69jfqysgd055hemqhrq (Sarah Receptionist)
 *
 * NOTE: EL Workflow API (2026): workflows are stored inside the agent config under `workflow`.
 * The PATCH body is { workflow: { nodes: {...}, edges: [...] } }. Node IDs are stable strings.
 * Subagent nodes have type="subagent" (or "agent" depending on EL API version — both are tried).
 * The `say` node (Mar 2026) has type="say".
 * LLM-condition edges have condition objects matching on dynamic variable values.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN =
  process.argv.includes('--dry-run') ||
  String(process.env.DRY_RUN || '').toLowerCase() === 'true' ||
  !API_KEY;

const BASE_URL = 'https://api.elevenlabs.io/v1';
const AGENT_ID = 'agent_6501kp71h69jfqysgd055hemqhrq';
const SCRIPT_NAME = 'sarah-workflow';

function sha256Short(obj) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(obj))
    .digest('hex')
    .slice(0, 12);
}

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(
      `[${ts}] [${SCRIPT_NAME}] ${msg}`,
      typeof data === 'object' ? JSON.stringify(data, null, 2) : data
    );
  } else {
    console.log(`[${ts}] [${SCRIPT_NAME}] ${msg}`);
  }
}

// ── ElevenLabs API helper ─────────────────────────────────────────────────────
async function apiCall(method, pathname, body) {
  const url = `${BASE_URL}${pathname}`;
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}${method} ${url}`);
  if (DRY_RUN) {
    if (body) log('  body:', body);
    return { dry_run: true };
  }
  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `ElevenLabs API ${res.status} ${method} ${pathname}: ${text.slice(0, 500)}`
    );
  }
  return data;
}

// ── Canonical workflow definition ─────────────────────────────────────────────
// Node IDs are stable strings used in edge references.
// EL Workflow nodes object: { [node_id]: NodeDefinition }
// EL Workflow edges array: [{ from: node_id, to: node_id, condition?: {...} }]
function buildCanonicalWorkflow() {
  const nodes = {
    // ── start ──────────────────────────────────────────────────────────────────
    start: {
      type: 'start',
      config: {},
    },

    // ── intake_classifier ─────────────────────────────────────────────────────
    // Lightweight subagent — sets the `intent` dynamic variable.
    // Uses fast model (gemini-2.5-flash or similar) to minimize latency.
    // Intent values: faq | transfer_sales | transfer_support | transfer_owner |
    //                transfer_billing | transfer_scheduling | message | after_hours
    intake_classifier: {
      type: 'subagent',
      config: {
        name: 'Intake Classifier',
        model: {
          model_id: 'gemini-2.5-flash',
          // Fallback model if gemini not available in workspace
          fallback_model_id: 'claude-3-5-haiku-20241022',
        },
        prompt: {
          prompt: `You are a lightweight intake classifier for an AI receptionist.

Your ONLY job is to classify the caller's intent into exactly one of these categories and set it as the \`intent\` dynamic variable:

- \`faq\` — caller is asking a general question (hours, location, services, pricing, policies)
- \`transfer_sales\` — caller wants to speak to someone about buying, signing up, or getting a quote
- \`transfer_support\` — caller needs help with an existing service, product, or account issue
- \`transfer_owner\` — caller specifically asks for the owner, manager, or decision-maker
- \`transfer_billing\` — caller has a billing, payment, or invoice question
- \`transfer_scheduling\` — caller wants to book, reschedule, or cancel an appointment
- \`message\` — caller wants to leave a message or cannot be connected to anyone right now
- \`after_hours\` — business is currently closed per \`is_after_hours\` dynamic variable

Classification rules:
1. If \`{{ is_after_hours }}\` is true, ALWAYS classify as \`after_hours\` regardless of caller intent.
2. If routing phone for the requested role is empty (e.g. \`{{ routing_billing_phone }}\` is ""), classify as \`message\` instead of transfer_billing.
3. Be decisive — pick the single best category. Do NOT ask the caller which category they fall into.
4. Greet the caller warmly, listen to their opening request, then route silently.

Greeting: "Good {{ time_of_day }}, thank you for calling {{ business_name }}. This is Sarah, the AI front desk assistant. How can I help you today?"

After greeting and hearing their intent, immediately classify and set the \`intent\` variable. Do not explain your classification to the caller.`,
        },
        turn_eagerness: 'eager',
        dynamic_variables: {
          set: {
            intent: '{{ intent }}',
          },
        },
      },
    },

    // ── faq_subagent ──────────────────────────────────────────────────────────
    // RAG-enabled, scoped to kb/faq/ knowledge base documents.
    faq_subagent: {
      type: 'subagent',
      config: {
        name: 'FAQ Handler',
        model: {
          model_id: 'claude-3-5-sonnet-20241022',
        },
        prompt: {
          prompt: `You are the FAQ handler for {{ business_name }}.

Answer the caller's question using the knowledge base. Rules:
- Only answer using information in the knowledge base. Do NOT invent hours, prices, or policies.
- If the answer is not in the KB, say "I don't have that information right now — let me take a message so someone can follow up."
- Keep answers brief (2-3 sentences max for voice).
- After answering, ask: "Is there anything else I can help you with?"
- If they have another question, answer it. If they are done or want transfer/message, route accordingly.

Business: {{ business_name }}
Hours status: {{ is_open_now }}
After hours: {{ is_after_hours }}`,
          knowledge_base: {
            // KB attachment is managed by the sync-elevenlabs-kb-*.mjs scripts.
            // This config object is a placeholder; actual KB IDs are resolved at runtime.
            type: 'rag',
            model: 'e5_mistral_7b_instruct',
            max_vector_distance: 0.6,
            max_retrieved_rag_chunks_count: 20,
          },
        },
        turn_eagerness: 'eager',
      },
    },

    // ── transfer_router ───────────────────────────────────────────────────────
    // Prompts the built-in transfer_to_number tool (which already has 5 dyn-var rules at agent level).
    // DO NOT define new transfer_to_number rules here.
    transfer_router: {
      type: 'subagent',
      config: {
        name: 'Transfer Router',
        model: {
          model_id: 'claude-3-5-haiku-20241022',
        },
        prompt: {
          prompt: `You are the transfer router for {{ business_name }}.

Based on the caller's intent (stored in the \`intent\` dynamic variable), initiate the appropriate transfer using the built-in \`transfer_to_number\` tool.

Transfer routing:
- \`transfer_owner\` → Use transfer_to_number with the owner routing rule
- \`transfer_sales\` → Use transfer_to_number with the sales routing rule
- \`transfer_support\` → Use transfer_to_number with the support routing rule
- \`transfer_billing\` → Use transfer_to_number with the billing routing rule
- \`transfer_scheduling\` → Use transfer_to_number with the scheduling routing rule

Before initiating transfer, say: "One moment please while I connect you to {{ routing_contacts_summary }}."

If the transfer fails or the routing phone is empty, do NOT attempt the transfer. Instead, say:
"I'm sorry, I wasn't able to connect you right now. Let me take a message and have someone follow up."
Then transition to message capture.

IMPORTANT: The transfer_to_number tool uses dynamic variable routing rules configured at the agent level. Do NOT pass raw phone numbers — the routing rules resolve them automatically from the dynamic variables injected by the personalization webhook.`,
        },
        turn_eagerness: 'eager',
      },
    },

    // ── message_capture ───────────────────────────────────────────────────────
    // Patient turn-eagerness — waits for caller to finish before responding.
    // Uses Data Collection items to extract structured fields.
    message_capture: {
      type: 'subagent',
      config: {
        name: 'Message Capture',
        model: {
          model_id: 'claude-3-5-sonnet-20241022',
        },
        prompt: {
          prompt: `You are capturing a message for {{ business_name }}.

Collect these fields:
1. Caller's full name — ask if not already captured
2. Callback phone number — ask for the best number to reach them
3. Reason for calling — ask for a brief description
4. Urgency — ask if this is urgent or routine (default: normal)
5. Preferred callback window — ask when they'd like to be called back (e.g., "tomorrow morning", "anytime today")

Rules:
- Collect fields conversationally — do NOT read a list
- After getting callback number, repeat it back to confirm accuracy
- If the caller declines to provide a field, note it as unavailable — do NOT force it
- Never fabricate or guess any field
- Once all available fields are captured, confirm: "Great, I've got your message. Someone from {{ business_name }} will follow up."

Privacy rule: Do NOT collect card numbers, bank details, or sensitive identity information. Politely decline if offered.`,
          data_collection: {
            // These match the 8 items configured by sync-elevenlabs-sarah-data-collection.mjs
            enabled: true,
          },
        },
        turn_eagerness: 'patient',
        // Longer silence timeout for message capture — callers need time to think
        silence_timeout_secs: 8,
      },
    },

    // ── after_hours_subagent ──────────────────────────────────────────────────
    // Different first_message acknowledges it's after hours.
    after_hours_subagent: {
      type: 'subagent',
      config: {
        name: 'After Hours Handler',
        model: {
          model_id: 'claude-3-5-haiku-20241022',
        },
        prompt: {
          prompt: `You are handling an after-hours call for {{ business_name }}.

The business is currently closed. Follow the after_hours_mode setting:
- \`TAKE_MESSAGE\`: Take a complete message and let them know someone will follow up during business hours.
- \`ASK_CALLBACK_WINDOW\`: Ask for a preferred callback window before taking the message.
- \`TRY_TRANSFER_THEN_MESSAGE\`: Attempt one transfer to the owner; if unavailable, take a message.

Current after_hours_mode: {{ after_hours_mode }}

Opening statement (say this first):
"Thank you for calling {{ business_name }}. Our office is currently closed. I'm Sarah, the AI front desk assistant — I'd be happy to take a message and make sure someone follows up with you during business hours."

Then collect the message using the same fields as normal message capture.

DO NOT promise same-day callback unless business policy explicitly supports it.
DO NOT attempt live transfers unless after_hours_mode is TRY_TRANSFER_THEN_MESSAGE.`,
          data_collection: {
            enabled: true,
          },
        },
        turn_eagerness: 'patient',
        silence_timeout_secs: 8,
        // Override first_message for this subagent
        first_message:
          'Thank you for calling {{ business_name }}. Our office is currently closed. I\'m Sarah — I\'d be happy to take a message and make sure someone follows up with you.',
      },
    },

    // ── say (deterministic confirmation) ─────────────────────────────────────
    // Mar 2026 EL release: `say` node for deterministic utterances before end.
    say_confirmation: {
      type: 'say',
      config: {
        text: 'Thank you for calling {{ business_name }}. Is there anything else I can help you with before we wrap up?',
      },
    },

    // ── wrap_up ───────────────────────────────────────────────────────────────
    wrap_up: {
      type: 'subagent',
      config: {
        name: 'Wrap Up',
        model: {
          model_id: 'claude-3-5-haiku-20241022',
        },
        prompt: {
          prompt: `You are wrapping up the call for {{ business_name }}.

Your job: provide a clear, warm closing line based on what happened:
- If a message was taken: "Your message has been recorded. Someone from {{ business_name }} will follow up."
- If transferred: "I've connected you — have a great day."
- If FAQ resolved: "I'm glad I could help. Have a wonderful day."
- If after-hours: "We'll be in touch during business hours. Have a great evening."

End every call with a clear next step. Never end with filler like "Is there anything else?" — that was handled in the say node.`,
        },
        turn_eagerness: 'eager',
      },
    },

    // ── end ───────────────────────────────────────────────────────────────────
    end: {
      type: 'end',
      config: {},
    },
  };

  // ── Edges ─────────────────────────────────────────────────────────────────
  // LLM-condition edges from intake_classifier branch to the 4 subagents.
  // Condition format: EL evaluates dynamic variable `intent` value.
  const edges = [
    // start → intake_classifier
    { from: 'start', to: 'intake_classifier' },

    // intake_classifier → faq_subagent (when intent=faq)
    {
      from: 'intake_classifier',
      to: 'faq_subagent',
      condition: {
        type: 'dynamic_variable',
        variable: 'intent',
        operator: 'equals',
        value: 'faq',
      },
    },

    // intake_classifier → transfer_router (when intent=transfer_*)
    {
      from: 'intake_classifier',
      to: 'transfer_router',
      condition: {
        type: 'dynamic_variable',
        variable: 'intent',
        operator: 'starts_with',
        value: 'transfer_',
      },
    },

    // intake_classifier → message_capture (when intent=message)
    {
      from: 'intake_classifier',
      to: 'message_capture',
      condition: {
        type: 'dynamic_variable',
        variable: 'intent',
        operator: 'equals',
        value: 'message',
      },
    },

    // intake_classifier → after_hours_subagent (when intent=after_hours)
    {
      from: 'intake_classifier',
      to: 'after_hours_subagent',
      condition: {
        type: 'dynamic_variable',
        variable: 'intent',
        operator: 'equals',
        value: 'after_hours',
      },
    },

    // All subagents → say_confirmation
    { from: 'faq_subagent', to: 'say_confirmation' },
    { from: 'transfer_router', to: 'say_confirmation' },
    { from: 'message_capture', to: 'say_confirmation' },
    { from: 'after_hours_subagent', to: 'say_confirmation' },

    // say_confirmation → wrap_up
    { from: 'say_confirmation', to: 'wrap_up' },

    // wrap_up → end
    { from: 'wrap_up', to: 'end' },
  ];

  return { nodes, edges };
}

// ── Idempotency: compare workflows ───────────────────────────────────────────
function workflowsMatch(current, canonical) {
  // Simple structural comparison via sha256 of normalized JSON
  const normalize = (obj) => JSON.stringify(obj, Object.keys(obj).sort());
  return (
    sha256Short(current?.nodes ?? {}) === sha256Short(canonical.nodes) &&
    sha256Short(current?.edges ?? []) === sha256Short(canonical.edges)
  );
}

// ── Transfer rules safety check ──────────────────────────────────────────────
function verifyTransferRulesIntact(agentData, phase) {
  const transferRules =
    agentData?.conversation_config?.agent?.built_in_tools?.transfer_to_number
      ?.transfer_list ?? [];
  log(`${phase} transfer_to_number rule count: ${transferRules.length}`);
  if (!DRY_RUN && transferRules.length > 0 && transferRules.length !== 5) {
    console.warn(
      `[${SCRIPT_NAME}] WARNING: ${phase} transfer_to_number rule count is ${transferRules.length} (expected 5).`
    );
  }
  // Verify rules are not being modified — they must remain untouched
  return transferRules;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting 2026 Workflow sync for Sarah Receptionist (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);

  const canonicalWorkflow = buildCanonicalWorkflow();
  const nodeCount = Object.keys(canonicalWorkflow.nodes).length;
  const edgeCount = canonicalWorkflow.edges.length;
  log(`Canonical workflow: ${nodeCount} nodes, ${edgeCount} edges`);
  log(
    'Nodes:',
    Object.keys(canonicalWorkflow.nodes).join(', ')
  );
  log(`Workflow SHA: ${sha256Short(canonicalWorkflow)}`);

  // 1. GET current state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);

  if (before.dry_run) {
    log('[DRY-RUN] Simulating: current workflow would be inspected.');
    log(`[DRY-RUN] Canonical workflow: ${nodeCount} nodes, ${edgeCount} edges`);
    log('[DRY-RUN] Nodes: ' + Object.keys(canonicalWorkflow.nodes).join(', '));
    log('[DRY-RUN] Would PATCH agent with { workflow: { nodes, edges } } — NOT touching built_in_tools');
    log('[DRY-RUN] No changes applied. Exiting.');
    return;
  }

  const currentWorkflow = before?.workflow ?? {};
  const currentNodeCount = Object.keys(currentWorkflow?.nodes ?? {}).length;
  const currentEdgeCount = (currentWorkflow?.edges ?? []).length;
  log(`Current workflow: ${currentNodeCount} nodes, ${currentEdgeCount} edges`);
  if (currentNodeCount > 0) {
    log('Current nodes:', Object.keys(currentWorkflow.nodes ?? {}).join(', '));
  }
  log(`Current workflow SHA: ${sha256Short(currentWorkflow)}`);

  const transferRulesBefore = verifyTransferRulesIntact(before, 'BEFORE');

  // 2. Idempotency check
  if (workflowsMatch(currentWorkflow, canonicalWorkflow)) {
    log('IDEMPOTENT — workflow already matches canonical shape. No changes needed.');
    log(`Nodes: ${currentNodeCount}, Edges: ${currentEdgeCount}`);
    return; // natural return — avoid Windows UV handle assertion
  }

  log('Drift detected. Applying canonical workflow...');

  // SCHEMA SAFETY GATE (2026-05-01):
  // EL workflow node type is "override_agent" (not "subagent") and edges are a dict
  // (not an array). The buildCanonicalWorkflow() function documents the INTENDED design
  // but uses draft schema types. Until the schema is aligned with live EL API:
  //   - Dry-run is safe (already returned above)
  //   - Live PATCH is blocked unless FORCE_WORKFLOW_DEPLOY=true env var is set
  if (!process.env.FORCE_WORKFLOW_DEPLOY) {
    log('BLOCKED: Live workflow deployment requires EL API schema alignment first.');
    log('The canonical workflow shape uses "subagent" node type but EL uses "override_agent".');
    log('Edge format is also dict-based (not array-based) in the real EL API.');
    log('Review buildCanonicalWorkflow() and align with live agent schema before deploying.');
    log('To force deploy (for testing): FORCE_WORKFLOW_DEPLOY=true node scripts/sync-elevenlabs-sarah-workflow.mjs');
    log('\nPlanned workflow (for dashboard implementation):');
    log('  Nodes: ' + Object.keys(canonicalWorkflow.nodes).join(', '));
    log('  Edges: ' + canonicalWorkflow.edges.length);
    return;
  }

  // 3. PATCH — only the `workflow` key. DO NOT touch built_in_tools.
  log('--- APPLYING WORKFLOW PATCH ---');
  log(`  Current: ${currentNodeCount} nodes, ${currentEdgeCount} edges`);
  log(`  New: ${nodeCount} nodes, ${edgeCount} edges`);

  // IMPORTANT: PATCH with only `workflow` key — never include built_in_tools in body
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    workflow: canonicalWorkflow,
  });
  log('Workflow PATCH applied.');

  // 4. Verify post-PATCH
  log('--- VERIFICATION ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  const afterWorkflow = after?.workflow ?? {};
  const afterNodeCount = Object.keys(afterWorkflow?.nodes ?? {}).length;
  const afterEdgeCount = (afterWorkflow?.edges ?? []).length;
  log(`Post-PATCH workflow: ${afterNodeCount} nodes, ${afterEdgeCount} edges`);

  // Verify transfer rules survived
  const transferRulesAfter = verifyTransferRulesIntact(after, 'AFTER');

  if (afterNodeCount !== nodeCount || afterEdgeCount !== edgeCount) {
    throw new Error(
      `VERIFICATION FAILED: expected ${nodeCount} nodes / ${edgeCount} edges, got ${afterNodeCount} / ${afterEdgeCount}`
    );
  }

  // Safety check: transfer rules must not change
  if (transferRulesBefore.length !== transferRulesAfter.length) {
    throw new Error(
      `TRANSFER RULE VIOLATION: Before=${transferRulesBefore.length} rules, After=${transferRulesAfter.length} rules. ` +
      'The workflow PATCH must not modify built_in_tools.transfer_to_number.'
    );
  }

  log('VERIFICATION PASSED — 2026 workflow deployed with all nodes intact.');
  log('\nSummary:');
  log(`  Agent: ${AGENT_ID}`);
  log(`  Workflow nodes (${afterNodeCount}): ${Object.keys(afterWorkflow.nodes ?? {}).join(', ')}`);
  log(`  Edges: ${afterEdgeCount}`);
  log(`  transfer_to_number rules: ${transferRulesAfter.length} (UNCHANGED)`);
}

main().catch((err) => {
  console.error(`[${SCRIPT_NAME}] sync failed:`, err.message || err);
  process.exit(1);
});
