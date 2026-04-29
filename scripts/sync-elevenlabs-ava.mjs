#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Ava sync. Pushes canonical prompt + KB + tools to agent_1201kmqdjgxvfxxteedpkvjej7er.
/**
 * Sync Aspire - Ava ElevenLabs agent from canonical docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-ava.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-ava.mjs
 *   node scripts/sync-elevenlabs-ava.mjs --dry-run
 *
 * Reads:
 *   docs/agents/ava/01_AVA_SYSTEM_PROMPT.md      — system prompt
 *   docs/agents/ava/03_AVA_KB_OFFICE_BRIEF.md    — KB doc 1
 *   docs/agents/ava/04_AVA_KB_HANDOFF_PROTOCOL.md — KB doc 2
 *   agent_configs/Aspire-Ava.json               — agent_id, dynamic_variables, first_message
 *
 * Idempotent: re-running without changes produces identical PUT body (SHA-stable).
 * Dry-run: set DRY_RUN=true or pass --dry-run. Default if ELEVENLABS_API_KEY is unset.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true' || !API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';
const TOOL_BASE_URL = (process.env.ASPIRE_TOOL_BASE_URL || 'https://www.aspireos.app/v1/tools').replace(/\/+$/, '');
const TOOL_SECRET = process.env.ELEVENLABS_TOOL_SECRET || process.env.XI_TOOL_SECRET || '67a31a3b169095c75b000239c6e7878511f7ed5092a824b2eeadeec7447a9fe6';

// ── Load canonical sources ───────────────────────────────────────────────────
const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Ava.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;
const AGENT_ID = sync.agent_id; // agent_1201kmqdjgxvfxxteedpkvjej7er

const systemPrompt = fs.readFileSync(path.join(ROOT, sync.prompt_path), 'utf-8').trim();
const kbDocs = sync.kb_paths.map((p) => ({
  name: path.basename(p, '.md'),
  content: fs.readFileSync(path.join(ROOT, p), 'utf-8').trim(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [ava] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [ava] ${msg}`);
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
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`ElevenLabs API ${res.status} ${method} ${pathname}: ${text.slice(0, 500)}`);
  }
  return data;
}

// ── Build ElevenLabs agent update payload ────────────────────────────────────
// We use PATCH-style: only include fields we own. ElevenLabs PATCH /v1/convai/agents/:id
// merges at top level so unspecified fields are preserved.
function buildPromptPayload() {
  return {
    conversation_config: {
      agent: {
        prompt: {
          prompt: systemPrompt,
        },
        first_message: sync.first_message,
        dynamic_variables: {
          dynamic_variable_placeholders: Object.fromEntries(
            (config.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders
              ? Object.entries(config.conversation_config.agent.dynamic_variables.dynamic_variable_placeholders)
              : [])
          ),
        },
      },
    },
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log(`Starting sync for Aspire - Ava (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs: ${kbDocs.map((d) => d.name).join(', ')}`);
  log(`Dynamic vars: ${sync.dynamic_variables.join(', ')}`);
  log(`First message: ${sync.first_message}`);

  // ── Before state ──────────────────────────────────────────────────────────
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    const beforePromptSha = sha256(before?.conversation_config?.agent?.prompt?.prompt || '');
    const beforeToolCount = (before?.conversation_config?.agent?.prompt?.tools || []).length;
    const beforeKbCount = (before?.conversation_config?.agent?.prompt?.knowledge_base || []).length;
    log(`Before prompt SHA: ${beforePromptSha}`);
    log(`Before tool count: ${beforeToolCount}`);
    log(`Before KB count: ${beforeKbCount}`);
  }

  // ── Push prompt + first_message + dynamic_variables ───────────────────────
  log('--- PUSHING PROMPT ---');
  const promptPayload = buildPromptPayload();
  log(`Prompt length: ${systemPrompt.length} chars`);
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, promptPayload);
  log('Prompt pushed.');

  // ── Push KB docs ──────────────────────────────────────────────────────────
  log('--- PUSHING KB DOCS ---');
  for (const doc of kbDocs) {
    log(`Pushing KB doc: ${doc.name} (${doc.content.length} chars, SHA: ${sha256(doc.content)})`);
    try {
      await apiCall('POST', `/convai/agents/${AGENT_ID}/knowledge-base`, {
        name: doc.name,
        content: doc.content,
      });
      log(`KB doc pushed: ${doc.name}`);
    } catch (e) {
      log(`KB endpoint not available (skipping ${doc.name}). Use mcp__elevenlabs__add_knowledge_base_to_agent. Reason: ${String(e.message || e).slice(0, 120)}`);
    }
  }

  // ── After state ───────────────────────────────────────────────────────────
  log('--- AFTER STATE ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!after.dry_run) {
    const afterPromptSha = sha256(after?.conversation_config?.agent?.prompt?.prompt || '');
    const afterToolCount = (after?.conversation_config?.agent?.prompt?.tools || []).length;
    const afterKbCount = (after?.conversation_config?.agent?.prompt?.knowledge_base || []).length;
    log(`After prompt SHA: ${afterPromptSha}`);
    log(`After tool count: ${afterToolCount}`);
    log(`After KB count: ${afterKbCount}`);
    log(`Prompt changed: ${afterPromptSha !== sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
  }

  // ── Update agent_config last_synced_at ────────────────────────────────────
  if (!DRY_RUN) {
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Ava.json'), 'utf-8'));
    updated._v1_sync.last_synced_at = new Date().toISOString();
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Ava.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Ava.json with last_synced_at.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[ava] sync failed:', err.message || err);
  process.exit(1);
});
