// Verify the Anam Lab dashboard prompt matches the local file.
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.ANAM_API_KEY;
if (!KEY) { console.error('Set ANAM_API_KEY'); process.exit(1); }

const localPath = path.resolve('./server/prompts/ava-anam-video-prompt.md');
const local = await readFile(localPath, 'utf8');

const r = await fetch('https://api.anam.ai/v1/personas/58f82b89-8ae7-43cc-930d-be8def14dff3', {
  headers: { Authorization: `Bearer ${KEY}` },
});
const o = await r.json();
const remote = (o.brain && o.brain.systemPrompt) || '';

const checks = [
  { name: 'invoicing workflow ban', pattern: 'Let me check the invoicing workflow' },
  { name: 'backstage machinery', pattern: 'backstage machinery' },
  { name: 'VOICE DELIVERY anchor', pattern: 'VOICE DELIVERY' },
  { name: 'WORKFLOW TRIGGER RULE', pattern: 'WORKFLOW TRIGGER RULE' },
  { name: 'show_cards is required', pattern: 'show_cards is required' },
];

console.log('=== Local vs Anam Lab prompt comparison ===\n');
console.log(`Local file:  ${local.length} chars`);
console.log(`Anam Lab:    ${remote.length} chars`);
console.log(`Anam Lab updatedAt: ${o.updatedAt}`);
console.log(`Persona name: ${o.name}`);
console.log(`languageCode: ${o.languageCode}`);
console.log('');
console.log('Content presence (local / Anam Lab):');
for (const c of checks) {
  const inLocal = local.includes(c.pattern);
  const inRemote = remote.includes(c.pattern);
  const icon = inLocal === inRemote ? '✓' : '✗';
  console.log(`  ${icon} ${c.name.padEnd(28)} local:${inLocal ? 'YES' : 'NO '}  remote:${inRemote ? 'YES' : 'NO '}`);
}
console.log('');
if (local.length !== remote.length) {
  console.log('⚠ Length mismatch — local and Anam Lab are NOT in sync.');
} else if (local === remote) {
  console.log('✓ IDENTICAL content.');
} else {
  console.log('⚠ Same length but content differs (likely CRLF vs LF normalization).');
}
