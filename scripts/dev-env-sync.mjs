#!/usr/bin/env node
/**
 * dev-env-sync — Pulls the minimum local-dev secrets from Railway and
 * patches `.env`, only for keys that are currently empty.
 *
 * Idempotent. Safe to run repeatedly. Never commits real secrets — `.env`
 * is gitignored. Respects the secret-hygiene policy: prod values live in
 * Railway, local values are pulled on demand into `.env` so Metro/Express
 * can run without a chain of "missing key" errors.
 *
 * Usage:
 *   npm run dev:env        # only fill empty slots (default)
 *   npm run dev:env -- --force   # overwrite even non-empty values
 *
 * Requires: Railway CLI linked to project "Aspire OS" / service "Aspire-Desktop".
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');
const FORCE = process.argv.includes('--force');

// Minimum keys needed to load Estimate Studio + auth + autocomplete + aerial view.
// Order matters only for the human-readable summary.
const KEYS = [
  'EXPO_PUBLIC_SUPABASE_ANON_KEY', // client supabase init
  'SUPABASE_ANON_KEY',             // server alias
  'SUPABASE_SERVICE_ROLE_KEY',     // server admin auth
  'DATABASE_URL',                  // postgres pool
  'GOOGLE_MAPS_API_KEY',           // places autocomplete + aerial view (server)
  'EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_KEY', // street view + map3d + earth view (browser)
];

function check(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!check('railway --version')) {
  console.error('error: railway CLI not found on PATH');
  console.error('install: https://docs.railway.com/guides/cli');
  process.exit(1);
}

if (!existsSync(ENV_PATH)) {
  console.error(`error: ${ENV_PATH} does not exist`);
  process.exit(1);
}

console.log('Pulling keys from Railway (Aspire OS / Aspire-Desktop)...');

let railwayKv;
try {
  railwayKv = execSync('railway variables --service Aspire-Desktop --kv', {
    encoding: 'utf8',
  });
} catch (err) {
  console.error('error: railway variables call failed — is the project linked?');
  console.error('fix: railway link --project "Aspire OS" --service Aspire-Desktop --environment production');
  process.exit(1);
}

const railwayMap = new Map();
for (const line of railwayKv.split(/\r?\n/)) {
  const idx = line.indexOf('=');
  if (idx < 1) continue;
  railwayMap.set(line.slice(0, idx), line.slice(idx + 1));
}

const envText = readFileSync(ENV_PATH, 'utf8');
const envLines = envText.split(/\r?\n/);

const summary = [];
let mutated = false;

for (const key of KEYS) {
  const railwayValue = railwayMap.get(key);
  if (!railwayValue) {
    summary.push({ key, action: 'SKIP', reason: 'not in Railway' });
    continue;
  }

  const lineIdx = envLines.findIndex((l) => l.startsWith(`${key}=`));
  if (lineIdx === -1) {
    envLines.push(`${key}=${railwayValue}`);
    summary.push({ key, action: 'ADD', len: railwayValue.length });
    mutated = true;
    continue;
  }

  const currentValue = envLines[lineIdx].slice(key.length + 1);
  if (currentValue.length > 0 && !FORCE) {
    summary.push({ key, action: 'KEEP', len: currentValue.length });
    continue;
  }

  if (currentValue === railwayValue) {
    summary.push({ key, action: 'KEEP', len: currentValue.length });
    continue;
  }

  envLines[lineIdx] = `${key}=${railwayValue}`;
  summary.push({ key, action: FORCE && currentValue.length > 0 ? 'OVERWRITE' : 'FILL', len: railwayValue.length });
  mutated = true;
}

if (mutated) {
  writeFileSync(ENV_PATH, envLines.join('\n'));
}

console.log('');
console.log('Result:');
for (const row of summary) {
  const detail = row.len !== undefined ? `len=${row.len}` : (row.reason ?? '');
  console.log(`  ${row.action.padEnd(10)} ${row.key.padEnd(34)} ${detail}`);
}
console.log('');
console.log(mutated ? '.env updated. Restart Metro + Express to pick up changes.' : '.env unchanged.');
