// Quick sanity test: extract the validator from routes.ts and run it against
// the current prompt file. Confirms GD-8 / GD-9 / contract invariants pass
// without needing to spin up the full server.
//
// Usage: node scripts/test-anam-prompt-validator.mjs

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const promptPath = resolve('./server/prompts/ava-anam-video-prompt.md');
const rawPrompt = await readFile(promptPath, 'utf8');
const normalizedPrompt = rawPrompt.toLowerCase();

const errors = [];

// Replicate the validator logic from routes.ts:243-540 inline (no TS imports
// to avoid the cross-file type errors that block tsc on unrelated files).

// Pre-existing checks
if (!normalizedPrompt.includes('## search') && !normalizedPrompt.includes('## ava_search')) {
  errors.push('missing search tool section');
}
if (normalizedPrompt.includes('transfer to specialist agents immediately')) errors.push('forbidden transfer phrase');
if (normalizedPrompt.includes('switch to voice mode')) errors.push('forbidden voice-mode phrase');
if (!/American English only|Always respond in English/i.test(rawPrompt)) errors.push('missing language lock');

const promptHead = rawPrompt.slice(0, 4500);
if (!(promptHead.includes('show_cards is required after invoke_adam') || promptHead.includes('## CRITICAL — show_cards is required'))) {
  errors.push('missing show_cards mandate in first 4500 chars');
}
if (!rawPrompt.includes('## NEVER SAY')) errors.push('missing NEVER SAY block');

const tokens = Math.floor(rawPrompt.length / 4);
if (tokens > 4500) errors.push(`tokens ${tokens} > 4500 hard ceiling`);

const extractBlock = (header) => {
  const re = new RegExp(`^# ${header}\\s*$`, 'm');
  const start = rawPrompt.search(re);
  if (start === -1) return '';
  const after = rawPrompt.slice(start + 1);
  const nextH1 = after.search(/^# [A-Z]/m);
  return nextH1 === -1 ? rawPrompt.slice(start) : rawPrompt.slice(start, start + 1 + nextH1);
};

const blocks = {
  Personality: extractBlock('Personality'),
  Environment: extractBlock('Environment'),
  Tone: extractBlock('Tone'),
  Goal: extractBlock('Goal'),
  Guardrails: extractBlock('Guardrails'),
};
for (const [name, block] of Object.entries(blocks)) {
  if (!block) errors.push(`S-1: missing block # ${name}`);
}

// F-1
const F1 = [
  { p: /\bMr\.\s*Scott\b/, l: 'Mr. Scott' },
  { p: /\bMrs\.\s*McCoy\b/, l: 'Mrs. McCoy' },
  { p: /\bMr\.\s*Cory\b/, l: 'Mr. Cory' },
  { p: /\bTonio\b/, l: 'Tonio' },
  { p: /\bTony\b/, l: 'Tony' },
  { p: /\bMcCoy\b/, l: 'McCoy' },
];
for (const { p, l } of F1) if (p.test(rawPrompt)) errors.push(`F-1: hardcoded name "${l}"`);

// T-1, E-4, P-1, G-1, G-5, GD-2
if (blocks.Personality && !/American English only|Always respond in English/i.test(blocks.Personality.replace(/^# Personality\s*\n+/, '').slice(0, 250))) errors.push('P-1');
if (blocks.Environment && /Under 40 words|Keep responses? under 40 words/i.test(blocks.Environment)) errors.push('E-4');
if (blocks.Tone && !/Under 40 words/i.test(blocks.Tone)) errors.push('T-1');
if (blocks.Goal && !/WORKFLOW TRIGGER RULE/i.test(blocks.Goal.slice(0, 1700))) errors.push('G-1');
const kbDocs = ['Ava_Voice_Rules_v6', 'Strategic_Playbook_v6', 'Tools_and_Cards_v6', 'Invoicing_and_Quotes_v6'];
const missingKb = kbDocs.filter((n) => !rawPrompt.includes(n));
if (missingKb.length > 1) errors.push(`G-5: missing ${missingKb.length} KB doc refs (${missingKb.join(',')})`);
if (blocks.Guardrails && !/Never discuss being an AI/i.test(blocks.Guardrails.slice(0, 2000))) errors.push('GD-2');

// NEW: GD-8 + GD-9
const GD8 = [
  { p: /## INVOICING HARD RULES/i,        l: 'GD-8 heading' },
  { p: /BEFORE invoke_quinn lookup/i,     l: 'GD-8 name-verify' },
  { p: /EMAIL READ-BACK/i,                l: 'GD-8 email-readback' },
  { p: /EXACTLY TWICE/i,                  l: 'GD-8 quinn-count' },
  { p: /SINGLE-FIELD CORRECTION/i,        l: 'GD-8 no-restart' },
  { p: /SILENCE until the user speaks/i,  l: 'GD-8 silence' },
];
if (blocks.Guardrails) {
  for (const { p, l } of GD8) if (!p.test(blocks.Guardrails)) errors.push(`MISSING ${l}`);
}

const GD9 = [
  { p: /## RESEARCH HARD RULES/i,         l: 'GD-9 heading' },
  { p: /show_cards in the SAME turn/i,    l: 'GD-9 show_cards mandate' },
  { p: /Pass user_address VERBATIM/i,     l: 'GD-9 address verbatim' },
];
if (blocks.Guardrails) {
  for (const { p, l } of GD9) if (!p.test(blocks.Guardrails)) errors.push(`MISSING ${l}`);
}

console.log(`Prompt: ${promptPath}`);
console.log(`Size: ${rawPrompt.length} bytes / ${tokens} tokens`);
console.log(`Errors: ${errors.length}`);
if (errors.length === 0) {
  console.log('\n✅ ALL CONTRACT INVARIANTS PASS — prompt is contract-compliant.');
  process.exit(0);
} else {
  console.log('\n❌ FAILURES:');
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
