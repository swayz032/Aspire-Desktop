/**
 * upload_kb_docs.js — Upload all 3 KB docs to Ava's ElevenLabs agent.
 *
 * Run: ELEVENLABS_API_KEY=... node scripts/upload_kb_docs.js
 */
const fs = require('fs');
const path = require('path');

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) { console.error('Set ELEVENLABS_API_KEY'); process.exit(1); }

const AGENT_ID = 'agent_1201kmqdjgxvfxxteedpkvjej7er';
const BASE = 'https://api.elevenlabs.io/v1';

const DOCS = [
  { name: 'Task Workflows v3', file: '../../kb_task_workflows.txt' },
  { name: 'Ava Strategic Playbook v2', file: '../../kb_strategic_playbook.txt' },
  { name: 'Ava Voice Rules v5', file: '../../kb_ava_voice_rules.txt' },
];

async function uploadDoc(doc) {
  const filePath = path.resolve(__dirname, doc.file);
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log(`Uploading ${doc.name} (${content.length} chars)...`);

  // Step 1: Create KB doc in workspace
  const createResp = await fetch(`${BASE}/convai/knowledge-base/text`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: doc.name, text: content }),
  });

  if (!createResp.ok) {
    const err = await createResp.text();
    console.error(`  FAILED to create ${doc.name}:`, createResp.status, err);
    return null;
  }

  const created = await createResp.json();
  const kbId = created.id;
  console.log(`  Created KB: ${kbId}`);

  // Step 2: Attach to agent
  const agentResp = await fetch(`${BASE}/convai/agents/${AGENT_ID}`, {
    headers: { 'xi-api-key': apiKey },
  });
  const agent = await agentResp.json();
  const existingKb = agent.conversation_config?.agent?.prompt?.knowledge_base || [];

  const patchResp = await fetch(`${BASE}/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: {
            knowledge_base: [...existingKb.map(kb => ({ type: 'file', id: kb.id, name: kb.name })), { type: 'file', id: kbId, name: doc.name }],
          },
        },
      },
    }),
  });

  if (patchResp.ok) {
    console.log(`  Attached ${doc.name} to Ava`);
    return kbId;
  } else {
    console.error(`  FAILED to attach:`, patchResp.status, await patchResp.text());
    return null;
  }
}

async function main() {
  for (const doc of DOCS) {
    await uploadDoc(doc);
    console.log('');
  }

  // Final verification
  const resp = await fetch(`${BASE}/convai/agents/${AGENT_ID}`, { headers: { 'xi-api-key': apiKey } });
  const agent = await resp.json();
  const kbs = agent.conversation_config?.agent?.prompt?.knowledge_base || [];
  console.log('=== FINAL KB LIST ===');
  kbs.forEach(kb => console.log(`  ${kb.name} (${kb.id})`));
  console.log(`\nTotal: ${kbs.length} KB docs attached`);
  console.log('\nIMPORTANT: Go to ElevenLabs dashboard and detach the OLD versions:');
  console.log('  - Task Workflows v2');
  console.log('  - Ava Strategic Playbook (original)');
  console.log('  - Ava Voice Rules v4');
  console.log('Then set the new v3/v2/v5 docs to "Always include in prompt".');
}

main().catch(e => console.error(e));
