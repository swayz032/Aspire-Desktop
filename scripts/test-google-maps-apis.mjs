#!/usr/bin/env node
// Tests Google Cloud Maps API key against every endpoint Phase 3 Visuals needs.
// Run with: railway run --service Aspire-Desktop node scripts/test-google-maps-apis.mjs

const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) {
  console.error('GOOGLE_MAPS_API_KEY missing from env');
  process.exit(1);
}

const TEST_ADDRESS = '1234 Industrial Way, Austin, TX 78758';
const TEST_LAT = 37.4220;   // Mountain View — known Solar coverage
const TEST_LNG = -122.0841;

async function test(name, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    const dt = Date.now() - t0;
    const verdict = result.ok ? '✅' : '❌';
    console.log(`${verdict} ${name.padEnd(28)} ${result.status} (${dt}ms) ${result.note || ''}`);
    if (!result.ok && result.preview) console.log(`   preview: ${result.preview.slice(0, 200)}`);
  } catch (err) {
    console.log(`❌ ${name.padEnd(28)} EXCEPTION ${err.message}`);
  }
}

await test('Address Validation API', async () => {
  const r = await fetch(`https://addressvalidation.googleapis.com/v1:validateAddress?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: { addressLines: [TEST_ADDRESS] } }),
  });
  const body = await r.text();
  const ok = r.ok && !body.includes('"error"');
  return { ok, status: r.status, preview: body, note: ok ? `verdict captured` : 'check key + API enabled' };
});

await test('Geocoding API', async () => {
  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(TEST_ADDRESS)}&key=${KEY}`);
  const body = await r.text();
  const ok = r.ok && body.includes('"OK"');
  return { ok, status: r.status, preview: body, note: ok ? 'OK' : 'check API enabled' };
});

await test('Solar API (Mountain View)', async () => {
  const r = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${TEST_LAT}&location.longitude=${TEST_LNG}&requiredQuality=HIGH&key=${KEY}`);
  const body = await r.text();
  const ok = r.ok && body.includes('"name"');
  return { ok, status: r.status, preview: body, note: ok ? 'roof modelled' : 'check API enabled' };
});

await test('Maps Static API (satellite)', async () => {
  const r = await fetch(`https://maps.googleapis.com/maps/api/staticmap?center=${TEST_LAT},${TEST_LNG}&zoom=18&size=400x400&maptype=satellite&key=${KEY}`);
  const ct = r.headers.get('content-type') || '';
  const len = parseInt(r.headers.get('content-length') || '0');
  const ok = r.ok && ct.startsWith('image/');
  return { ok, status: r.status, note: ok ? `${len} bytes, ${ct}` : 'check API enabled' };
});

await test('Street View Static API', async () => {
  const r = await fetch(`https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodeURIComponent(TEST_ADDRESS)}&key=${KEY}`);
  const ct = r.headers.get('content-type') || '';
  const len = parseInt(r.headers.get('content-length') || '0');
  const ok = r.ok && ct.startsWith('image/');
  return { ok, status: r.status, note: ok ? `${len} bytes, ${ct}` : 'check API enabled' };
});

await test('Places API (New) Autocomplete', async () => {
  const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
    body: JSON.stringify({ input: '1234 Industrial Way Austin' }),
  });
  const body = await r.text();
  const ok = r.ok && body.includes('"suggestions"');
  return { ok, status: r.status, preview: body, note: ok ? 'has suggestions' : 'check API enabled' };
});

await test('Aerial View API (lookup)', async () => {
  const r = await fetch(`https://aerialview.googleapis.com/v1/videos:lookupVideo?address=${encodeURIComponent(TEST_ADDRESS)}&key=${KEY}`);
  const body = await r.text();
  // Aerial View may return PROCESSING or NOT_FOUND for unmodelled addresses — both confirm API is reachable
  const ok = r.ok || r.status === 404;
  return { ok, status: r.status, preview: body, note: r.ok ? 'video found/processing' : (r.status === 404 ? 'address not modelled (API works)' : 'check API enabled') };
});

await test('Map Tiles API (3D session)', async () => {
  const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US' }),
  });
  const body = await r.text();
  const ok = r.ok && body.includes('"session"');
  return { ok, status: r.status, preview: body, note: ok ? 'session minted' : 'check API enabled' };
});

await test('Maps JS API (script tag reachability)', async () => {
  const r = await fetch(`https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&v=weekly`);
  const body = await r.text();
  // Maps JS returns JS source; check for absence of error markers
  const hasError = body.includes('InvalidKeyMapError') || body.includes('ApiNotActivatedMapError');
  const ok = r.ok && body.length > 1000 && !hasError;
  return { ok, status: r.status, note: ok ? `${body.length} bytes JS bundle` : (hasError ? 'KEY INVALID OR API DISABLED' : 'unexpected response') };
});

console.log('\nDone.');
