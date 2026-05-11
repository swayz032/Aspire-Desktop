// Probe Anam session-related API endpoints to design the MCP server.
// Usage: ANAM_API_KEY=... node scripts/probe-anam-sessions.mjs
import process from 'node:process';
const KEY = process.env.ANAM_API_KEY;
if (!KEY) { console.error('Set ANAM_API_KEY'); process.exit(1); }

const BASE = 'https://api.anam.ai/v1';

async function probe(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, ...(opts.headers || {}) },
  });
  const text = await r.text();
  let preview = text.slice(0, 800);
  return { path, status: r.status, ok: r.ok, preview };
}

const probes = [
  '/sessions',
  '/sessions?limit=5',
  '/conversations',
  '/conversations?limit=5',
  '/personas/58f82b89-8ae7-43cc-930d-be8def14dff3/sessions',
  '/personas/58f82b89-8ae7-43cc-930d-be8def14dff3/conversations',
  '/analytics/sessions',
  '/insights',
];

console.log('=== Probing Anam session endpoints ===\n');
for (const p of probes) {
  const r = await probe(p);
  const icon = r.ok ? '✓' : (r.status === 404 ? '✗' : '?');
  console.log(`${icon} ${r.status}  GET ${p}`);
  if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 404)) {
    console.log(`   ${r.preview.replace(/\n/g, ' ').slice(0, 200)}`);
  }
}
