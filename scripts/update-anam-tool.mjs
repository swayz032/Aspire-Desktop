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

const NEW_DESCRIPTION = `Search Ava's internal Aspire KB across three domains:
(1) VOICE RULES — banned phrases, vocabulary, pacing, browse mode, response shapes (FETCH/PROBLEM/BROWSE/CONFIRMATION modes), how to phrase responses, narrating visual results, ending conversations;
(2) TOOLS AND CARDS — Adam research protocols, property/product/store/hotel/vendor card display rules, strategic advisory frameworks, address completeness, store disambiguation flow, browse mode after show_cards, error path;
(3) INVOICING AND QUOTES — Quinn 11-step invoicing workflow, customer-check flow, quote variant, customer onboarding mid-workflow, approval queue rules, common mistakes.

CALL THIS BEFORE answering any 'how do I...' or operational question, before any workflow guidance, before invoking Adam if the user is asking how-to vs asking for research, and before giving advice on Aspire processes.`;

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
