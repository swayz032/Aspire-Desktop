// Update the Knowledge_Ava tool: description + documentFolderIds.
// Usage: ANAM_API_KEY=... node scripts/update-anam-tool.mjs
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }

const BASE = 'https://api.anam.ai/v1';
const ROOT = path.resolve('./server/kb/ava/v6');
const config = JSON.parse(await readFile(path.join(ROOT, 'folder-ids.json'), 'utf8'));

const TOOL_ID = config.knowledgeToolId;
const FOLDER_IDS = Object.values(config.folders).map(f => f.id);

// 2026-05-11 (W12.6): description rewrite to stop brain leaking internal
// names. Old description contained phrases like "Quinn 11-step invoicing
// workflow" and "VOICE RULES, TOOLS AND CARDS, INVOICING AND QUOTES" —
// when the brain composed its pre-tool ack, it parroted those phrases
// directly to the user ("Let me check the invoicing workflow"). The new
// description is brain-facing only — describes WHEN to fire without
// putting internal system names into the brain's vocabulary.
const NEW_DESCRIPTION = `Look up Ava's operational guidance before answering any "how do I" question or starting any business workflow.

USE the user's exact request as the query string — for example "send an invoice", "create a quote", "show me hotels", "look up a property". The retrieval handles the rest.

CALL THIS FIRST for any operational, billing, scheduling, document, research, or process question — before answering from training data, before any other tool, before any specialist routing.

CALL ONCE per workflow — after the first retrieval, hold the workflow state in conversation memory and progress through the steps without re-fetching the same content.

When narrating to the user, never mention this tool, the retrieved document, or any internal system name. Speak only in the language of the user's domain.`;

async function api(p, opts = {}) {
  const r = await fetch(`${BASE}${p}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${p} → ${r.status}: ${typeof body === 'string' ? body.slice(0, 600) : JSON.stringify(body).slice(0, 600)}`);
  return body;
}

console.log(`\nUpdating Knowledge_Ava tool ${TOOL_ID}`);
console.log(`Folders to attach (${FOLDER_IDS.length}):`);
for (const [key, f] of Object.entries(config.folders)) {
  console.log(`  ${f.id}  ${f.name}`);
}

// Fetch current state for diff
const current = await api(`/tools/${TOOL_ID}`);
console.log(`\nCurrent state:`);
console.log(`  type: ${current.type}`);
console.log(`  current folderIds: ${JSON.stringify(current.config?.documentFolderIds || current.documentFolderIds || [])}`);
console.log(`  current description: ${(current.description || '').slice(0, 120)}…`);

// Try PUT first (matches folder-rename pattern)
console.log(`\nApplying update via PUT…`);
try {
  const updated = await api(`/tools/${TOOL_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      description: NEW_DESCRIPTION,
      config: {
        ...current.config,
        documentFolderIds: FOLDER_IDS,
      },
    }),
  });
  console.log(`✓ Updated`);
  console.log(`  new type: ${updated.type}`);
  console.log(`  new folderIds: ${JSON.stringify(updated.config?.documentFolderIds || updated.documentFolderIds || [])}`);
  console.log(`  new description starts: ${(updated.description || '').slice(0, 200)}…`);
} catch (e) {
  console.error(`✗ PUT failed: ${e.message}`);
  process.exit(1);
}
