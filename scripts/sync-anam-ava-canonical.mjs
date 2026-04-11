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
const SHOULD_SYNC_PROMPT = String(process.env.SYNC_ANAM_PROMPT || 'false').toLowerCase() === 'true';

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
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
        query: { type: 'string', description: 'Short reason for requesting context' },
      },
      [],
    ),
    webhookTool(
      'save_office_note',
      'Save request, follow-up, or reminder for future session handoff.',
      'office-note',
      {
        suite_id: { type: 'string', description: 'Active suite ID' },
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
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
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
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
        agent: { type: 'string', enum: ['clara'], description: 'Must be clara' },
        task: { type: 'string', description: 'Legal/contract request' },
        details: { type: 'string', description: 'Optional specifics' },
      },
      ['agent', 'task'],
    ),
    webhookTool(
      'invoke_quinn',
      'Route invoices, quotes, billing, and payment tracking to Quinn.',
      'invoke',
      {
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
        agent: { type: 'string', enum: ['quinn'], description: 'Must be quinn' },
        task: { type: 'string', description: 'Invoice or billing request' },
        customer_name: { type: 'string', description: 'Customer name' },
        customer_email: { type: 'string', description: 'Customer email' },
        details: { type: 'string', description: 'Optional invoice details' },
      },
      ['agent', 'task'],
    ),
    webhookTool(
      'ava_request_approval',
      'Submit drafted action to authority queue for explicit user approval.',
      'approve',
      {
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
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
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
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
        suite_id: { type: 'string', description: 'Active suite ID' },
        user_id: { type: 'string', description: 'Optional user ID' },
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

async function main() {
  console.log(`Syncing Anam Ava persona ${PERSONA_ID}`);
  console.log(`Tool API base URL: ${TOOL_API_BASE_URL}`);
  const persona = await api(`/personas/${PERSONA_ID}`, { method: 'GET' });
  const existingTools = Array.isArray(persona?.tools) ? persona.tools : [];
  const existingNames = existingTools.map((tool) => tool.name).filter(Boolean);
  console.log(`Current attached tools: ${existingTools.length}`);
  if (existingNames.length > 0) {
    console.log(`Current names: ${existingNames.join(', ')}`);
  }
  const preservedKnowledgeToolIds = existingTools
    .filter((tool) => ['Knowledge_Ava', 'ava_knowledge_search'].includes(String(tool?.name || '')))
    .map((tool) => tool?._toolId || tool?.id)
    .filter(Boolean);
  if (preservedKnowledgeToolIds.length > 0) {
    console.log(`Preserving knowledge tool IDs: ${preservedKnowledgeToolIds.join(', ')}`);
  }

  const list = await api('/tools', { method: 'GET' });
  const allTools = Array.isArray(list) ? list : Array.isArray(list?.data) ? list.data : [];

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

  // Attach knowledge tool if available from tool library.
  const refreshedListRaw = await api('/tools', { method: 'GET' });
  const refreshedList = Array.isArray(refreshedListRaw)
    ? refreshedListRaw
    : Array.isArray(refreshedListRaw?.data)
      ? refreshedListRaw.data
      : [];
  const refreshedIds = new Set(refreshedList.map((tool) => tool?.id).filter(Boolean));
  const knowledge = refreshedList.find((tool) => tool?.name === 'Knowledge_Ava')
    || refreshedList.find((tool) => tool?.name === 'ava_knowledge_search');
  if (knowledge?.id) {
    createdToolIds.push(knowledge.id);
    console.log(`Attached knowledge tool ${knowledge.name}: ${knowledge.id}`);
  }
  // Also preserve previously attached knowledge tool IDs even if not listable in /tools.
  for (const kbId of preservedKnowledgeToolIds) {
    if (!createdToolIds.includes(kbId)) {
      createdToolIds.push(kbId);
      console.log(`Re-attached preserved knowledge tool id: ${kbId}`);
    }
  }
  if (!knowledge?.id && preservedKnowledgeToolIds.length === 0) {
    console.warn('No knowledge tool found (Knowledge_Ava / ava_knowledge_search). Continuing without it.');
  }

  // Force-clear persona attachments first to avoid additive merge behavior
  // that leaves stale duplicate tool bindings attached.
  await api(`/personas/${PERSONA_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ toolIds: [], tools: [] }),
  });
  console.log('Persona tools cleared via PUT (toolIds: [], tools: []).');

  await api(`/personas/${PERSONA_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      toolIds: createdToolIds,
      tools: createdToolIds.map((id) => ({ _toolId: id })),
    }),
  });
  console.log('Persona toolIds updated via PUT (toolIds + tools).');

  if (SHOULD_SYNC_PROMPT) {
    const prompt = loadAvaPromptTemplate();
    if (prompt) {
      await api(`/personas/${PERSONA_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ brain: { systemPrompt: prompt } }),
      });
      console.log('Persona prompt updated via PUT.');
    } else {
      console.warn('SYNC_ANAM_PROMPT=true but prompt template file was not found; skipped prompt update.');
    }
  }

  const finalPersona = await api(`/personas/${PERSONA_ID}`, { method: 'GET' });
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
