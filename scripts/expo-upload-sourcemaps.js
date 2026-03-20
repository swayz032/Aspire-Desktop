#!/usr/bin/env node
/*
 * Upload Expo web sourcemaps to Sentry when CI provides credentials.
 * Safe no-op when required Sentry env vars are missing.
 */

const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const release = process.env.ASPIRE_RELEASE || process.env.EXPO_PUBLIC_ASPIRE_RELEASE || process.env.npm_package_version;
const distDir = process.env.EXPO_WEB_DIST_DIR || 'dist';
const required = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'];

const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.log('[sentry] Skipping sourcemap upload. Missing env:', missing.join(', '));
  process.exit(0);
}

if (!existsSync(distDir)) {
  console.log('[sentry] Skipping sourcemap upload. Dist folder not found:', distDir);
  process.exit(0);
}

function run(args) {
  const res = spawnSync('npx', ['sentry-cli', ...args], { stdio: 'inherit', shell: true, env: process.env });
  if (res.status !== 0) {
    throw new Error('sentry-cli failed: ' + args.join(' '));
  }
}

try {
  if (release) {
    run(['releases', 'new', release]);
    run(['releases', 'set-commits', release, '--auto']);
  }
  run(['sourcemaps', 'inject', distDir]);
  run(['sourcemaps', 'upload', '--org', process.env.SENTRY_ORG, '--project', process.env.SENTRY_PROJECT, distDir]);
  if (release) {
    run(['releases', 'finalize', release]);
  }
  console.log('[sentry] Sourcemap upload complete');
} catch (err) {
  console.error('[sentry] Sourcemap upload failed:', err.message);
  process.exit(1);
}
