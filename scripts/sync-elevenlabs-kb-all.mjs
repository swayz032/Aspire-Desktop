#!/usr/bin/env node
/**
 * Push ALL KB docs to all 6 ElevenLabs agents using the workspace-level
 * /v1/convai/knowledge-base/text endpoint, then attach to each agent's
 * conversation_config.agent.prompt.knowledge_base array.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-kb-all.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
if (!API_KEY) {
  console.error('No ELEVENLABS_API_KEY in env. Aborting.');
  process.exit(1);
}

const BASE = 'https://api.elevenlabs.io/v1';

// Per-agent KB doc inventory (agent_id, docs folder, file list).
const AGENTS = [
  {
    name: 'ava',
    agent_id: 'agent_1201kmqdjgxvfxxteedpkvjej7er',
    folder: 'ava',
    files: ['03_AVA_KB_OFFICE_BRIEF.md', '04_AVA_KB_HANDOFF_PROTOCOL.md'],
  },
  {
    name: 'finn',
    agent_id: 'agent_2201kmqdjjyben0tyg2t5eexnmzg',
    folder: 'finn',
    files: [
      '02_FINN_VOICE_RULES_v1.md',
      '03_FINN_TASK_WORKFLOWS_v1.md',
      '04_FINN_STRATEGIC_PLAYBOOK_v1.md',
      '05_FINANCE_HUB_CANON_v1.md',
    ],
  },
  {
    name: 'eli',
    agent_id: 'agent_4201kmqdjm1tfhfaggnnfjax3m6d',
    folder: 'eli',
    files: [
      '02_ELI_VOICE_RULES_v1.md',
      '03_ELI_TASK_WORKFLOWS_v1.md',
      '04_ELI_INBOX_TRIAGE_ENGINE_v1.md',
      '05_ELI_COMMUNICATIONS_JUDGMENT_PLAYBOOK_v1.md',
      '06_ELI_MAILBOX_AND_GOVERNANCE_CANON_v1.md',
    ],
  },
  {
    name: 'nora',
    agent_id: 'agent_1901kmqdjmwmfqg9rqr5jngfydnw',
    folder: 'nora',
    files: [
      '02_NORA_VOICE_RULES_v1.md',
      '03_NORA_MEETING_WORKFLOWS_v1.md',
      '04_NORA_CONFERENCE_INTELLIGENCE_PLAYBOOK_v1.md',
      '05_NORA_RECAP_PACKET_CANON_v1.md',
      '06_NORA_PRIVACY_AND_SHARING_CANON_v1.md',
      '07_NORA_BRIEFING_AND_RESEARCH_TRIGGER_POLICY_v1.md',
      '08_NORA_TEAM_ROUTING_POLICY_v1.md',
      '09_NORA_MEETING_PURPOSE_PRESETS_v1.md',
      '10_NORA_START_POLICY_AND_TRANSCRIPT_ARCHITECTURE_v1.md',
      '11_NORA_OFFICE_INBOX_AND_OFFICE_MEMORY_POLICY_v1.md',
      '12_NORA_CONFERENCE_AUTHORITY_QUEUE_POLICY_v1.md',
    ],
  },
  {
    name: 'sarah-receptionist',
    agent_id: 'agent_6501kp71h69jfqysgd055hemqhrq',
    folder: 'sarah-receptionist',
    files: [
      '02_RECEPTIONIST_SARAH_VOICE_RULES_v2.md',
      '03_RECEPTIONIST_SARAH_CALL_WORKFLOWS_v2.md',
      '04_RECEPTIONIST_SARAH_MESSAGE_CAPTURE_CANON_v2.md',
      '05_RECEPTIONIST_SARAH_ROUTING_AND_TRANSFER_POLICY_v2.md',
      '06_RECEPTIONIST_SARAH_SAFETY_AND_PRIVACY_CANON_v2.md',
    ],
  },
  {
    name: 'sarah-frontdesk',
    agent_id: 'agent_8901kmqdjnrte7psp6en4f85m4kt',
    folder: 'sarah-frontdesk',
    files: [
      '02_FRONT_DESK_SARAH_FIRST_MESSAGES_v1.md',
      '03_FRONT_DESK_SARAH_CUSTOM_WORKFLOW_SPEC_v1.md',
      '04_FRONT_DESK_SARAH_SETTINGS_AND_SYSTEM_TOOLS_v1.md',
      '05_Front_Desk_Sarah_Voice_Rules_v1.md',
      '06_Front_Desk_Sarah_Call_Desk_Workflows_v1.md',
      '07_Front_Desk_Sarah_Triage_Engine_v1.md',
      '08_Front_Desk_Sarah_Callback_and_Followup_Canon_v1.md',
      '09_Front_Desk_Sarah_Telephony_Governance_Canon_v1.md',
    ],
  },
];

async function api(method, p, body) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${method} ${p}: ${text.slice(0, 300)}`);
  }
  try { return JSON.parse(text); } catch { return text; }
}

async function pushKbDoc(name, text) {
  const out = await api('POST', '/convai/knowledge-base/text', { name, text });
  return out.id;
}

async function attachKbToAgent(agentId, kbList) {
  // Get current state
  const agent = await api('GET', `/convai/agents/${agentId}`);
  // Merge: existing KB + new (deduped by name)
  const existing = agent?.conversation_config?.agent?.prompt?.knowledge_base || [];
  const existingNames = new Set(existing.map((k) => k.name));
  const merged = [...existing];
  for (const kb of kbList) {
    if (!existingNames.has(kb.name)) {
      merged.push({ id: kb.id, type: 'file', name: kb.name, usage_mode: 'auto' });
    }
  }
  await api('PATCH', `/convai/agents/${agentId}`, {
    conversation_config: { agent: { prompt: { knowledge_base: merged } } },
  });
  return merged.length;
}

async function syncAgent(agent) {
  console.log(`\n=== ${agent.name} (${agent.agent_id}) ===`);
  const kbDocs = [];
  for (const file of agent.files) {
    const filePath = path.join(ROOT, 'docs/agents', agent.folder, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP missing: ${file}`);
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf-8');
    const name = file.replace(/\.md$/, '');
    try {
      const id = await pushKbDoc(name, text);
      console.log(`  ✓ ${name} → ${id}`);
      kbDocs.push({ id, name });
    } catch (e) {
      console.error(`  ✗ ${name} push failed: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  if (kbDocs.length === 0) {
    console.log(`  No KB docs to attach.`);
    return;
  }
  try {
    const total = await attachKbToAgent(agent.agent_id, kbDocs);
    console.log(`  ✓ Attached ${kbDocs.length} new docs (agent total: ${total})`);
  } catch (e) {
    console.error(`  ✗ Attach failed: ${String(e.message || e).slice(0, 300)}`);
  }
}

(async () => {
  console.log(`Pushing KB docs to ${AGENTS.length} agents...`);
  for (const agent of AGENTS) {
    await syncAgent(agent);
  }
  console.log('\nAll done.');
})();
