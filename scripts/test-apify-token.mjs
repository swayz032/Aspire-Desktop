#!/usr/bin/env node
const TOKEN = process.env.ASPIRE_APIFY_API_KEY;
if (!TOKEN) { console.error('ASPIRE_APIFY_API_KEY missing'); process.exit(1); }
const USER_ID = 'RbpCNIByERlfm8EO3';

console.log(`Token length: ${TOKEN.length}`);
console.log(`Token prefix: ${TOKEN.slice(0, 6)}...${TOKEN.slice(-3)}`);

async function tryAuth(label, doFetch) {
  const t0 = Date.now();
  const r = await doFetch();
  const body = await r.text();
  const dt = Date.now() - t0;
  const verdict = r.ok ? '✅' : '❌';
  console.log(`${verdict} ${label.padEnd(40)} HTTP ${r.status} (${dt}ms)`);
  if (!r.ok) console.log('   body:', body.slice(0, 250));
  else if (body.length < 200) console.log('   body:', body);
  return { ok: r.ok, body };
}

console.log('\n=== AUTH MATRIX ===');
await tryAuth('1a. /users/me + ?token=', () =>
  fetch(`https://api.apify.com/v2/users/me?token=${TOKEN}`),
);
await tryAuth('1b. /users/me + Bearer header', () =>
  fetch('https://api.apify.com/v2/users/me', { headers: { Authorization: `Bearer ${TOKEN}` } }),
);
await tryAuth(`1c. /users/${USER_ID} + Bearer header`, () =>
  fetch(`https://api.apify.com/v2/users/${USER_ID}`, { headers: { Authorization: `Bearer ${TOKEN}` } }),
);
await tryAuth('1d. /acts (list yours) + Bearer', () =>
  fetch('https://api.apify.com/v2/acts?my=1&limit=1', { headers: { Authorization: `Bearer ${TOKEN}` } }),
);

console.log('\n=== ZILLOW ACTOR (Bearer header) ===');
await tryAuth('Zillow run-sync-get-dataset-items', () =>
  fetch('https://api.apify.com/v2/acts/maxcopell~zillow-detail-scraper/run-sync-get-dataset-items?timeout=60', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      addresses: ['17199 Park Ave, Sonoma, CA 95476'],
      propertyStatus: 'FOR_SALE',
    }),
  }),
);
console.log('\nDone.');
