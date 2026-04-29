#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Eli sync. Pushes prompt + 5 KB docs + renamed tools to agent_4201kmqdjm1tfhfaggnnfjax3m6d.
/**
 * Sync Aspire - Eli ElevenLabs agent from canonical docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-eli.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-eli.mjs
 *   node scripts/sync-elevenlabs-eli.mjs --dry-run
 *
 * Key: tools renamed search→search_emails, create_draft→draft_email.
 * Gateway alias layer keeps legacy names live server-side.
 * KB: 5 docs per Aspire-Eli.json kb_paths.
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

const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Eli.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;
const AGENT_ID = sync.agent_id; // agent_4201kmqdjm1tfhfaggnnfjax3m6d

const systemPrompt = fs.readFileSync(path.join(ROOT, sync.prompt_path), 'utf-8').trim();

// Eli KB: 5 docs (indices 0-4 from kb_paths in config)
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
    console.log(`[${ts}] [eli] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [eli] ${msg}`);
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

// ── Eli's canonical tools (search→search_emails, create_draft→draft_email) ──
function buildEliTools() {
  const toolUrl = (p) => `${TOOL_BASE_URL}/${p.replace(/^\/+/, '')}`;
  const headers = { 'Content-Type': 'application/json', 'x-elevenlabs-secret': TOOL_SECRET };

  const webhookTool = (name, description, urlPath, schema, forcePreToolSpeech = false) => ({
    type: 'webhook',
    name,
    description,
    response_timeout_secs: 20,
    disable_interruptions: false,
    force_pre_tool_speech: forcePreToolSpeech,
    assignments: [],
    tool_call_sound_behavior: 'auto',
    tool_error_handling_mode: 'auto',
    dynamic_variables: { dynamicVariablePlaceholders: {} },
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
    // get_context — inbox state
    webhookTool('get_context', 'Get live inbox state: unread count, urgency picture, mailbox connectivity, recent activity. Call at session start.', 'context', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'What inbox context to retrieve', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // search_emails — RENAMED from "search"
    // Gateway keeps POST /v1/tools/search as alias → search_emails handler
    webhookTool('search_emails', 'Search the mailbox by sender, subject, keyword, or thread. Returns thread context for safe spoken summaries.', 'search_emails', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'Search query (sender name, subject, keyword, or topic)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        search_type: { type: 'string', enum: ['sender', 'subject', 'keyword', 'thread'], description: 'Optional search type hint', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        limit: { type: 'number', description: 'Max results (default 10)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // draft_email — RENAMED from "create_draft"
    // Gateway keeps POST /v1/tools/create_draft as alias → draft_email handler
    webhookTool('draft_email', 'Create an email draft for owner review. Includes reply, new message, forward. ALWAYS read back and confirm before calling request_approval.', 'draft_email', {
      type: 'object', required: ['suite_id', 'to', 'subject'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        to: { type: 'string', description: 'Recipient name or email address', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        cc: { type: 'string', description: 'CC recipients (optional)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        subject: { type: 'string', description: 'Email subject line', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        body: { type: 'string', description: 'Email body content', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        thread_id: { type: 'string', description: 'Optional thread_id for replies', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        draft_type: { type: 'string', enum: ['reply', 'new', 'forward'], description: 'Draft category', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }, true),
    // request_approval
    webhookTool('request_approval', 'Submit confirmed email draft for approval and sending. Only call AFTER owner reviews and confirms.', 'approve', {
      type: 'object', required: ['suite_id', 'draft_id', 'action'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        draft_id: { type: 'string', description: 'draft_id from draft_email', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type e.g. send_email', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // execute_action
    webhookTool('execute_action', 'Execute approved email action using capability_token from request_approval. Only after token received.', 'execute', {
      type: 'object', required: ['suite_id', 'capability_token', 'action', 'params'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        capability_token: { type: 'string', description: 'Token from request_approval', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        params: { type: 'object', required: [], description: 'Action parameters', properties: {} },
      },
    }),
  ];
}

async function main() {
  log(`Starting sync for Aspire - Eli (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs (${kbDocs.length}): ${kbDocs.map((d) => d.name).join(', ')}`);
  log(`First message: "${sync.first_message}"`);

  const tools = buildEliTools();
  log(`Tools: ${tools.length} — ${tools.map((t) => t.name).join(', ')}`);
  log('NOTE: search_emails and draft_email are canonical names. Gateway aliases search/create_draft → canonical handlers.');

  // Before state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    log(`Before prompt SHA: ${sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`Before tool count: ${(before?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`Before tool names: ${(before?.conversation_config?.agent?.prompt?.tools || []).map((t) => t.name).join(', ')}`);
    log(`Before KB count: ${(before?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  // Push prompt + first_message
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
    await apiCall('POST', `/convai/agents/${AGENT_ID}/knowledge-base`, { name: doc.name, content: doc.content });
    log(`KB pushed: ${doc.name}`);
  }

  // Push tools (canonical names — search_emails + draft_email)
  log('--- PUSHING TOOLS ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: { agent: { prompt: { tools } } },
  });
  log(`${tools.length} tools pushed (canonical names: search_emails, draft_email).`);

  // After state
  log('--- AFTER STATE ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!after.dry_run) {
    log(`After prompt SHA: ${sha256(after?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`After tool count: ${(after?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`After tool names: ${(after?.conversation_config?.agent?.prompt?.tools || []).map((t) => t.name).join(', ')}`);
    log(`After KB count: ${(after?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  if (!DRY_RUN) {
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Eli.json'), 'utf-8'));
    updated._v1_sync.last_synced_at = new Date().toISOString();
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Eli.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Eli.json with last_synced_at.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} tools=${tools.length} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[eli] sync failed:', err.message || err);
  process.exit(1);
});
