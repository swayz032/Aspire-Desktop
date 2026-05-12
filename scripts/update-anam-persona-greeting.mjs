// Set skipGreeting=true on the stored Anam Ava persona.
// Prevents the Anam-brain auto-greet from colliding with the iframe's
// deterministic client.talk() greeting (W12.4 fix). Without this, users
// hear "Good" (Anam auto-greet, cut off) then "Good evening, Mr. Scott"
// (iframe override 1500ms later).
import process from 'node:process';
const KEY = process.env.ANAM_API_KEY;
const PERSONA_ID = '58f82b89-8ae7-43cc-930d-be8def14dff3';

async function api(p, opts = {}) {
  const r = await fetch(`https://api.anam.ai/v1${p}`, {
    ...opts,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const t = await r.text();
  let b = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${p} → ${r.status}: ${(typeof b === 'string' ? b : JSON.stringify(b)).slice(0, 400)}`);
  return b;
}

const current = await api(`/personas/${PERSONA_ID}`);
console.log(`Before: skipGreeting=${current.skipGreeting}, uninterruptibleGreeting=${current.uninterruptibleGreeting}`);

const updated = await api(`/personas/${PERSONA_ID}`, {
  method: 'PUT',
  body: JSON.stringify({ skipGreeting: true, uninterruptibleGreeting: true }),
});
console.log(`After:  skipGreeting=${updated.skipGreeting}, uninterruptibleGreeting=${updated.uninterruptibleGreeting}`);
console.log(`updatedAt: ${updated.updatedAt}`);
