/**
 * add_show_cards_tool.js — Robustly ensures Ava has show_cards configured.
 *
 * This script uses the current ElevenLabs tool model:
 * 1) Ensure a reusable show_cards tool exists in /v1/convai/tools
 * 2) Update that tool definition
 * 3) Sanitize the agent's prompt.tool_ids (drop stale ids)
 * 4) Attach show_cards tool id to the agent prompt.tool_ids
 * 5) Ensure prompt contains show_cards usage guidance
 *
 * Run:
 *   ELEVENLABS_API_KEY=... node scripts/add_show_cards_tool.js
 */

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ERROR: Set ELEVENLABS_API_KEY env var');
  process.exit(1);
}

const AGENT_ID = 'agent_1201kmqdjgxvfxxteedpkvjej7er'; // Ava
const API_AGENT = `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`;
const API_TOOLS = 'https://api.elevenlabs.io/v1/convai/tools';

const headers = {
  'xi-api-key': apiKey,
  'Content-Type': 'application/json',
};

const SHOW_CARDS_TOOL_CONFIG = {
  type: 'client',
  name: 'show_cards',
  description:
    "Display visual research result cards on the user's screen. Call this immediately after invoke_adam returns results. Pass artifact_type, records, summary, and card_cache_id when available.",
  response_timeout_secs: 5,
  disable_interruptions: false,
  force_pre_tool_speech: false,
  assignments: [],
  tool_call_sound_behavior: 'auto',
  tool_error_handling_mode: 'auto',
  parameters: {
    type: 'object',
    required: ['artifact_type', 'records', 'summary'],
    properties: {
      artifact_type: {
        type: 'string',
        description:
          'Result type: HotelShortlist, PriceComparison, VendorShortlist, PropertyFactPack, LandlordPropertyPack, InvestmentOpportunityPack, etc.',
      },
      records: {
        type: 'array',
        description: "Records array from invoke_adam response data to display as cards",
        items: { type: 'object', properties: {}, required: [] },
      },
      summary: {
        type: 'string',
        description: 'Brief summary shown as card modal header',
      },
      card_cache_id: {
        type: 'string',
        description:
          'Optional cache id from invoke_adam response (_card_cache_id). Pass when available to fetch exact full records.',
      },
    },
  },
  expects_response: false,
  dynamic_variables: { dynamic_variable_placeholders: {} },
  execution_mode: 'immediate',
};

const SHOW_CARDS_PROMPT_SNIPPET = [
  '',
  '## show_cards',
  '',
  '- When to use: ALWAYS after invoke_adam returns results with records',
  '- Call show_cards with artifact_type, records array, and a brief summary',
  '- If invoke_adam returns _card_cache_id, include it as card_cache_id',
  '- Call this while narrating results so the cards appear immediately',
].join('\n');

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${url} — ${body}`);
  }
  return resp.json();
}

async function safeGetTool(toolId) {
  try {
    const doc = await fetchJson(`${API_TOOLS}/${toolId}`, { headers: { 'xi-api-key': apiKey } });
    return doc?.id || toolId;
  } catch {
    return null;
  }
}

async function ensureShowCardsTool() {
  const list = await fetchJson(API_TOOLS, { headers: { 'xi-api-key': apiKey } });
  const tools = Array.isArray(list.tools) ? list.tools : [];
  const existing = tools.find((t) => t?.tool_config?.name === 'show_cards');
  if (existing?.id) {
    await fetchJson(`${API_TOOLS}/${existing.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tool_config: SHOW_CARDS_TOOL_CONFIG }),
    });
    return existing.id;
  }

  const created = await fetchJson(API_TOOLS, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tool_config: SHOW_CARDS_TOOL_CONFIG }),
  });
  if (!created?.id) throw new Error('Failed to create show_cards tool');
  return created.id;
}

async function main() {
  console.log('Fetching Ava agent...');
  const agent = await fetchJson(API_AGENT, { headers: { 'xi-api-key': apiKey } });
  const prompt = agent?.conversation_config?.agent?.prompt;
  if (!prompt) throw new Error('Agent prompt config missing');

  console.log('Ensuring show_cards tool exists...');
  const showCardsToolId = await ensureShowCardsTool();
  console.log(`show_cards tool id: ${showCardsToolId}`);

  const currentIds = Array.isArray(prompt.tool_ids) ? prompt.tool_ids : [];
  const verifiedIds = [];
  for (const id of currentIds) {
    const valid = await safeGetTool(id);
    if (valid) verifiedIds.push(valid);
  }
  if (!verifiedIds.includes(showCardsToolId)) verifiedIds.push(showCardsToolId);

  let updatedPromptText = prompt.prompt || '';
  if (!updatedPromptText.includes('## show_cards')) {
    const routingIdx = updatedPromptText.indexOf('# Routing');
    if (routingIdx > 0) {
      updatedPromptText =
        updatedPromptText.slice(0, routingIdx) +
        SHOW_CARDS_PROMPT_SNIPPET +
        '\n\n' +
        updatedPromptText.slice(routingIdx);
    } else {
      updatedPromptText += '\n' + SHOW_CARDS_PROMPT_SNIPPET;
    }
  }

  console.log('Patching agent prompt.tool_ids + prompt text...');
  const patched = await fetchJson(API_AGENT, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            tool_ids: verifiedIds,
            prompt: updatedPromptText,
          },
        },
      },
    }),
  });

  const finalIds = patched?.conversation_config?.agent?.prompt?.tool_ids || [];
  console.log('\n=== VERIFICATION ===');
  console.log(`tool_ids count: ${finalIds.length}`);
  console.log(`show_cards attached: ${finalIds.includes(showCardsToolId)}`);
  console.log(
    `prompt has show_cards section: ${String(
      patched?.conversation_config?.agent?.prompt?.prompt?.includes('## show_cards'),
    )}`,
  );
  console.log('Done.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
