import process from 'node:process';
const KEY = process.env.ANAM_API_KEY;
const r = await fetch('https://api.anam.ai/v1/personas/58f82b89-8ae7-43cc-930d-be8def14dff3', { headers: { Authorization: `Bearer ${KEY}` }});
const o = await r.json();
console.log('=== brain.systemPrompt verification ===');
const p = o.brain && o.brain.systemPrompt;
console.log('brain.systemPrompt length:', p ? p.length : 0);
console.log('First 300 chars:', p ? p.slice(0, 300) : '(empty)');
console.log('Contains "American English only":', p ? p.includes('American English only') : false);
console.log('Contains "Mr. Scott":', p ? p.includes('Mr. Scott') : false);
console.log('updatedAt:', o.updatedAt);
console.log('');

console.log('=== Top-level keys + previews ===');
for (const k of Object.keys(o)) {
  const v = o[k];
  if (typeof v === 'string') console.log(`  ${k}: STRING len=${v.length} ${v.slice(0, 100).replace(/\n/g, ' ')}${v.length > 100 ? '...' : ''}`);
  else if (Array.isArray(v)) console.log(`  ${k}: ARRAY len=${v.length} [${v.length ? typeof v[0] : ''}]`);
  else if (typeof v === 'object' && v !== null) console.log(`  ${k}: OBJECT keys=[${Object.keys(v).join(',')}]`);
  else console.log(`  ${k}: ${JSON.stringify(v)}`);
}
console.log('\n=== Looking specifically for prompt fields ===');
const candidates = ['systemPrompt', 'prompt', 'systemMessage', 'instructions', 'brain'];
for (const c of candidates) {
  if (c in o) console.log(`  HAS ${c}: ${typeof o[c] === 'string' ? `len=${o[c].length}` : JSON.stringify(o[c]).slice(0, 200)}`);
  else console.log(`  missing ${c}`);
}
