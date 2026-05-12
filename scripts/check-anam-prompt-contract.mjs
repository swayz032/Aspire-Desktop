// Verify the new ava-anam-video-prompt.md passes all contract invariants.
// Imports the validator from routes.ts compiled output? No — too heavy.
// Inlines the same checks for fast spot-test. Keep in sync with routes.ts:243.
//
// Usage: node scripts/check-anam-prompt-contract.mjs

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const PROMPT_PATH = path.resolve('./server/prompts/ava-anam-video-prompt.md');
const rawPrompt = await readFile(PROMPT_PATH, 'utf8');
const errors = [];

const normalizedPrompt = rawPrompt.toLowerCase();

// Legacy checks
if (!normalizedPrompt.includes('## search') && !normalizedPrompt.includes('## ava_search')) {
  errors.push('Missing ## search / ## ava_search section');
}
if (normalizedPrompt.includes('transfer to specialist agents immediately')) errors.push('Banned: transfer language');
if (normalizedPrompt.includes('switch to voice mode')) errors.push('Banned: voice-mode handoff');

// Wave 3 baseline
if (!/American English only|Always respond in English/i.test(rawPrompt)) errors.push('Missing language lock');
const head4500 = rawPrompt.slice(0, 4500);
if (!head4500.includes('show_cards is required after invoke_adam') && !head4500.includes('## CRITICAL — show_cards is required') && !head4500.includes('## CRITICAL - show_cards is required')) {
  errors.push('Missing show_cards mandate in first 4500 chars');
}
if (!rawPrompt.includes('## NEVER SAY')) errors.push('Missing ## NEVER SAY block');

const tokens = Math.floor(rawPrompt.length / 4);
if (tokens > 4000) errors.push(`Token count ${tokens} > 4000 (contract limit)`);
else if (tokens > 3500) errors.push(`Token count ${tokens} > 3500 warning threshold`);

// Block extractor
const extractBlock = (header) => {
  const re = new RegExp(`^# ${header}\\s*$`, 'm');
  const start = rawPrompt.search(re);
  if (start === -1) return '';
  const after = rawPrompt.slice(start + 1);
  const nextH1 = after.search(/^# [A-Z]/m);
  return nextH1 === -1 ? rawPrompt.slice(start) : rawPrompt.slice(start, start + 1 + nextH1);
};

const personality = extractBlock('Personality');
const environment = extractBlock('Environment');
const tone = extractBlock('Tone');
const goal = extractBlock('Goal');
const guardrails = extractBlock('Guardrails');

for (const [name, block] of [['Personality', personality], ['Environment', environment], ['Tone', tone], ['Goal', goal], ['Guardrails', guardrails]]) {
  if (!block) errors.push(`S-1: missing block "# ${name}"`);
}

// F-1 hardcoded names
const banned = [/\bMr\.\s*Scott\b/, /\bMrs\.\s*McCoy\b/, /\bMr\.\s*Cory\b/, /\bTonio\b/, /\bTony\b/, /\bMcCoy\b/];
for (const p of banned) {
  if (p.test(rawPrompt)) errors.push(`F-1: hardcoded name matched: ${p}`);
}

// F-2 unresolved placeholders
if (rawPrompt.includes('{{voiceHandoffBrief}}')) errors.push('F-2: {{voiceHandoffBrief}} unresolved');
if (rawPrompt.includes('[VOICE HANDOFF CONTEXT]')) errors.push('F-2: [VOICE HANDOFF CONTEXT] literal block');

// P-1 language lock first 250 chars of personality body
if (personality) {
  const phead = personality.replace(/^# Personality\s*\n+/, '').slice(0, 250);
  if (!/American English only|Always respond in English/i.test(phead)) errors.push('P-1: language lock not at top of Personality body');
}

// E-4 length cap NOT in Environment
if (environment && /Under 40 words|Keep responses? under 40 words/i.test(environment)) errors.push('E-4: length cap in Environment (belongs in Tone)');

// T-1 length cap IN Tone
if (tone && !/Under 40 words/i.test(tone)) errors.push('T-1: Tone missing length cap');

// G-1 WORKFLOW TRIGGER RULE in Goal first 1700 chars
if (goal) {
  if (!/WORKFLOW TRIGGER RULE/i.test(goal.slice(0, 1700))) errors.push('G-1: Goal missing WORKFLOW TRIGGER RULE in head');
}

// G-5 KB doc references (need >= 3 of 4)
const docs = ['Ava_Voice_Rules_v6', 'Strategic_Playbook_v6', 'Tools_and_Cards_v6', 'Invoicing_and_Quotes_v6'];
const missing = docs.filter(d => !rawPrompt.includes(d));
if (missing.length > 1) errors.push(`G-5: missing KB doc refs: ${missing.join(', ')}`);

// GD-2 AI self-reference in Guardrails first 2000 chars (NEVER SAY block expanded)
if (guardrails) {
  if (!/Never discuss being an AI/i.test(guardrails.slice(0, 2000))) errors.push('GD-2: Guardrails missing AI self-reference rule in head');
}

console.log(`\n=== Anam Ava Prompt Contract Check ===`);
console.log(`File: ${PROMPT_PATH}`);
console.log(`Total chars: ${rawPrompt.length}`);
console.log(`Estimated tokens: ${tokens}`);
console.log(`Block sizes — Personality:${personality.length} Environment:${environment.length} Tone:${tone.length} Goal:${goal.length} Guardrails:${guardrails.length}`);
console.log(`KB docs referenced: ${4 - missing.length}/4 ${missing.length ? `(missing: ${missing.join(',')})` : ''}`);
console.log(``);

if (errors.length === 0) {
  console.log(`✓ PASS — all contract invariants satisfied`);
  process.exit(0);
} else {
  console.log(`✗ FAIL — ${errors.length} violation(s):`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
