// Diagnose: read Anam's live invoke_adam definition and report key fields.
// Usage: ANAM_API_KEY=... node scripts/check-anam-tool-defs.mjs
const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
async function api(p) {
  const r = await fetch('https://api.anam.ai/v1' + p, { headers: { Authorization: 'Bearer ' + apiKey } });
  if (!r.ok) throw new Error(p + ' -> ' + r.status);
  return r.json();
}
const d = await api('/tools?perPage=200');
const tools = d.data || d;
const targets = ['invoke_adam', 'invoke_quinn', 'invoke_tec', 'invoke_clara'];
for (const name of targets) {
  const t = tools.find(x => x.name === name);
  if (!t) { console.log(`(${name}: not found)`); continue; }
  const c = t.config || t;
  const required = c.parameters?.required;
  console.log(`${name}: awaitResponse=${c.awaitResponse} disableInterruptions=${c.disableInterruptions || false} required=${JSON.stringify(required)}`);
}
