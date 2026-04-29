#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Front Desk Sarah sync. agent_8901kmqdjnrte7psp6en4f85m4kt.
/**
 * Sync Aspire - Sarah Front Desk ElevenLabs agent from canonical docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-sarah-frontdesk.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-sarah-frontdesk.mjs
 *   node scripts/sync-elevenlabs-sarah-frontdesk.mjs --dry-run
 *
 * Agent ID: agent_8901kmqdjnrte7psp6en4f85m4kt (resolved via list_agents 2026-04-28)
 * Role: Internal owner-facing call-desk agent. Handles missed calls, voicemails,
 *       texts, callback queue, and escalation to Ava.
 * NO ElevenLabs Workflow — the custom workflow spec in the handoff is internal
 * call-desk doctrine only, not an ElevenLabs Workflow tab configuration.
 * KB: 5 docs (05-09 from docs/agents/sarah-frontdesk/)
 * Idempotent. Dry-run default if no API key.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { normalizeTools } from './_lib/elevenlabs-tool-normalize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true' || !API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';
const TOOL_BASE_URL = (process.env.ASPIRE_TOOL_BASE_URL || 'https://www.aspireos.app/v1/tools').replace(/\/+$/, '');
const TOOL_SECRET = process.env.ELEVENLABS_TOOL_SECRET || process.env.XI_TOOL_SECRET || '67a31a3b169095c75b000239c6e7878511f7ed5092a824b2eeadeec7447a9fe6';

const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-FrontDesk.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;

// Confirmed agent_id from list_agents 2026-04-28
const AGENT_ID = 'agent_8901kmqdjnrte7psp6en4f85m4kt';

const systemPrompt = fs.readFileSync(path.join(ROOT, sync.prompt_path), 'utf-8').trim();
const kbDocs = sync.kb_paths.map((p) => ({
  name: path.basename(p, '.md'),
  content: fs.readFileSync(path.join(ROOT, p), 'utf-8').trim(),
}));

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [sarah-frontdesk] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [sarah-frontdesk] ${msg}`);
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

// ── Front Desk Sarah canonical tools ─────────────────────────────────────────
// Per 10_FRONT_DESK_SARAH_TOOLS_CONTRACT_v1.md:
// get_context, search_memory, get_thread_memory, create_handoff_note,
// triage_callback_queue, escalate_to_owner
function buildFrontDeskTools() {
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
    // 1. get_context — call desk overview
    wh('get_context', 'Get current call desk state: missed call count, urgent count, voicemail count, text thread count, and pending callback queue. Call at session start.', 'context', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'What call desk context to retrieve', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 2. search_memory — office memory search
    wh('search_memory', 'Search office memory for caller history, prior call notes, or contact context before briefing the owner.', 'memory/search', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        query: { type: 'string', description: 'Search query (caller name, phone, topic, or date)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        memory_types: { type: 'array', items: { type: 'string', description: 'item' }, description: 'Optional filter: call, note, message, thread' },
        limit: { type: 'number', description: 'Max results (default 10)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 3. get_thread_memory — specific thread detail
    wh('get_thread_memory', 'Get full memory timeline for a specific caller or call thread.', 'memory/thread', {
      type: 'object', required: ['suite_id', 'thread_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        thread_id: { type: 'string', description: 'Thread ID from search_memory results', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 4. create_handoff_note — voice→owner handoff
    wh('create_handoff_note', 'Create a call desk handoff note for the owner. Captures what happened, who called, urgency, and recommended next action.', 'office-note', {
      type: 'object', required: ['suite_id', 'summary', 'note_type'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        note_type: { type: 'string', enum: ['missed_call', 'voicemail', 'text_thread', 'callback_request', 'handoff'], description: 'Type of call desk note', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        summary: { type: 'string', description: 'Note content for owner review', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_name: { type: 'string', description: 'Caller name if available', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        caller_phone: { type: 'string', description: 'Caller phone if available', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        urgency: { type: 'string', enum: ['normal', 'urgent', 'emergency'], description: 'Urgency level', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        next_step: { type: 'string', description: 'Recommended next action for owner', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 5. triage_callback_queue — internal only
    wh('triage_callback_queue', 'Get and sort the pending callback queue by urgency, age, and time window preference. Use to brief the owner on who to call back first.', 'sarah/callback-queue', {
      type: 'object', required: ['suite_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        filter_urgency: { type: 'string', enum: ['all', 'urgent', 'normal'], description: 'Urgency filter', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        limit: { type: 'number', description: 'Max callbacks to return (default 10)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 6. escalate_to_owner — creates proactive_candidate(owner_agent='ava')
    wh('escalate_to_owner', 'Escalate an urgent item to owner via Ava by creating a proactive candidate. Use for emergencies, high-urgency callbacks, or time-sensitive decisions.', 'proactive-candidates', {
      type: 'object', required: ['suite_id', 'summary', 'why_now', 'risk_tier'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        summary: { type: 'string', description: 'What needs owner attention', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        why_now: { type: 'string', description: 'Why this is urgent now', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        risk_tier: { type: 'string', enum: ['GREEN', 'YELLOW', 'RED'], description: 'Risk tier per Aspire governance', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        owner_agent: { type: 'string', enum: ['ava'], description: 'Always ava for escalation', is_system_provided: false, dynamic_variable: '', constant_value: 'ava' },
        caller_name: { type: 'string', description: 'Caller or entity triggering escalation', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }, true),
  ];
}

async function main() {
  log(`Starting sync for Aspire - Sarah Front Desk (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs (${kbDocs.length}): ${kbDocs.map((d) => d.name).join(', ')}`);
  log(`First message: "${sync.first_message}"`);
  log('No ElevenLabs Workflow — internal call-desk agent only.');

  const tools = buildFrontDeskTools();
  log(`Tools: ${tools.length} — ${tools.map((t) => t.name).join(', ')}`);

  // Before state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    log(`Before prompt SHA: ${sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`Before tool count: ${(before?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`Before KB count: ${(before?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  // Push prompt + first_message + dynamic_variables
  log('--- PUSHING PROMPT ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: {
      agent: {
        prompt: { prompt: systemPrompt },
        first_message: sync.first_message,
        dynamic_variables: {
          dynamic_variable_placeholders: Object.fromEntries(
            sync.dynamic_variables.map((v) => {
              const defaults = {
                business_name: 'Your Business',
                first_name: 'Owner',
                last_name: '',
                salutation: 'Mr.',
                industry: 'General',
                missed_call_count: '0',
                urgent_count: '0',
                voicemail_count: '0',
                text_thread_count: '0',
              };
              return [v, defaults[v] || v];
            })
          ),
        },
      },
    },
  });
  log('Prompt pushed.');

  // Push KB docs
  log('--- PUSHING KB DOCS ---');
  for (const doc of kbDocs) {
    log(`Pushing KB: ${doc.name} (${doc.content.length} chars, SHA: ${sha256(doc.content)})`);
    try {
      await apiCall('POST', `/convai/agents/${AGENT_ID}/knowledge-base`, { name: doc.name, content: doc.content });
      log(`KB pushed: ${doc.name}`);
    } catch (e) {
      log(`KB endpoint not available (skipping ${doc.name}). Use mcp__elevenlabs__add_knowledge_base_to_agent. Reason: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  // Push tools
  log('--- PUSHING TOOLS ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: { agent: { prompt: { tools: normalizeTools(JSON.parse(JSON.stringify(tools))) } } },
  });
  log(`${tools.length} tools pushed.`);

  // After state
  log('--- AFTER STATE ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!after.dry_run) {
    log(`After prompt SHA: ${sha256(after?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`After tool count: ${(after?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`After KB count: ${(after?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  if (!DRY_RUN) {
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-FrontDesk.json'), 'utf-8'));
    updated._v1_sync.agent_id = AGENT_ID;
    updated._v1_sync.last_synced_at = new Date().toISOString();
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Sarah-FrontDesk.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Sarah-FrontDesk.json with confirmed agent_id and last_synced_at.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} tools=${tools.length} kb=${kbDocs.length} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[sarah-frontdesk] sync failed:', err.message || err);
  process.exit(1);
});
