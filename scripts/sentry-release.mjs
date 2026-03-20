import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

const target = process.argv[2] ?? 'web';
const release =
  process.env.EXPO_PUBLIC_ASPIRE_RELEASE ||
  process.env.ASPIRE_RELEASE ||
  process.env.RAILWAY_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  `aspire-desktop@${packageJson.version}`;
const environment =
  process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ||
  process.env.ASPIRE_ENV ||
  process.env.NODE_ENV ||
  'production';
const authToken = process.env.SENTRY_AUTH_TOKEN || '';
const org = process.env.SENTRY_ORG || '';
const sentryUrl = process.env.SENTRY_URL || process.env.SENTRY_BASE_URL || '';
const project =
  process.env.SENTRY_PROJECT_DESKTOP_CLIENT ||
  process.env.SENTRY_PROJECT_ASPIRE_DESKTOP_CLIENT ||
  process.env.SENTRY_PROJECT ||
  '';
const distDir = path.join(projectRoot, 'dist');

function runCli(args, { allowFailure = false } = {}) {
  const result = spawnSync('npx', ['--yes', '@sentry/cli', ...args], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`sentry-cli failed for args: ${args.join(' ')}`);
  }

  return result.status ?? 0;
}

if (target !== 'web') {
  console.log(`[sentry-release] Unsupported target "${target}" - skipping.`);
  process.exit(0);
}

if (!authToken || !org || !project) {
  console.log('[sentry-release] Missing Sentry auth/org/project - skipping upload.');
  process.exit(0);
}

if (!existsSync(distDir)) {
  console.log(`[sentry-release] Build output not found at ${distDir} - skipping upload.`);
  process.exit(0);
}

process.env.SENTRY_AUTH_TOKEN = authToken;
process.env.SENTRY_ORG = org;
process.env.SENTRY_PROJECT = project;
if (sentryUrl) {
  process.env.SENTRY_URL = sentryUrl;
}

try {
  runCli(['releases', 'info', release], { allowFailure: true });
  runCli(['releases', 'new', release], { allowFailure: true });
  runCli(['releases', 'set-commits', release, '--auto'], { allowFailure: true });
  runCli(['releases', 'files', release, 'upload-sourcemaps', distDir, '--url-prefix', '~/', '--rewrite']);
  runCli(['releases', 'finalize', release], { allowFailure: true });
  runCli(['releases', 'deploys', release, 'new', '-e', environment], { allowFailure: true });
  console.log(`[sentry-release] Uploaded sourcemaps for ${release}`);
} catch (error) {
  console.warn('[sentry-release] Upload failed:', error instanceof Error ? error.message : error);
  process.exit(0);
}
