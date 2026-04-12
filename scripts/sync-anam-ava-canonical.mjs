#!/usr/bin/env node
/**
 * Force-reset Anam Ava persona tools to canonical set (no duplicates, no legacy headers).
 *
 * Usage:
 *   ANAM_API_KEY=... node scripts/sync-anam-ava-canonical.mjs
 *
 * Optional env:
 *   ANAM_AVA_PERSONA_ID=58f82b89-8ae7-43cc-930d-be8def14dff3
 *   ANAM_TOOL_API_BASE_URL=https://www.aspireos.app/v1/tools
 *   ANAM_TOOL_WEBHOOK_URL=https://www.aspireos.app/v1/tools (legacy alias for base URL)
 *   TOOL_WEBHOOK_SHARED_SECRET=<shared-secret>
 *   ASPIRE_TOOL_SECRET=<shared-secret>
 *   ANAM_TOOL_SECRET=<shared-secret>
 *   SYNC_ANAM_PROMPT=true
 */

import fs from 'fs';
import path from 'path';

const ANAM_API_KEY = process.env.ANAM_API_KEY || '';
const PERSONA_ID = process.env.ANAM_AVA_PERSONA_ID || '58f82b89-8ae7-43cc-930d-be8def14dff3';
const DEFAULT_AVA_AVATAR_ID = process.env.ANAM_AVA_AVATAR_ID || '30fa96d0-26c4-4e55-94a0-517025942e18';
const DEFAULT_AVA_VOICE_ID = process.env.ANAM_AVA_VOICE_ID || '0c8b52f4-f26d-4810-855c-c90e5f599cbc';
const DEFAULT_AVA_LLM_ID = process.env.ANAM_AVA_LLM_ID || 'ANAM_GPT_4O_MINI_V1';
const TOOL_API_BASE_URL = (
  process.env.ANAM_TOOL_API_BASE_URL
  || process.env.ANAM_TOOL_WEBHOOK_URL
  || 'https://www.aspireos.app/v1/tools'
).replace(/\/+$/, '');
const TOOL_SECRET = process.env.TOOL_WEBHOOK_SHARED_SECRET
  || process.env.ASPIRE_TOOL_SECRET
  || process.env.ANAM_TOOL_SECRET
  || process.env.ELEVENLABS_TOOL_SECRET
  || process.env.ELEVENLABS_WORKSPACE_SECRET;
// Default to syncing prompt + tools together so dashboard testing matches runtime.
// Set SYNC_ANAM_PROMPT=false only when intentionally preserving remote prompt text.
const SHOULD_SYNC_PROMPT = String(process.env.SYNC_ANAM_PROMPT || 'true').toLowerCase() !== 'false';

if (!ANAM_API_KEY) {
  console.error('Missing ANAM_API_KEY');
  process.exit(1);
}
if (!TOOL_SECRET) {
  console.error('Missing TOOL_WEBHOOK_SHARED_SECRET/ASPIRE_TOOL_SECRET/ANAM_TOOL_SECRET');
  process.exit(1);
}

const BASE_URL = 'https://api.anam.ai/v1';

async function api(pathname, options = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
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

function extractPaginatedData(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
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
    const pageItems = extractPaginatedData(payload);
    out.push(...pageItems);

    const rawLastPage = Number(payload?.meta?.lastPage || 0);
    if (Number.isFinite(rawLastPage) && rawLastPage >= 1) {
      maxPages = rawLastPage;
    } else if (pageItems.length < perPage) {
      maxPages = page;
    } else {
      maxPages = Math.max(maxPages, page + 1);
    }

    if (pageItems.length === 0 && (!Number.isFinite(rawLastPage) || rawLastPage < 1)) {
      break;
    }
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

function extractKnowledgeGroups(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.folders)) return payload.folders;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function extractKnowledgeDocuments(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function extractPersonas(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.personas)) return payload.personas;
  return [];
}

function parseMissingToolIdsFromErrorMessage(message) {
  const text = String(message || '');
  const match = text.match(/Tools not found:\s*([^\"]+)/i);
  if (!match) return [];
  return String(match[1] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function toolUrl(pathname) {
  const cleanPath = String(pathname || '').replace(/^\/+/, '');
  return `${TOOL_API_BASE_URL}/${cleanPath}`;
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
      headers: {
        'x-aspire-tool-secret': TOOL_SECRET,
      },
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

function buildCanonicalTools() {
  return [
    {
      type: 'CLIENT',
      name: 'show_cards',
      description:
        "Use this tool to render structured visual cards in the UI immediately after invoke_adam returns data. Map Adam response fields into artifact_type, records, and summary so the user can browse results on screen.",
      config: {
        parameters: {
          type: 'object',
          strict: true,
          required: ['artifact_type', 'records', 'summary'],
          properties: {
            artifact_type: {
              type: 'string',
              description:
                'Card schema/category identifier from Adam response metadata (for example LandlordPropertyPack or hotel/product pack type).',
            },
            records: {
              type: 'array',
              items: { type: 'object' },
              description: 'List of Adam result objects to render as individual visual cards.',
            },
            summary: {
              type: 'string',
              description: 'Concise human-readable headline summarizing the card set being displayed.',
            },
          },
          additionalProperties: false,
        },
      },
    },
    webhookTool(
      'ava_get_context',
      'Retrieve business context: briefings, schedule, missed calls, and pending approvals.',
      'context',
      {
        query: { type: 'string', description: 'Short reason for requesting context' },
      },
      [],
    ),
    webhookTool(
      'save_office_note',
      'Save request, follow-up, or reminder for future session handoff.',
      'office-note',
      {
        note_type: { type: 'string', description: 'handoff|contract_request|follow_up|reminder' },
        summary: { type: 'string', description: 'Note body to store' },
        next_step: { type: 'string', description: 'Optional next step' },
        entity: { type: 'string', description: 'Optional related entity (client/property/vendor)' },
      },
      ['summary'],
    ),
    webhookTool(
      'invoke_tec',
      'Route document tasks to Tec for proposals, reports, contracts, and PDFs.',
      'invoke',
      {
        agent: { type: 'string', enum: ['tec'], description: 'Must be tec' },
        task: { type: 'string', description: 'Document request' },
        details: { type: 'string', description: 'Optional details and constraints' },
      },
      ['agent', 'task'],
      { additionalProperties: false },
    ),
    webhookTool(
      'invoke_adam',
      "Use this tool to delegate specialized research to the Adam agent for properties, hotels, products, vendors, or market analysis. Always set agent to 'adam'. Use task for the high-level objective and query for the specific address, name, or search term.",
      'invoke',
      {
        agent: { type: 'string', enum: ['adam'], description: 'Must be adam' },
        task: { type: 'string', description: 'Overall research instruction (for example: find paint sprayers in Tallahassee).' },
        query: { type: 'string', description: 'Specific search term, address, or named entity to look up.' },
        city: { type: 'string', description: 'City or location context' },
        limit: { type: 'number', description: 'Optional result limit' },
        entity_type: {
          type: 'string',
          enum: ['property', 'hotel', 'product', 'vendor', 'market'],
          description: 'Category of entity being researched.',
        },
        filters: {
          type: 'object',
          description: 'Optional key-value filters to narrow results (for example price_range, rating, in_stock).',
          additionalProperties: true,
        },
        card_cache_id: { type: 'string', description: 'Optional cache continuation id' },
      },
      ['agent', 'task', 'query'],
      { additionalProperties: false },
    ),
    webhookTool(
      'invoke_clara',
      'Route legal and contract tasks to Clara.',
      'invoke',
      {
        agent: { type: 'string', enum: ['clara'], description: 'Must be clara' },
        task: { type: 'string', description: 'Legal/contract request' },
        details: { type: 'string', description: 'Optional specifics' },
      },
      ['agent', 'task'],
    ),
    webhookTool(
      'invoke_quinn',
      "Use this tool for invoice and quote workflows only. Set agent to 'quinn'. Use task for the high-level action (for example: invoice or quote) and include customer/invoice fields when available.",
      'invoke',
      {
        agent: { type: 'string', enum: ['quinn'], description: 'Must be quinn' },
        task: { type: 'string', description: 'Invoice or quote request (for example: invoice, quote, draft invoice)' },
        customer_name: { type: 'string', description: 'Customer full name for lookup.' },
        customer_email: { type: 'string', description: 'Customer email when known.' },
        customer_first_name: { type: 'string', description: 'Customer first name for onboarding.' },
        customer_last_name: { type: 'string', description: 'Customer last name for onboarding.' },
        customer_company: { type: 'string', description: 'Optional customer company name.' },
        customer_phone: { type: 'string', description: 'Optional customer phone number.' },
        customer_address: { type: 'string', description: 'Optional billing address.' },
        line_items: {
          type: 'array',
          description: 'Optional invoice line items.',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price_cents: { type: 'number' },
            },
            additionalProperties: true,
          },
        },
        total_cents: { type: 'number', description: 'Invoice total in cents.' },
        due_days: { type: 'number', description: 'Payment due days (zero means due immediately).' },
        currency: { type: 'string', description: 'Currency code, usually usd.' },
        notes: { type: 'string', description: 'Optional notes/memo.' },
        is_quote: { type: 'boolean', description: 'Set true for quote mode.' },
        details: { type: 'string', description: 'Optional freeform invoice details.' },
      },
      ['agent', 'task'],
    ),
    webhookTool(
      'ava_request_approval',
      'Submit drafted action to authority queue for explicit user approval.',
      'approve',
      {
        draft_id: { type: 'string', description: 'Draft identifier' },
        action_type: { type: 'string', description: 'Action type to approve' },
      },
      ['draft_id'],
    ),
    webhookTool(
      'ava_create_draft',
      'Create draft action that needs user confirmation.',
      'draft',
      {
        draft_type: { type: 'string', description: 'email|invoice|meeting|task|reminder|deadline|follow_up|calendar' },
        details: { type: 'object', description: 'Draft payload details' },
      },
      ['draft_type', 'details'],
    ),
    webhookTool(
      'ava_search',
      'Search business domains: calendar, contacts, emails, invoices.',
      'search',
      {
        query: { type: 'string', description: 'Search text' },
        domain: { type: 'string', description: 'calendar|contacts|email|invoices' },
        search_type: { type: 'string', description: 'Optional subtype for legacy compatibility' },
      },
      ['query'],
    ),
  ];
}

function loadAvaPromptTemplate() {
  try {
    const promptPath = path.join(
      process.cwd(),
      '..',
      'backend',
      'orchestrator',
      'src',
      'aspire_orchestrator',
      'config',
      'pack_personas',
      'ava_anam_video_prompt.md',
    );
    return fs.readFileSync(promptPath, 'utf-8');
  } catch {
    return null;
  }
}

function materializePromptForStateful(template) {
  const now = new Date();
  const fullDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
    has_camera: 'false',
    time_of_day: timeOfDay,
  };

  let prompt = String(template || '');
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    prompt = prompt.replace(pattern, String(value));
  }
  // Remove any unresolved placeholders so lab tests never read template vars aloud.
  prompt = prompt.replace(/\{\{\s*[^}]+\s*\}\}/g, '').replace(/\n{3,}/g, '\n\n');
  return prompt.trim();
}

async function selectKnowledgeFolderIds() {
  const groupsPayload = await api('/knowledge/groups', { method: 'GET' });
  const groups = extractKnowledgeGroups(groupsPayload)
    .map((g) => ({
      id: String(g?.id || '').trim(),
      name: String(g?.name || '').trim(),
    }))
    .filter((g) => g.id.length > 0);

  const groupWithReadyCount = [];
  for (const group of groups) {
    try {
      const docsPayload = await api(`/knowledge/groups/${group.id}/documents`, { method: 'GET' });
      const docs = extractKnowledgeDocuments(docsPayload);
      const readyCount = docs.filter((d) => String(d?.status || '').toUpperCase() === 'READY').length;
      groupWithReadyCount.push({ ...group, readyCount });
    } catch {
      groupWithReadyCount.push({ ...group, readyCount: 0 });
    }
  }

  const avaReady = groupWithReadyCount.filter((g) => /ava/i.test(g.name) && g.readyCount > 0);
  const anyReady = groupWithReadyCount.filter((g) => g.readyCount > 0);
  const selected = (avaReady.length > 0 ? avaReady : anyReady).map((g) => g.id);
  return {
    folderIds: selected,
    debug: groupWithReadyCount,
  };
}

function buildPersonaPutPayload(currentPersona, overrides = {}) {
  const payload = {};
  const passthroughKeys = [
    'name',
    'description',
    'avatarId',
    'avatarModel',
    'voiceId',
    'llmId',
    'systemPrompt',
    'skipGreeting',
    'zeroDataRetention',
    'languageCode',
    'voiceDetectionOptions',
    'voiceGenerationOptions',
    'maxSessionLengthSeconds',
  ];

  for (const key of passthroughKeys) {
    if (currentPersona?.[key] !== undefined) {
      payload[key] = currentPersona[key];
    }
  }
  if (payload.systemPrompt === undefined && typeof currentPersona?.brain?.systemPrompt === 'string') {
    payload.systemPrompt = currentPersona.brain.systemPrompt;
  }
  if (!payload.avatarId) payload.avatarId = currentPersona?.avatar?.id || DEFAULT_AVA_AVATAR_ID;
  if (!payload.voiceId) payload.voiceId = currentPersona?.voice?.id || DEFAULT_AVA_VOICE_ID;
  if (!payload.llmId) payload.llmId = currentPersona?.llmId || DEFAULT_AVA_LLM_ID;
  return { ...payload, ...overrides };
}

async function main() {
  let resolvedPersonaId = PERSONA_ID;
  const personasPayload = await api('/personas', { method: 'GET' });
  const personas = extractPersonas(personasPayload);
  const personaById = personas.find((p) => String(p?.id || '').trim() === resolvedPersonaId);
  if (!personaById) {
    const fallbackPersona = personas.find((p) => String(p?.name || '').trim().toLowerCase() === 'ava chief of staff')
      || personas.find((p) => String(p?.name || '').trim().toLowerCase() === 'ava');
    if (fallbackPersona?.id) {
      console.warn(`Preferred persona id ${resolvedPersonaId} not found for this API key. Falling back to ${fallbackPersona.id} (${fallbackPersona.name}).`);
      resolvedPersonaId = fallbackPersona.id;
    }
  }

  console.log(`Syncing Anam Ava persona ${resolvedPersonaId}`);
  console.log(`Tool API base URL: ${TOOL_API_BASE_URL}`);
  const persona = await api(`/personas/${resolvedPersonaId}`, { method: 'GET' });
  const existingTools = Array.isArray(persona?.tools) ? persona.tools : [];
  const existingNames = existingTools.map((tool) => tool.name).filter(Boolean);
  console.log(`Current attached tools: ${existingTools.length}`);
  if (existingNames.length > 0) {
    console.log(`Current names: ${existingNames.join(', ')}`);
  }

  const allTools = await listAllTools();

  const managedNames = new Set([
    'show_cards',
    'ava_get_context',
    'save_office_note',
    'invoke_tec',
    'invoke_adam',
    'invoke_clara',
    'invoke_quinn',
    'ava_request_approval',
    'ava_create_draft',
    'ava_search',
    'search',
    'ava_execute_action',
    'Knowledge_Ava',
    'ava_knowledge_search',
  ]);

  const deletions = allTools.filter((tool) => managedNames.has(String(tool?.name || '')));
  for (const tool of deletions) {
    console.log(`Deleting stale tool ${tool.name} (${tool.id})`);
    await api(`/tools/${tool.id}`, { method: 'DELETE' });
  }

  const canonicalTools = buildCanonicalTools();
  const createdToolIds = [];
  for (const tool of canonicalTools) {
    const created = await api('/tools', { method: 'POST', body: JSON.stringify(tool) });
    const createdId = created?.id || created?._toolId;
    if (!createdId) {
      throw new Error(`Tool ${tool.name} created without id`);
    }
    createdToolIds.push(createdId);
    console.log(`Created ${tool.name}: ${createdId}`);
  }

  // Recreate Knowledge_Ava with folders that actually have READY docs.
  const knowledgeSelection = await selectKnowledgeFolderIds();
  if (knowledgeSelection.folderIds.length > 0) {
    const kbTool = await api('/tools', {
      method: 'POST',
      body: JSON.stringify({
        type: 'SERVER_RAG',
        name: 'Knowledge_Ava',
        description:
          "Search Ava's uploaded knowledge documents for workflow steps, voice rules, and strategic playbook guidance. Use this when task process, phrasing, or policy is uncertain. Prefer live tools for factual values; use Knowledge_Ava for how Ava should respond and operate.",
        config: {
          documentFolderIds: knowledgeSelection.folderIds,
        },
      }),
    });
    if (kbTool?.id) {
      createdToolIds.push(kbTool.id);
      console.log(`Created knowledge tool Knowledge_Ava: ${kbTool.id}`);
      console.log(`Knowledge folders: ${knowledgeSelection.folderIds.join(', ')}`);
    } else {
      console.warn('Knowledge_Ava creation returned no id. Continuing without knowledge tool.');
    }
  } else {
    console.warn('No knowledge folders with READY docs found. Continuing without knowledge tool.');
    console.warn(`Knowledge folder scan: ${JSON.stringify(knowledgeSelection.debug)}`);
  }

  const rawPrompt = SHOULD_SYNC_PROMPT ? loadAvaPromptTemplate() : null;
  const prompt = rawPrompt ? materializePromptForStateful(rawPrompt) : null;
  if (SHOULD_SYNC_PROMPT && !rawPrompt) {
    console.warn('SYNC_ANAM_PROMPT=true but prompt template file was not found; continuing with existing systemPrompt.');
  }

  // Force-clear persona attachments first to avoid additive merge behavior.
  // Keep the full persona payload so PUT updates do not accidentally wipe fields.
  await api(`/personas/${resolvedPersonaId}`, {
    method: 'PUT',
    body: JSON.stringify(buildPersonaPutPayload(persona, { toolIds: [] })),
  });
  console.log('Persona tools cleared via PUT (toolIds: []).');

  let finalToolIds = [...createdToolIds];
  try {
    await api(`/personas/${resolvedPersonaId}`, {
      method: 'PUT',
      body: JSON.stringify(
        buildPersonaPutPayload(persona, {
          toolIds: finalToolIds,
          ...(prompt ? { systemPrompt: prompt } : {}),
        }),
      ),
    });
    console.log('Persona toolIds updated via PUT.');
  } catch (error) {
    const msg = error?.message || String(error);
    const missing = parseMissingToolIdsFromErrorMessage(msg);
    if (missing.length === 0) throw error;
    console.warn(`Dropping missing tool IDs and retrying: ${missing.join(', ')}`);
    finalToolIds = finalToolIds.filter((id) => !missing.includes(id));
    await api(`/personas/${resolvedPersonaId}`, {
      method: 'PUT',
      body: JSON.stringify(
        buildPersonaPutPayload(persona, {
          toolIds: finalToolIds,
          ...(prompt ? { systemPrompt: prompt } : {}),
        }),
      ),
    });
    console.log('Persona toolIds updated after pruning missing IDs.');
  }
  if (prompt) console.log('Persona prompt updated via PUT (systemPrompt).');

  const finalPersona = await api(`/personas/${resolvedPersonaId}`, { method: 'GET' });
  const finalNames = (finalPersona?.tools || []).map((tool) => String(tool?.name || '')).filter(Boolean);
  const counts = finalNames.reduce((acc, name) => {
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const dupes = Object.entries(counts).filter(([, count]) => count > 1);
  console.log(`Final attached tools: ${finalNames.length}`);
  console.log(`Final names: ${finalNames.join(', ')}`);
  if (dupes.length > 0) {
    console.warn(`Duplicate names remain: ${JSON.stringify(dupes)}`);
  } else {
    console.log('No duplicate tool names remain.');
  }
}

main().catch((error) => {
  console.error('sync-anam-ava-canonical failed:', error.message || error);
  process.exit(1);
});
