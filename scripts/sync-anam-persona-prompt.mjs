// Sync the lean ava-anam-video-prompt.md to the Anam Lab dashboard's stored
// persona systemPrompt. Without this, the desktop session-mint override is
// the ONLY place the new prompt is in effect — the Anam Lab UI still shows
// the old prompt for preview/test purposes, which causes drift between what
// devs see in the Lab and what production runs.
//
// Usage: ANAM_API_KEY=... node scripts/sync-anam-persona-prompt.mjs
//        ANAM_API_KEY=... node scripts/sync-anam-persona-prompt.mjs --dry-run
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }

const dryRun = process.argv.includes('--dry-run');
const BASE = 'https://api.anam.ai/v1';

const config = JSON.parse(await readFile(path.resolve('./server/kb/ava/v6/folder-ids.json'), 'utf8'));
const PERSONA_ID = config.personaId;

const promptPath = path.resolve('./server/prompts/ava-anam-video-prompt.md');
const promptText = await readFile(promptPath, 'utf8');

console.log(`\nPersona: ${PERSONA_ID}`);
console.log(`Prompt source: ${promptPath} (${promptText.length} chars / ~${Math.floor(promptText.length / 4)} tokens)`);

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

// Anam stores the systemPrompt at brain.systemPrompt (NOT top-level).
// Verified 2026-05-09 via probe-anam-persona.mjs.
const current = await api(`/personas/${PERSONA_ID}`);
const currentPrompt = (current.brain && current.brain.systemPrompt) || '';
console.log(`Current brain.systemPrompt: ${currentPrompt.length} chars / ~${Math.floor(currentPrompt.length / 4)} tokens`);
console.log(`Persona name: ${current.name}`);
console.log(`languageCode: ${current.languageCode}`);

if (dryRun) {
  console.log('\n--dry-run: no update sent.');
  console.log(`Would replace ${currentPrompt.length} chars with ${promptText.length} chars.`);
  process.exit(0);
}

console.log(`\nApplying update via PUT (brain.systemPrompt)…`);
try {
  const updated = await api(`/personas/${PERSONA_ID}`, {
    method: 'PUT',
    body: JSON.stringify({
      brain: {
        ...(current.brain || {}),
        systemPrompt: promptText,
      },
    }),
  });
  const newLen = ((updated.brain && updated.brain.systemPrompt) || '').length;
  console.log(`✓ Updated`);
  console.log(`  new brain.systemPrompt: ${newLen} chars`);
  console.log(`  updatedAt: ${updated.updatedAt}`);
  if (newLen !== promptText.length) {
    console.error(`✗ Length mismatch: expected ${promptText.length}, got ${newLen}`);
    process.exit(1);
  }
} catch (e) {
  console.error(`✗ PUT failed: ${e.message}`);
  process.exit(1);
}
