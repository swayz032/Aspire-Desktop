#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Receptionist Sarah sync. agent_6501kp71h69jfqysgd055hemqhrq.
/**
 * Sync Aspire Sarah - Receptionist ElevenLabs agent from canonical v2 docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-sarah-receptionist.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-receptionist.mjs
 *   node scripts/sync-elevenlabs-sarah-receptionist.mjs --dry-run
 *
 * CRITICAL CONSTRAINT: DO NOT modify the ElevenLabs Workflow node graph.
 * The 5-node Workflow (Start → Greeting & Identify Intent → Answer FAQ /
 * Transfer Call / Take Message → Wrap Up → End) must remain intact.
 * This script ONLY updates: per-node prompt text, KB attachments, and tool
 * definitions. It never touches workflow.nodes count or workflow.edges.
 *
 * Agent ID: agent_6501kp71h69jfqysgd055hemqhrq (Receptionist, Twilio-connected)
 * KB: 6 docs (01_RECEPTIONIST_SARAH_SYSTEM_PROMPT_v2 used as prompt, 02-06 as KB)
 * Personalization webhook: /v1/sarah/personalization keyed off called_number
 * Idempotent. Dry-run default if no API key.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true' || !API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';
const TOOL_BASE_URL = (process.env.ASPIRE_TOOL_BASE_URL || 'https://www.aspireos.app/v1/tools').replace(/\/+$/, '');
const TOOL_SECRET = process.env.ELEVENLABS_TOOL_SECRET || process.env.XI_TOOL_SECRET || '67a31a3b169095c75b000239c6e7878511f7ed5092a824b2eeadeec7447a9fe6';

const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-Receptionist.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;

// Active production agent for Receptionist is agent_6501 (confirmed via list_agents 2026-04-28)
const AGENT_ID = 'agent_6501kp71h69jfqysgd055hemqhrq';

const systemPrompt = fs.readFileSync(path.join(ROOT, sync.prompt_path), 'utf-8').trim();
const kbDocs = sync.kb_paths.map((p) => ({
  name: path.basename(p, '.md'),
  content: fs.readFileSync(path.join(ROOT, p), 'utf-8').trim(),
}));

// Expected workflow node count — ABORT if mismatch
const EXPECTED_WORKFLOW_NODE_COUNT = 5;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [sarah-receptionist] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [sarah-receptionist] ${msg}`);
  }
}

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
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`ElevenLabs API ${res.status} ${method} ${pathname}: ${text.slice(0, 500)}`);
  return data;
}

// ── Workflow safety check ────────────────────────────────────────────────────
function verifyWorkflowIntact(agentData, phase) {
  const nodes = agentData?.workflow?.nodes || {};
  const nodeCount = Object.keys(nodes).length;
  log(`${phase} workflow node count: ${nodeCount}`);
  if (!DRY_RUN && nodeCount !== EXPECTED_WORKFLOW_NODE_COUNT) {
    const msg = `ABORT: ${phase} workflow node count ${nodeCount} != expected ${EXPECTED_WORKFLOW_NODE_COUNT}. Workflow integrity compromised.`;
    console.error(`[sarah-receptionist] ${msg}`);
    throw new Error(msg);
  }
  if (DRY_RUN) {
    log(`[DRY-RUN] Would verify workflow node count == ${EXPECTED_WORKFLOW_NODE_COUNT}`);
  }
}

// ── Sarah Receptionist canonical tools ───────────────────────────────────────
// Per 08_RECEPTIONIST_SARAH_TOOLS_CONTRACT_v2.md
function buildReceptionistTools() {
  const toolUrl = (p) => `${TOOL_BASE_URL}/${p.replace(/^\/+/, '')}`;
  const headers = { 'Content-Type': 'application/json', 'x-elevenlabs-secret': TOOL_SECRET };
  const dynVars = { dynamicVariablePlaceholders: {} };

  const wh = (name, description, urlPath, schema, forcePreToolSpeech = false) => ({
    type: 'webhook',
    name,
    description,
    response_timeout_secs: 20,
    disable_interruptions: false,
    force_pre_tool_speech: forcePreToolSpeech,
    assignments: [],
    tool_call_sound_behavior: 'auto',
    tool_error_handling_mode: 'auto',
    dynamic_variables: dynVars,
    execution_mode: 'immediate',
    api_schema: {
      request_headers: headers,
      url: toolUrl(urlPath),
      method: 'POST',
      path_params_schema: {},
      request_body_schema: schema,
      content_type: 'application/json',
    },
  });

  return [
    // 1. get_business_context — per-call personalization hook
    wh('get_business_context', 'Get business configuration for this call: business hours, greeting name, routing contacts, busy mode, after-hours mode. Call at session start.', 'sarah/personalization', {
      type: 'object', required: ['called_number'], properties: {
        called_number: { type: 'string', description: 'The Twilio number that was called (E.164 format)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_number: { type: 'string', description: 'The inbound caller phone number if available', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 2. capture_message
    wh('capture_message', 'Record a caller message with contact details. Use when caller wants to leave a message or after-hours intake.', 'sarah/capture-message', {
      type: 'object', required: ['caller_name', 'message'], properties: {
        caller_name: { type: 'string', description: 'Caller full name as provided', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_phone: { type: 'string', description: 'Caller phone number', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        message: { type: 'string', description: 'Message content the caller wants to leave', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        urgency: { type: 'string', enum: ['normal', 'urgent', 'emergency'], description: 'Caller-stated urgency', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        reason_category: { type: 'string', description: 'Call reason category (appointment, billing, support, general)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        called_number: { type: 'string', description: 'The Twilio number that was called', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 3. transfer_to_number — resolved server-side
    wh('transfer_to_number', 'Transfer call to the appropriate team member. Server resolves the destination number from routing contacts — do NOT pass a raw phone number. Pass role only.', 'sarah/transfer', {
      type: 'object', required: ['transfer_role'], properties: {
        transfer_role: { type: 'string', enum: ['owner', 'sales', 'support', 'custom'], description: 'Role to transfer to (server resolves phone number)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_name: { type: 'string', description: 'Caller name for warm transfer announcement', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        reason: { type: 'string', description: 'Transfer reason context', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        called_number: { type: 'string', description: 'The Twilio number that was called', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }, true),
    // 4. get_faq_answer
    wh('get_faq_answer', 'Look up FAQ answers for common caller questions: business hours, services, location, pricing. Use before admitting lack of knowledge.', 'sarah/faq', {
      type: 'object', required: ['question'], properties: {
        question: { type: 'string', description: 'The caller question to answer', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        called_number: { type: 'string', description: 'The Twilio number that was called (for business scoping)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 5. request_callback_window
    wh('request_callback_window', 'Record a callback request with preferred time window. Use when after-hours or busy mode is "Ask for callback window".', 'sarah/callback-request', {
      type: 'object', required: ['caller_name', 'preferred_window'], properties: {
        caller_name: { type: 'string', description: 'Caller full name', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_phone: { type: 'string', description: 'Caller phone number', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        preferred_window: { type: 'string', description: 'Caller preferred callback window e.g. "tomorrow morning" or "2pm-4pm"', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        reason: { type: 'string', description: 'Reason for callback', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        called_number: { type: 'string', description: 'The Twilio number that was called', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 6. save_call_summary
    wh('save_call_summary', 'Save a call summary and outcome to office memory at call end. Use in wrap-up phase.', 'sarah/call-summary', {
      type: 'object', required: ['outcome', 'summary'], properties: {
        outcome: { type: 'string', enum: ['message_taken', 'transferred', 'faq_resolved', 'callback_scheduled', 'abandoned'], description: 'Call outcome', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        summary: { type: 'string', description: 'Brief call summary for office record', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_name: { type: 'string', description: 'Caller name if captured', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_phone: { type: 'string', description: 'Caller phone if captured', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        called_number: { type: 'string', description: 'The Twilio number that was called', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
  ];
}

async function main() {
  log(`Starting sync for Aspire Sarah - Receptionist (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log('WORKFLOW CONSTRAINT: Will verify 5-node workflow intact before and after push.');
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs (${kbDocs.length}): ${kbDocs.map((d) => d.name).join(', ')}`);

  const tools = buildReceptionistTools();
  log(`Tools: ${tools.length} — ${tools.map((t) => t.name).join(', ')}`);

  // Before state + workflow check
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    log(`Before prompt SHA: ${sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`Before tool count: ${(before?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`Before KB count: ${(before?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
    verifyWorkflowIntact(before, 'BEFORE');
    log('Workflow integrity check PASSED. Proceeding with prompt/KB/tool update only.');
  }

  // Push prompt + dynamic_variables
  // IMPORTANT: payload does NOT include workflow key — PATCH merges, so workflow is preserved
  log('--- PUSHING PROMPT ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: {
      agent: {
        prompt: { prompt: systemPrompt },
        first_message: sync.first_message,
        dynamic_variables: {
          dynamic_variable_placeholders: Object.fromEntries(
            sync.dynamic_variables.map((v) => [v, v === 'business_name' ? 'Your Business' : v])
          ),
        },
      },
    },
  });
  log('Prompt pushed (workflow not touched).');

  // Push KB docs
  log('--- PUSHING KB DOCS ---');
  for (const doc of kbDocs) {
    log(`Pushing KB: ${doc.name} (${doc.content.length} chars, SHA: ${sha256(doc.content)})`);
    await apiCall('POST', `/convai/agents/${AGENT_ID}/knowledge-base`, { name: doc.name, content: doc.content });
    log(`KB pushed: ${doc.name}`);
  }

  // Push tools (only the tools array inside prompt — workflow untouched)
  log('--- PUSHING TOOLS ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: { agent: { prompt: { tools } } },
  });
  log(`${tools.length} tools pushed.`);

  // After state + workflow verification
  log('--- AFTER STATE ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!after.dry_run) {
    log(`After prompt SHA: ${sha256(after?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`After tool count: ${(after?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`After KB count: ${(after?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
    verifyWorkflowIntact(after, 'AFTER');
    log('Workflow integrity check PASSED. 5-node workflow still intact.');
  }

  if (!DRY_RUN) {
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-Receptionist.json'), 'utf-8'));
    updated._v1_sync.last_synced_at = new Date().toISOString();
    // Persist the confirmed active agent_id
    updated._v1_sync.agent_id = AGENT_ID;
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-Receptionist.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Sarah-Receptionist.json with last_synced_at and confirmed agent_id.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} tools=${tools.length} kb=${kbDocs.length} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[sarah-receptionist] sync failed:', err.message || err);
  process.exit(1);
});
