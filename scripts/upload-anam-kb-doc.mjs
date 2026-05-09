// Upload Anam KB v6 documents to the canonical folders.
//
// Reads folder-ids.json and the local v6 source tree, performs the 3-step
// presigned-URL upload pattern for each doc, then polls for READY status.
//
// Usage:
//   ANAM_API_KEY=... node scripts/upload-anam-kb-doc.mjs
//   ANAM_API_KEY=... node scripts/upload-anam-kb-doc.mjs --dry-run
//   ANAM_API_KEY=... node scripts/upload-anam-kb-doc.mjs --only Ava_Voice_Rules_v6.txt

import process from 'node:process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

const BASE = 'https://api.anam.ai/v1';
const ROOT = path.resolve('./server/kb/ava/v6');
const CONFIG_PATH = path.join(ROOT, 'folder-ids.json');

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

// Map folder canonical name → { folderId, docs[] } from config
const uploads = [];
for (const [key, folder] of Object.entries(config.folders)) {
  for (const docFilename of folder.docs) {
    if (only && docFilename !== only) continue;
    uploads.push({
      folderKey: key,
      folderId: folder.id,
      folderName: folder.name,
      filename: docFilename,
      localPath: path.join(ROOT, key.replace(/_/g, '-'), docFilename),
    });
  }
}

console.log(`\nFound ${uploads.length} doc(s) to upload:`);
for (const u of uploads) {
  try {
    const s = await stat(u.localPath);
    console.log(`  ${u.filename} (${s.size} bytes) → ${u.folderName}`);
  } catch {
    console.log(`  ${u.filename} (MISSING at ${u.localPath}) → ${u.folderName}`);
  }
}

if (dryRun) {
  console.log('\n--dry-run: no uploads performed.');
  process.exit(0);
}

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
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${p} → ${r.status}: ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
  return body;
}

async function uploadOne(u) {
  console.log(`\n→ ${u.filename}`);
  const fileBuf = await readFile(u.localPath);
  const fileSize = fileBuf.length;

  // Step 1 — request presigned upload URL
  console.log(`  step 1: presigned-upload …`);
  const presigned = await api(`/knowledge/groups/${u.folderId}/documents/presigned-upload`, {
    method: 'POST',
    body: JSON.stringify({
      filename: u.filename,
      contentType: 'text/plain',
      fileSize,
    }),
  });
  const uploadUrl = presigned.uploadUrl;
  const documentId = presigned.documentId;
  if (!uploadUrl || !documentId) throw new Error(`Missing uploadUrl/documentId in presigned response`);

  // Step 2 — PUT file to signed URL (no auth header — signed URL carries auth)
  console.log(`  step 2: PUT file to signed URL …`);
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain' },
    body: fileBuf,
  });
  if (!putRes.ok) {
    const errBody = await putRes.text();
    throw new Error(`PUT failed: ${putRes.status} :: ${errBody.slice(0, 300)}`);
  }

  // Step 3 — confirm upload
  console.log(`  step 3: confirm-upload …`);
  await api(`/knowledge/documents/${documentId}/confirm-upload`, {
    method: 'POST',
    body: JSON.stringify({ fileSize }),
  });

  // Step 4 — poll for READY (typically <30s)
  console.log(`  step 4: poll READY status …`);
  const start = Date.now();
  const POLL_MS = 2000;
  const MAX_WAIT = 90000;
  while (Date.now() - start < MAX_WAIT) {
    const detail = await api(`/knowledge/documents/${documentId}`);
    const status = String(detail.status || '').toUpperCase();
    if (status === 'READY') {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ✓ READY in ${elapsed}s (size=${detail.fileSize})`);
      return { documentId, fileSize: detail.fileSize, status: 'READY' };
    }
    if (status === 'FAILED') {
      throw new Error(`Document FAILED: ${detail.errorMessage || 'unknown'}`);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timed out waiting for READY status after ${MAX_WAIT}ms`);
}

const results = [];
let hadError = false;
for (const u of uploads) {
  try {
    const r = await uploadOne(u);
    results.push({ filename: u.filename, folder: u.folderName, ...r });
  } catch (e) {
    hadError = true;
    results.push({ filename: u.filename, folder: u.folderName, status: 'ERROR', error: String(e.message || e) });
    console.error(`  ✗ FAILED: ${e.message}`);
  }
}

console.log('\n=== UPLOAD SUMMARY ===');
console.table(results);
process.exit(hadError ? 1 : 0);
