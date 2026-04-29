#!/usr/bin/env node
// [STATUS: v1] — Anam Finn video persona sync. Persona env: ANAM_FINN_PERSONA_ID.
/**
 * Sync Anam Finn video persona from canonical docs.
 * Cloned from sync-anam-ava-canonical.mjs, adapted for finance-flavored prompt + tools.
 *
 * Usage:
 *   ANAM_API_KEY=... TOOL_WEBHOOK_SHARED_SECRET=... node scripts/sync-anam-finn.mjs
 *   DRY_RUN=true node scripts/sync-anam-finn.mjs
 *   node scripts/sync-anam-finn.mjs --dry-run
 *
 * Optional env:
 *   ANAM_FINN_PERSONA_ID=e98e22fb-9c6e-4f83-ae75-09556815a6bf
 *   ANAM_TOOL_API_BASE_URL=https://www.aspireos.app/v1/tools
 *   TOOL_WEBHOOK_SHARED_SECRET=<shared-secret>
 *   SYNC_ANAM_PROMPT=true   (default true — set false to preserve remote prompt)
 *
 * Idempotent: re-run without changes is a no-op (PUT is idempotent by persona state).
 * Dry-run default if ANAM_API_KEY is unset.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ANAM_API_KEY = process.env.ANAM_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true' || !ANAM_API_KEY;

const PERSONA_ID = process.env.ANAM_FINN_PERSONA_ID || 'e98e22fb-9c6e-4f83-ae75-09556815a6bf';
const DEFAULT_FINN_AVATAR_ID = process.env.ANAM_FINN_AVATAR_ID || '';
const DEFAULT_FINN_VOICE_ID = process.env.ANAM_FINN_VOICE_ID || '';
const DEFAULT_FINN_LLM_ID = process.env.ANAM_FINN_LLM_ID || 'ANAM_GPT_4O_MINI_V1';

const TOOL_API_BASE_URL = (
  process.env.ANAM_TOOL_API_BASE_URL
  || process.env.ANAM_TOOL_WEBHOOK_URL
  || 'https://www.aspireos.app/v1/tools'
).replace(/\/+$/, '');

const TOOL_SECRET_RAW = process.env.TOOL_WEBHOOK_SHARED_SECRET
  || process.env.ASPIRE_TOOL_SECRET
  || process.env.ANAM_TOOL_SECRET
  || process.env.ELEVENLABS_TOOL_SECRET
  || process.env.ELEVENLABS_WORKSPACE_SECRET
  || '';
// `TOOL_WEBHOOK_SHARED_SECRET` is a comma-separated list of *accepted* secrets
// on the desktop server (collectAcceptedSecrets() in agentToolRoutes.ts splits
// on comma). When syncing Anam tool configs we must pick exactly ONE value as
// the header to send.
const TOOL_SECRET = TOOL_SECRET_RAW.split(',')[0].trim();

const SHOULD_SYNC_PROMPT = String(process.env.SYNC_ANAM_PROMPT || 'true').toLowerCase() !== 'false';

if (!DRY_RUN && !ANAM_API_KEY) {
  console.error('[finn-anam] Missing ANAM_API_KEY');
  process.exit(1);
}
if (!DRY_RUN && !TOOL_SECRET) {
  console.error('[finn-anam] Missing TOOL_WEBHOOK_SHARED_SECRET/ASPIRE_TOOL_SECRET/ANAM_TOOL_SECRET');
  process.exit(1);
}

const BASE_URL = 'https://api.anam.ai/v1';

function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [finn-anam] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [finn-anam] ${msg}`);
  }
}

async function api(pathname, options = {}) {
  const url = `${BASE_URL}${pathname}`;
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}${options.method || 'GET'} ${url}`);
  if (DRY_RUN) {
    if (options.body) log('  body:', JSON.parse(options.body));
    return { dry_run: true };
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${ANAM_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`Anam API ${res.status} ${pathname}: ${text.slice(0, 500)}`);
  }
  return data;
}

function extractPersonas(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.personas)) return payload.personas;
  return [];
}

function extractPaginatedData(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function parseMissingToolIdsFromErrorMessage(message) {
  const text = String(message || '');
  const match = text.match(/Tools not found:\s*([^"]+)/i);
  if (!match) return [];
  return String(match[1] || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function toolUrl(pathname) {
  return `${TOOL_API_BASE_URL}/${String(pathname || '').replace(/^\/+/, '')}`;
}

function webhookTool(name, description, urlPath, properties, required = [], options = {}) {
  const additionalProperties = options.additionalProperties ?? true;
  return {
    type: 'SERVER_WEBHOOK',
    name,
    description,
    config: {
      method: 'POST',
      url: toolUrl(urlPath),
      headers: { 'x-aspire-tool-secret': TOOL_SECRET },
      awaitResponse: true,
      parameters: {
        type: 'object',
        strict: true,
        properties,
        ...(required.length > 0 ? { required } : {}),
        additionalProperties,
      },
    },
  };
}

// ── Finn Anam canonical tools ─────────────────────────────────────────────────
// Finance-flavored: financial context, invoices, drafts, handoff brief reading
function buildFinnAnamTools() {
  return [
    webhookTool(
      'finn_get_context',
      'Get current financial context: cash flow, revenue, expenses, outstanding invoices, and any handoff brief from voice session. Call at session start.',
      'context',
      {
        query: { type: 'string', description: 'What financial context to retrieve' },
        handoff_id: { type: 'string', description: 'Optional handoff_id from voice session URL param to load prior session context' },
      },
      [],
    ),
    webhookTool(
      'finn_search_finance',
      'Search financial records: invoices, expenses, transactions, or budget items.',
      'search',
      {
        query: { type: 'string', description: 'Financial search query' },
        domain: { type: 'string', description: 'invoices|expenses|transactions|budget' },
        date_from: { type: 'string', description: 'Optional ISO date filter start' },
        date_to: { type: 'string', description: 'Optional ISO date filter end' },
      },
      ['query'],
    ),
    webhookTool(
      'finn_get_financial_data',
      'Retrieve financial analytics: monthly cash flow, revenue trends, expense breakdown, P&L, budget vs actual.',
      'context',
      {
        query: { type: 'string', description: 'Financial data request, e.g. "monthly cash flow", "top expenses this quarter"' },
        period: { type: 'string', description: 'Optional period e.g. "2026-Q2" or "current"' },
      },
      ['query'],
    ),
    webhookTool(
      'finn_create_draft',
      'Create an invoice, quote, or budget proposal draft for owner review. Present and confirm before requesting approval.',
      'draft',
      {
        draft_type: { type: 'string', description: 'invoice|quote|budget_proposal|financial_recommendation' },
        params: { type: 'object', description: 'Draft parameters (client_name, amount_cents, line_items, due_date, notes, title, summary)' },
      },
      ['draft_type', 'params'],
    ),
    webhookTool(
      'finn_request_approval',
      'Submit confirmed financial draft for approval. ONLY call after owner reviews and confirms. Returns capability_token for execute.',
      'approve',
      {
        draft_id: { type: 'string', description: 'draft_id from finn_create_draft' },
        action: { type: 'string', description: 'Action type matching original draft' },
      },
      ['draft_id'],
    ),
    webhookTool(
      'finn_save_session_summary',
      'Save a finance session summary to office memory at end-of-session. Captures decisions made and open items.',
      'memory/write',
      {
        summary: { type: 'string', description: 'Session summary: what was discussed, decisions made, open items' },
        memory_type: { type: 'string', description: 'Always finance_session_summary' },
        visibility_scope: { type: 'string', description: 'Always finance' },
        linked_handoff_id: { type: 'string', description: 'Optional voice handoff_id this video session continued from' },
      },
      ['summary'],
    ),
  ];
}

// ── Finn finance-flavored system prompt ───────────────────────────────────────
function loadFinnPromptTemplate() {
  // Try canonical prompt from docs/agents/finn/
  try {
    const promptPath = path.join(ROOT, 'docs/agents/finn/01_FINN_SYSTEM_PROMPT.md');
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return null;
  }
}

function materializePromptForStateful(template) {
  const now = new Date();
  const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = now.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const replacements = {
    business_name: 'Aspire',
    salutation: 'Mr.',
    last_name: 'Scott',
    first_name: 'Tony',
    owner_name: 'Mr. Scott',
    gender: 'male',
    industry: 'General Business',
    date: fullDate,
    time_of_day: timeOfDay,
  };

  let prompt = String(template || '');

  // Add Anam-specific video context preamble for finance
  const anamPreamble = `[VIDEO SESSION CONTEXT]
You are operating in video mode via Anam. The owner may have just transferred from a voice session with Finn (ElevenLabs).
If a voiceHandoffBrief is injected below, read it on the first turn and continue the financial conversation without asking the owner to repeat context.
{{voiceHandoffBrief}}

[SESSION BRIDGE]
If voiceHandoffBrief is present: acknowledge the prior context briefly and continue.
If empty: start fresh with finn_get_context to load current financial state.

`;
  prompt = anamPreamble + prompt;

  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    prompt = prompt.replace(pattern, String(value));
  }
  // Do NOT resolve voiceHandoffBrief — it's injected at runtime by session broker
  // Remove other unresolved placeholders
  prompt = prompt.replace(/\{\{\s*(?!voiceHandoffBrief)[^}]+\s*\}\}/g, '').replace(/\n{3,}/g, '\n\n');
  return prompt.trim();
}

function buildPersonaPutPayload(currentPersona, overrides = {}) {
  const payload = {};
  const passthroughKeys = [
    'name', 'description', 'avatarId', 'avatarModel', 'voiceId', 'llmId',
    'systemPrompt', 'skipGreeting', 'zeroDataRetention', 'languageCode',
    'voiceDetectionOptions', 'voiceGenerationOptions', 'maxSessionLengthSeconds',
  ];

  for (const key of passthroughKeys) {
    if (currentPersona?.[key] !== undefined) payload[key] = currentPersona[key];
  }
  if (payload.systemPrompt === undefined && typeof currentPersona?.brain?.systemPrompt === 'string') {
    payload.systemPrompt = currentPersona.brain.systemPrompt;
  }
  if (!payload.avatarId && DEFAULT_FINN_AVATAR_ID) payload.avatarId = DEFAULT_FINN_AVATAR_ID;
  if (!payload.avatarId && currentPersona?.avatar?.id) payload.avatarId = currentPersona.avatar.id;
  if (!payload.voiceId && DEFAULT_FINN_VOICE_ID) payload.voiceId = DEFAULT_FINN_VOICE_ID;
  if (!payload.voiceId && currentPersona?.voice?.id) payload.voiceId = currentPersona.voice.id;
  if (!payload.llmId) payload.llmId = currentPersona?.llmId || DEFAULT_FINN_LLM_ID;
  return { ...payload, ...overrides };
}

async function listAllTools() {
  const perPage = 100;
  let page = 1;
  let maxPages = 1;
  let safety = 0;
  const out = [];
  while (page <= maxPages && safety < 50) {
    safety += 1;
    const payload = await api(`/tools?page=${page}&perPage=${perPage}`, { method: 'GET' });
    if (payload.dry_run) return [];
    const pageItems = extractPaginatedData(payload);
    out.push(...pageItems);
    const rawLastPage = Number(payload?.meta?.lastPage || 0);
    if (Number.isFinite(rawLastPage) && rawLastPage >= 1) maxPages = rawLastPage;
    else if (pageItems.length < perPage) maxPages = page;
    else maxPages = Math.max(maxPages, page + 1);
    if (pageItems.length === 0 && (!Number.isFinite(rawLastPage) || rawLastPage < 1)) break;
    page += 1;
  }
  const byId = new Map();
  for (const tool of out) {
    const id = String(tool?.id || tool?._toolId || '').trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, tool);
  }
  return Array.from(byId.values());
}

async function main() {
  log(`Starting sync for Anam Finn persona ${PERSONA_ID}`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Tool API base URL: ${TOOL_API_BASE_URL}`);

  // Resolve persona
  let resolvedPersonaId = PERSONA_ID;
  const personasPayload = await api('/personas', { method: 'GET' });
  if (!personasPayload.dry_run) {
    const personas = extractPersonas(personasPayload);
    const personaById = personas.find((p) => String(p?.id || '').trim() === resolvedPersonaId);
    if (!personaById) {
      const fallback = personas.find((p) => /finn/i.test(String(p?.name || '')));
      if (fallback?.id) {
        log(`Preferred persona id ${resolvedPersonaId} not found. Falling back to ${fallback.id} (${fallback.name}).`);
        resolvedPersonaId = fallback.id;
      }
    }
  }

  log(`Using persona: ${resolvedPersonaId}`);
  const persona = await api(`/personas/${resolvedPersonaId}`, { method: 'GET' });
  if (!persona.dry_run) {
    const existingTools = Array.isArray(persona?.tools) ? persona.tools : [];
    log(`Current attached tools: ${existingTools.length} — ${existingTools.map((t) => t.name).join(', ')}`);
  }

  // Managed tool names to clean up
  const finnManagedNames = new Set([
    'finn_get_context', 'finn_search_finance', 'finn_get_financial_data',
    'finn_create_draft', 'finn_request_approval', 'finn_save_session_summary',
    'finn_get_context_v1', 'finn_search', 'finn_context', 'finn_finance',
  ]);

  // Delete stale managed tools
  const allTools = await listAllTools();
  if (!Array.isArray(allTools) || allTools.length === 0) {
    log('No existing tools to clean or dry-run mode. Skipping deletions.');
  } else {
    const deletions = allTools.filter((t) => finnManagedNames.has(String(t?.name || '')));
    for (const tool of deletions) {
      log(`Deleting stale tool ${tool.name} (${tool.id})`);
      await api(`/tools/${tool.id}`, { method: 'DELETE' });
    }
  }

  // Create canonical tools
  const canonicalTools = buildFinnAnamTools();
  const createdToolIds = [];
  if (DRY_RUN) {
    log(`[DRY-RUN] Would create ${canonicalTools.length} tools: ${canonicalTools.map((t) => t.name).join(', ')}`);
  } else {
    for (const tool of canonicalTools) {
      const created = await api('/tools', { method: 'POST', body: JSON.stringify(tool) });
      const createdId = created?.id || created?._toolId;
      if (!createdId) throw new Error(`Tool ${tool.name} created without id`);
      createdToolIds.push(createdId);
      log(`Created ${tool.name}: ${createdId}`);
    }
  }

  // Load + materialize prompt
  const rawPrompt = SHOULD_SYNC_PROMPT ? loadFinnPromptTemplate() : null;
  const prompt = rawPrompt ? materializePromptForStateful(rawPrompt) : null;
  if (SHOULD_SYNC_PROMPT && !rawPrompt) {
    log('SYNC_ANAM_PROMPT=true but prompt file not found; continuing with existing systemPrompt.');
  }
  if (prompt) log(`Prompt length: ${prompt.length} chars (includes voiceHandoffBrief template var)`);

  // Clear persona tools
  if (!DRY_RUN) {
    await api(`/personas/${resolvedPersonaId}`, {
      method: 'PUT',
      body: JSON.stringify(buildPersonaPutPayload(persona, { toolIds: [] })),
    });
    log('Persona tools cleared via PUT (toolIds: []).');
  } else {
    log('[DRY-RUN] Would clear persona toolIds via PUT');
  }

  // Set tools + prompt
  let finalToolIds = [...createdToolIds];
  const putPayload = buildPersonaPutPayload(persona, {
    toolIds: finalToolIds,
    ...(prompt ? { systemPrompt: prompt } : {}),
  });

  if (DRY_RUN) {
    log(`[DRY-RUN] Would PUT persona with toolIds: ${finalToolIds.length > 0 ? finalToolIds.join(', ') : '(created in live run)'} and systemPrompt: ${prompt ? 'updated' : 'preserved'}`);
  } else {
    try {
      await api(`/personas/${resolvedPersonaId}`, { method: 'PUT', body: JSON.stringify(putPayload) });
      log('Persona updated with tools and prompt.');
    } catch (error) {
      const msg = error?.message || String(error);
      const missing = parseMissingToolIdsFromErrorMessage(msg);
      if (missing.length === 0) throw error;
      log(`Dropping missing tool IDs and retrying: ${missing.join(', ')}`);
      finalToolIds = finalToolIds.filter((id) => !missing.includes(id));
      await api(`/personas/${resolvedPersonaId}`, {
        method: 'PUT',
        body: JSON.stringify(buildPersonaPutPayload(persona, {
          toolIds: finalToolIds,
          ...(prompt ? { systemPrompt: prompt } : {}),
        })),
      });
      log('Persona updated after pruning missing IDs.');
    }
  }
  if (prompt) log('Persona systemPrompt updated (voiceHandoffBrief template var preserved).');

  // Verify final state
  const finalPersona = await api(`/personas/${resolvedPersonaId}`, { method: 'GET' });
  if (!finalPersona.dry_run) {
    const finalNames = (finalPersona?.tools || []).map((t) => String(t?.name || '')).filter(Boolean);
    const counts = finalNames.reduce((acc, n) => { acc[n] = (acc[n] || 0) + 1; return acc; }, {});
    const dupes = Object.entries(counts).filter(([, c]) => c > 1);
    log(`Final attached tools: ${finalNames.length}`);
    log(`Final names: ${finalNames.join(', ')}`);
    if (dupes.length > 0) log(`WARNING: Duplicate tool names: ${JSON.stringify(dupes)}`);
    else log('No duplicate tool names.');
  }

  log(`Sync complete. persona=${resolvedPersonaId} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[finn-anam] sync failed:', err.message || err);
  process.exit(1);
});
