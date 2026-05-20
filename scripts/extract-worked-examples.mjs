// Surgical extraction: pull all "Worked Example" sections out of the 4 KB
// rule docs into a separate file. The KB docs uploaded to Anam will only
// contain rules; worked examples are for human/source-code reference only.
//
// Production lesson 2026-05-20 (transcript 22698af9): Anam's chunker was
// returning prose-style worked-example chunks instead of state-machine
// chunks, causing Ava to follow the OLD "Step 1 ... Step 11" workflow
// instead of the new state machine. Separating examples from rules fixes
// the retrieval pollution at the source.
//
// Usage: node scripts/extract-worked-examples.mjs

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KB_ROOT = path.resolve('./server/kb/ava/v6');

// Source docs and their start markers for the worked-examples block.
// Each rule doc has its worked examples at the bottom. We slice from the
// first "## WORKED EXAMPLE" / "## Worked Example" header through the
// next non-example top-level heading (or EOF if none follows).
const docs = [
  {
    file: path.join(KB_ROOT, 'ava-invoicing-and-quotes', 'Invoicing_and_Quotes_v6.txt'),
    label: 'Invoicing and Quotes',
    // Examples are followed by "## ESCALATION RULES" — preserve that.
    stopHeader: '## ESCALATION RULES',
  },
  {
    file: path.join(KB_ROOT, 'ava-tools-and-cards', 'Tools_and_Cards_v6.txt'),
    label: 'Tools and Cards',
    stopHeader: null, // examples are last in this doc
  },
  {
    file: path.join(KB_ROOT, 'ava-tools-and-cards', 'Strategic_Playbook_v6.txt'),
    label: 'Strategic Playbook',
    stopHeader: null,
  },
  {
    file: path.join(KB_ROOT, 'ava-voice-rules', 'Ava_Voice_Rules_v6.txt'),
    label: 'Voice Rules',
    stopHeader: null,
  },
];

const extractedSections = [];

for (const doc of docs) {
  const content = await readFile(doc.file, 'utf8');
  const lines = content.split('\n');

  // Find first worked-example header
  const startIdx = lines.findIndex((line) => /^## (WORKED EXAMPLE|Worked Example)/i.test(line));
  if (startIdx === -1) {
    console.log(`  ${doc.label}: no worked examples found, skipping`);
    continue;
  }

  // Find stop point: either the next non-example top-level header, or EOF
  let stopIdx = lines.length;
  if (doc.stopHeader) {
    const stopFound = lines.findIndex((line, i) => i > startIdx && line.startsWith(doc.stopHeader));
    if (stopFound !== -1) stopIdx = stopFound;
  }

  // Account for trailing horizontal rule before the next section
  let extractedEnd = stopIdx;
  if (stopIdx < lines.length) {
    // Walk back past blank lines and `---` separator so we don't leave dangling
    let k = stopIdx - 1;
    while (k > startIdx && (lines[k].trim() === '' || lines[k].trim() === '---')) k--;
    extractedEnd = k + 1;
  }

  const extracted = lines.slice(startIdx, extractedEnd).join('\n');
  extractedSections.push(`## ${doc.label} — Worked Examples\n\n${extracted}\n\n---\n`);

  // Remove the extracted block from the rule doc
  const before = lines.slice(0, startIdx).join('\n').replace(/[\s\n]+$/, '\n');
  const after = stopIdx < lines.length ? '\n' + lines.slice(stopIdx).join('\n') : '';
  const trimmed = before + after;
  await writeFile(doc.file, trimmed, 'utf8');

  const removedLines = extractedEnd - startIdx;
  console.log(`  ${doc.label}: removed ${removedLines} lines of worked examples → ${path.basename(doc.file)} (now ${trimmed.split('\n').length} lines)`);
}

// Write the consolidated examples file to source (NOT uploaded to Anam KB).
// Lives in docs/ so it's clearly out-of-band reference material.
const outFile = path.resolve('./docs/ava-worked-examples.md');
const docBody = `# Ava Worked Examples (Source Reference)\n\n` +
  `These transcripts illustrate the state machines defined in the canonical KB docs. They are NOT uploaded to the Anam KB — they exist here for human review and onboarding new contributors.\n\n` +
  `Why separated: production transcript 22698af9 (2026-05-20) showed Anam's chunker returning prose-style worked-example chunks instead of state-machine chunks. Ava then followed the OLD "Step 1 ... Step 11" workflow instead of the new state machine. Keeping worked examples out of the uploaded KB prevents this retrieval pollution.\n\n---\n\n` +
  extractedSections.join('\n');

await writeFile(outFile, docBody, 'utf8');
console.log(`\nWrote consolidated examples to ${outFile} (${docBody.length} chars / ~${Math.floor(docBody.length / 4)} tokens)`);
