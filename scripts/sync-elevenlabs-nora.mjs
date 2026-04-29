#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Nora sync. Pushes prompt + 9 KB docs + 10 tools to agent_1901kmqdjmwmfqg9rqr5jngfydnw.
/**
 * Sync Aspire - Nora ElevenLabs agent from canonical docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-nora.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-nora.mjs
 *   node scripts/sync-elevenlabs-nora.mjs --dry-run
 *
 * KB docs: 9 (indices 3-11 from docs/agents/nora/, per Aspire-Nora.json kb_paths)
 * Tools: invocation tools (Adam/Quinn/Clara/Tec) + memory tools + core tools
 * NOTE: any payroll/Milo references in old config replaced with Finn routing
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

const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Nora.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;
const AGENT_ID = sync.agent_id; // agent_1901kmqdjmwmfqg9rqr5jngfydnw

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
    console.log(`[${ts}] [nora] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [nora] ${msg}`);
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

// ── Nora canonical tools ──────────────────────────────────────────────────────
// Per 13_NORA_TOOLS_CONTRACT_v1.md: get_context, search, create_draft,
// request_approval, execute_action, invoke_adam, invoke_quinn, invoke_clara,
// invoke_tec, post_office_message, save_office_memory
// NOTE: Milo/payroll removed. Finance delegation routes to Finn (via Ava transfer).
function buildNoraTools() {
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
    // 1. get_context
    wh('get_context', 'Get calendar state, meeting readiness, recording mode, participant context, recap context, and Office Memory context for current session.', 'context', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'What meeting context to retrieve', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        meeting_purpose: { type: 'string', dynamic_variable: 'meeting_purpose' },
      },
    }),
    // 2. search
    wh('search', 'Search meeting history, prior notes, participant records, agenda context, prior recap packets, inbox items, and memory entries.', 'search', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        query: { type: 'string', description: 'Meeting search query', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        domain: { type: 'string', enum: ['meetings', 'calendar', 'contacts', 'memory', 'inbox'], description: 'Search domain', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 3. create_draft
    wh('create_draft', 'Create meeting, invite, agenda, recap packet, or office memory summary draft for review. ALWAYS confirm before requesting approval.', 'draft', {
      type: 'object', required: ['suite_id', 'draft_type'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        draft_type: { type: 'string', enum: ['meeting', 'invite', 'agenda', 'recap_packet', 'office_summary', 'participant_summary'], description: 'Type of draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        title: { type: 'string', description: 'Draft title', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        body: { type: 'string', description: 'Draft content', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        participants: { type: 'array', items: { type: 'string', description: 'item' }, description: 'Participant names or emails' },
        start_time: { type: 'string', description: 'ISO datetime for meeting draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        duration_minutes: { type: 'number', description: 'Duration in minutes', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }, true),
    // 4. request_approval
    wh('request_approval', 'Submit confirmed meeting or recap draft for approval. Only call after owner confirms. Required for booking finalization, invite sending, recap release.', 'approve', {
      type: 'object', required: ['suite_id', 'draft_id', 'action'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        draft_id: { type: 'string', description: 'draft_id from create_draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type e.g. book_meeting, send_invite, release_recap', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 5. execute_action
    wh('execute_action', 'Execute approved meeting action using capability_token from request_approval. Only after token received.', 'execute', {
      type: 'object', required: ['suite_id', 'capability_token', 'action', 'params'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        capability_token: { type: 'string', description: 'Token from request_approval', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        params: { type: 'object', required: [], description: 'Action parameters', properties: {} },
      },
    }),
    // 6. invoke_adam
    wh('invoke_adam', 'Delegate research and briefing support to Adam. Use for pre-meeting company research, participant background, or market data.', 'invoke', {
      type: 'object', required: ['suite_id', 'agent', 'task'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        agent: { type: 'string', enum: ['adam'], description: 'Must be adam', is_system_provided: false, dynamic_variable: '', constant_value: 'adam' },
        task: { type: 'string', description: 'Research task with context', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        query: { type: 'string', description: 'Specific search term or entity', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }, true),
    // 7. invoke_quinn
    wh('invoke_quinn', 'Delegate invoice or quote follow-up to Quinn. Only for billing/payment questions surfaced during meetings.', 'invoke', {
      type: 'object', required: ['suite_id', 'agent', 'task'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        agent: { type: 'string', enum: ['quinn'], description: 'Must be quinn', is_system_provided: false, dynamic_variable: '', constant_value: 'quinn' },
        task: { type: 'string', description: 'Invoice or quote task', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        details: { type: 'string', description: 'Additional context', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 8. invoke_clara
    wh('invoke_clara', 'Delegate contract and signature follow-up to Clara.', 'invoke', {
      type: 'object', required: ['suite_id', 'agent', 'task'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        agent: { type: 'string', enum: ['clara'], description: 'Must be clara', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        task: { type: 'string', description: 'Contract or legal task', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        details: { type: 'string', description: 'Additional specifics', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 9. invoke_tec
    wh('invoke_tec', 'Delegate recap PDF, meeting memo, or follow-up document generation to Tec.', 'invoke', {
      type: 'object', required: ['suite_id', 'agent', 'task'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        agent: { type: 'string', enum: ['tec'], description: 'Must be tec', is_system_provided: false, dynamic_variable: '', constant_value: 'tec' },
        task: { type: 'string', description: 'Document task', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        details: { type: 'string', description: 'Additional context', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 10. post_office_message
    wh('post_office_message', 'Post a message to the Office Inbox for team awareness. Use for meeting outcomes, action items, or time-sensitive notes.', 'office-message', {
      type: 'object', required: ['suite_id', 'message'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        message: { type: 'string', description: 'Message body', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        message_type: { type: 'string', enum: ['meeting_outcome', 'action_item', 'alert', 'note'], description: 'Message category', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        related_thread_id: { type: 'string', description: 'Optional meeting thread_id', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 11. save_office_memory
    wh('save_office_memory', 'Promote a meeting insight, decision, or outcome to durable Office Memory. Only for significant items worth persisting across sessions.', 'memory/write', {
      type: 'object', required: ['suite_id', 'memory_type', 'summary'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        memory_type: { type: 'string', enum: ['meeting_recap', 'key_decision', 'action_item', 'participant_note', 'follow_up'], description: 'Memory category', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        summary: { type: 'string', description: 'The insight or decision to persist', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        visibility_scope: { type: 'string', enum: ['office'], description: 'Always office for Nora', is_system_provided: false, dynamic_variable: '', constant_value: 'office' },
        participants: { type: 'array', items: { type: 'string', description: 'item' }, description: 'Meeting participants' },
      },
    }),
  ];
}

async function main() {
  log(`Starting sync for Aspire - Nora (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs (${kbDocs.length}): ${kbDocs.map((d) => d.name).join(', ')}`);
  log(`First message: "${sync.first_message}"`);

  const tools = buildNoraTools();
  log(`Tools: ${tools.length} — ${tools.map((t) => t.name).join(', ')}`);
  log('NOTE: Milo/payroll references removed. Finance delegation routes to Finn via Ava transfer.');

  // Before state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    log(`Before prompt SHA: ${sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`Before tool count: ${(before?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`Before KB count: ${(before?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  // Push prompt
  log('--- PUSHING PROMPT ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: {
      agent: {
        prompt: { prompt: systemPrompt },
        first_message: sync.first_message,
        dynamic_variables: {
          dynamic_variable_placeholders: Object.fromEntries(
            Object.entries(config.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {})
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
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Nora.json'), 'utf-8'));
    updated._v1_sync.last_synced_at = new Date().toISOString();
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Nora.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Nora.json with last_synced_at.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} tools=${tools.length} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[nora] sync failed:', err.message || err);
  process.exit(1);
});
