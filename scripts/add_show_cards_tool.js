/**
 * add_show_cards_tool.js — Adds the show_cards client tool to Ava's ElevenLabs agent.
 *
 * This script:
 * 1. GETs Ava's current agent config (preserving all existing tools + prompt)
 * 2. Adds show_cards as a client tool (if not already present)
 * 3. Appends show_cards instruction to the system prompt
 * 4. PATCHes the agent config
 *
 * Run: ELEVENLABS_API_KEY=... node scripts/add_show_cards_tool.js
 */

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('ERROR: Set ELEVENLABS_API_KEY env var');
  process.exit(1);
}

const AGENT_ID = 'agent_1201kmqdjgxvfxxteedpkvjej7er'; // Ava
const API = `https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`;

// The show_cards client tool definition
const SHOW_CARDS_TOOL = {
  type: 'client',
  name: 'show_cards',
  description: 'Display visual research result cards on the user\'s screen. Call this IMMEDIATELY when Adam research completes with results. The user will see the cards while you narrate. Always include artifact_type, records array, and a brief summary.',
  parameters: {
    type: 'object',
    properties: {
      artifact_type: {
        type: 'string',
        description: 'The type of research results: HotelShortlist, PriceComparison, VendorShortlist, ProspectList, CompetitorBrief, PropertyFactPack, LandlordPropertyPack, InvestmentOpportunityPack, EstimateResearchPack, etc.',
      },
      records: {
        type: 'array',
        description: 'Array of research result records to display as cards. Pass the full records array from Adam\'s response.',
        items: { type: 'object' },
      },
      summary: {
        type: 'string',
        description: 'Brief summary of the results (1-2 sentences). This appears as the modal header.',
      },
    },
    required: ['artifact_type', 'records', 'summary'],
  },
};

// Prompt addition for show_cards
const SHOW_CARDS_PROMPT_SECTION = [
  '',
  '## show_cards',
  '',
  '- When to use: ALWAYS after invoke_adam returns results with records',
  '- Call show_cards with the artifact_type, records array, and a brief summary',
  '- Call this WHILE you are narrating the results \u2014 the user sees the visual cards as you speak',
  '- Do not wait until you finish talking \u2014 show the cards immediately',
  '- Example: After finding hotels, call show_cards({artifact_type: "HotelShortlist", records: [...], summary: "Found 16 hotels near Tucker GA"})',
].join('\n');

async function main() {
  // Step 1: GET current config
  console.log('Fetching current Ava agent config...');
  const getResp = await fetch(API, { headers: { 'xi-api-key': apiKey } });
  if (!getResp.ok) {
    console.error('GET failed:', getResp.status, await getResp.text());
    process.exit(1);
  }
  const agent = await getResp.json();
  const prompt = agent.conversation_config?.agent?.prompt;
  const tools = prompt?.tools || [];

  console.log('Current tools:', tools.map(t => t.name).join(', '));
  console.log('Current prompt length:', prompt?.prompt?.length, 'chars');

  // Step 2: Check if show_cards already exists
  const existing = tools.find(t => t.name === 'show_cards');
  if (existing) {
    console.log('show_cards tool already exists! Updating definition...');
    Object.assign(existing, SHOW_CARDS_TOOL);
  } else {
    console.log('Adding show_cards tool...');
    tools.push(SHOW_CARDS_TOOL);
  }

  // Step 3: Add show_cards section to prompt (if not already there)
  let updatedPrompt = prompt.prompt;
  if (!updatedPrompt.includes('## show_cards')) {
    // Insert before the "# Routing" section or at the end of the "# Tools" section
    const routingIdx = updatedPrompt.indexOf('# Routing');
    if (routingIdx > 0) {
      updatedPrompt = updatedPrompt.slice(0, routingIdx) + SHOW_CARDS_PROMPT_SECTION + '\n\n' + updatedPrompt.slice(routingIdx);
    } else {
      updatedPrompt += '\n' + SHOW_CARDS_PROMPT_SECTION;
    }
    console.log('Added show_cards section to prompt');
  } else {
    console.log('show_cards section already in prompt');
  }

  // Step 4: PATCH the agent
  console.log('Patching agent...');
  const patchResp = await fetch(API, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            prompt: updatedPrompt,
            tools,
          },
        },
      },
    }),
  });

  if (patchResp.ok) {
    const result = await patchResp.json();
    const updatedTools = result.conversation_config?.agent?.prompt?.tools || [];
    const updatedPromptLen = result.conversation_config?.agent?.prompt?.prompt?.length;

    console.log('\n=== VERIFICATION ===');
    console.log('Tools:', updatedTools.map(t => `${t.name} (${t.type})`).join(', '));
    console.log('show_cards present:', updatedTools.some(t => t.name === 'show_cards'));
    console.log('Prompt length:', updatedPromptLen, 'chars');
    console.log('Prompt contains show_cards section:', result.conversation_config?.agent?.prompt?.prompt?.includes('## show_cards'));
    console.log('\nDone! Ava will now call show_cards when Adam returns research results.');
  } else {
    console.error('PATCH failed:', patchResp.status);
    console.error(await patchResp.text());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
