// One-shot diagnostic: list all Anam knowledge groups + documents.
// Usage: ANAM_API_KEY=... node scripts/check-anam-kb.mjs
import process from 'node:process';
const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
const BASE = 'https://api.anam.ai/v1';
async function api(p) {
  const r = await fetch(`${BASE}${p}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  if (!r.ok) throw new Error(`${p} -> ${r.status} :: ${typeof b === 'string' ? b.slice(0, 300) : JSON.stringify(b).slice(0, 300)}`);
  return b;
}
function list(p, k) { if (Array.isArray(p)) return p; if (p && Array.isArray(p[k])) return p[k]; if (p && Array.isArray(p.data)) return p.data; return []; }
const groups = list(await api('/knowledge/groups'), 'groups');
console.log(`\n=== ${groups.length} knowledge group(s) ===`);
for (const g of groups) {
  const docs = list(await api(`/knowledge/groups/${g.id}/documents`), 'documents');
  const ready = docs.filter(d => String(d?.status || '').toUpperCase() === 'READY').length;
  console.log(`\nGroup: "${g.name}" (id=${g.id})  docs=${docs.length}  ready=${ready}`);
  for (const d of docs) {
    const detail = await api(`/knowledge/documents/${d.id}`).catch(() => null);
    console.log(`  - id=${d?.id} status=${d?.status} keys=${detail ? Object.keys(detail).join(',') : 'N/A'}`);
    if (detail) {
      const display = detail.title || detail.displayName || detail.fileName || detail.name || detail.filename || detail.originalName || '?';
      const sizeChars = (detail.content || detail.text || '').length;
      console.log(`     name="${display}"  type=${detail.type || '?'}  contentChars=${sizeChars}`);
      const preview = (detail.content || detail.text || '').slice(0, 120).replace(/\s+/g, ' ');
      if (preview) console.log(`     preview: "${preview}…"`);
    }
  }
}
console.log('\n=== Knowledge_Ava tool config ===');
const tools = list(await api('/tools?perPage=200'), 'tools');
const kbTool = tools.find(t => t?.name === 'Knowledge_Ava');
if (!kbTool) { console.log('No Knowledge_Ava tool found.'); }
else {
  console.log(`name=${kbTool.name}  type=${kbTool.type}  id=${kbTool.id || kbTool._toolId}`);
  console.log(`folderIds=${JSON.stringify(kbTool.config?.documentFolderIds || kbTool.documentFolderIds || 'unknown')}`);
}
