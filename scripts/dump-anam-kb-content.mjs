// One-shot: dump the actual content of every Anam KB doc to disk for audit.
// Usage: ANAM_API_KEY=... node scripts/dump-anam-kb-content.mjs
import process from 'node:process';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
const BASE = 'https://api.anam.ai/v1';
const OUT_DIR = path.resolve('./.scratch/anam-kb-audit');

async function api(p) {
  const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  if (!r.ok) throw new Error(`${p} -> ${r.status} :: ${typeof b === 'string' ? b.slice(0, 300) : JSON.stringify(b).slice(0, 300)}`);
  return b;
}

function list(p, k) {
  if (Array.isArray(p)) return p;
  if (p && Array.isArray(p[k])) return p[k];
  if (p && Array.isArray(p.data)) return p.data;
  return [];
}

await mkdir(OUT_DIR, { recursive: true });

const groups = list(await api('/knowledge/groups'), 'groups');
const summary = [];

for (const g of groups) {
  if (!g.name?.toLowerCase().includes('ava')) continue;
  console.log(`\n=== ${g.name} (${g.id}) ===`);
  const docs = list(await api(`/knowledge/groups/${g.id}/documents`), 'documents');
  for (const d of docs) {
    const detail = await api(`/knowledge/documents/${d.id}`);
    const filename = detail.filename || `${d.id}.txt`;
    const fileUrl = detail.fileUrl;
    if (!fileUrl) {
      console.log(`  - ${filename}: NO fileUrl`);
      continue;
    }
    const fr = await fetch(fileUrl);
    const text = await fr.text();
    const localPath = path.join(OUT_DIR, filename);
    await writeFile(localPath, text, 'utf8');
    const lines = text.split('\n');
    const headings = lines.filter(l => l.match(/^#{1,3} /)).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    console.log(`  - ${filename}: ${text.length} chars, ${lines.length} lines, ${headings} markdown headings, ${paragraphs} paragraphs`);
    summary.push({ folder: g.name, filename, chars: text.length, lines: lines.length, headings, paragraphs });
  }
}

console.log('\n=== SUMMARY ===');
console.table(summary);
console.log(`\nFiles dumped to: ${OUT_DIR}`);
