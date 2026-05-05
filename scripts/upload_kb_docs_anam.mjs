// upload_kb_docs_anam.mjs — Upload the 3 canonical Ava KB docs to Anam.
//
// Mirror of upload_kb_docs.js (EL Ava). The Anam Ava persona uses the
// Knowledge_Ava SERVER_RAG tool to retrieve workflow steps, voice rules,
// and strategic playbook guidance at runtime. Without these docs in Anam's
// knowledge system, Knowledge_Ava returns nothing and Ava cannot follow
// canonical workflows like the Invoicing Workflow.
//
// Run: ANAM_API_KEY=... node scripts/upload_kb_docs_anam.mjs
//
// What it does:
//   1. Reads the 3 canonical KB .txt files from the repo root.
//   2. Finds (or creates) an "Ava" knowledge group on Anam.
//   3. Uploads each doc as text into that group, replacing prior versions
//      with the same name (delete-then-create — Anam doesn't expose update).
//   4. Polls until each doc is READY (Anam ingests + indexes asynchronously).
//   5. Prints a summary the operator can verify against the persona's
//      Knowledge_Ava tool config.
//
// After this script succeeds, run `pnpm sync-agent:ava` so the canonical
// sync rebuilds Knowledge_Ava with the now-READY folder IDs.
//
// Idempotency: re-running will replace docs by name. Safe to run repeatedly.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) {
  console.error('Set ANAM_API_KEY (e.g., `railway run pnpm exec node scripts/upload_kb_docs_anam.mjs`).');
  process.exit(1);
}

const BASE = 'https://api.anam.ai/v1';
const GROUP_NAME = 'Ava';
const READY_POLL_INTERVAL_MS = 2000;
const READY_POLL_MAX_ATTEMPTS = 60; // 2 minutes per doc

const DOCS = [
  { name: 'Task Workflows v3', file: 'kb_task_workflows.txt' },
  { name: 'Ava Strategic Playbook v2', file: 'kb_strategic_playbook.txt' },
  { name: 'Ava Voice Rules v5', file: 'kb_ava_voice_rules.txt' },
];

async function api(pathSuffix, init = {}) {
  const resp = await fetch(`${BASE}${pathSuffix}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!resp.ok) {
    throw new Error(`${init.method || 'GET'} ${pathSuffix} → ${resp.status} ${resp.statusText} :: ${typeof body === 'string' ? body : JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
}

function extractList(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function findOrCreateAvaGroup() {
  const groups = extractList(await api('/knowledge/groups'), 'groups');
  const existing = groups.find((g) => String(g?.name || '').trim().toLowerCase() === GROUP_NAME.toLowerCase());
  if (existing?.id) {
    console.log(`Group "${GROUP_NAME}" found: ${existing.id}`);
    return existing.id;
  }
  const created = await api('/knowledge/groups', {
    method: 'POST',
    body: JSON.stringify({ name: GROUP_NAME }),
  });
  if (!created?.id) throw new Error(`Group create returned no id: ${JSON.stringify(created)}`);
  console.log(`Group "${GROUP_NAME}" created: ${created.id}`);
  return created.id;
}

async function listDocsInGroup(groupId) {
  const payload = await api(`/knowledge/groups/${groupId}/documents`);
  return extractList(payload, 'documents');
}

async function deleteDocByName(groupId, docName) {
  const docs = await listDocsInGroup(groupId);
  const matches = docs.filter((d) => String(d?.name || '').trim() === docName);
  for (const doc of matches) {
    if (!doc?.id) continue;
    await api(`/knowledge/documents/${doc.id}`, { method: 'DELETE' });
    console.log(`  Deleted prior version of "${docName}" (${doc.id}).`);
  }
}

async function uploadDoc(groupId, doc) {
  const filePath = resolve(repoRoot, doc.file);
  const content = readFileSync(filePath, 'utf-8');
  console.log(`Uploading "${doc.name}" (${content.length} chars) from ${doc.file}…`);

  await deleteDocByName(groupId, doc.name);

  const created = await api(`/knowledge/groups/${groupId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      name: doc.name,
      type: 'TEXT',
      content,
    }),
  });
  const docId = created?.id;
  if (!docId) throw new Error(`Doc create returned no id: ${JSON.stringify(created)}`);
  console.log(`  Created "${doc.name}": ${docId}`);

  for (let attempt = 1; attempt <= READY_POLL_MAX_ATTEMPTS; attempt++) {
    const status = String(((await api(`/knowledge/documents/${docId}`))?.status || '')).toUpperCase();
    if (status === 'READY') {
      console.log(`  "${doc.name}" READY (after ${attempt} poll${attempt === 1 ? '' : 's'}).`);
      return docId;
    }
    if (status === 'ERROR' || status === 'FAILED') {
      throw new Error(`Doc "${doc.name}" ingestion ${status}.`);
    }
    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
  }
  throw new Error(`Doc "${doc.name}" did not reach READY within ${(READY_POLL_INTERVAL_MS * READY_POLL_MAX_ATTEMPTS) / 1000}s.`);
}

async function main() {
  const groupId = await findOrCreateAvaGroup();
  const uploadedIds = [];
  for (const doc of DOCS) {
    const id = await uploadDoc(groupId, doc);
    uploadedIds.push({ ...doc, id });
    console.log('');
  }

  const final = await listDocsInGroup(groupId);
  console.log('=== Final docs in "Ava" group ===');
  final.forEach((d) => {
    console.log(`  ${String(d?.name || '?')} — ${String(d?.status || '?')} (${String(d?.id || '?')})`);
  });
  console.log('');
  console.log('Next step:');
  console.log('  pnpm sync-agent:ava');
  console.log('Re-running the canonical sync rebuilds Knowledge_Ava with the now-READY folder.');
}

main().catch((e) => {
  console.error('[upload-anam-kb] FAILED:', e?.message || e);
  process.exit(1);
});
