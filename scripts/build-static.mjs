import { spawn } from 'node:child_process';
import process from 'node:process';

const npxCommand = 'npx';

function sanitizeEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => !key.startsWith('=') && value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

function run(command, args, env = process.env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: sanitizeEnv(env),
      stdio: 'inherit',
      shell: options.shell ?? false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

// SECURITY GUARD (Aspire Law #3 — fail closed on auth bypass in prod).
// If someone tries to build for production with the dev auth bypass flag set,
// fail the build LOUDLY. The bypass should never appear in a deployable bundle.
// To intentionally produce a dev/synthetic bundle with the bypass, set
// ASPIRE_BUILD_FOR_LOCAL_DEV=true alongside EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true.
if (process.env.EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS === 'true') {
  if (process.env.ASPIRE_BUILD_FOR_LOCAL_DEV !== 'true') {
    console.error('');
    console.error('  [SECURITY] BUILD ABORTED');
    console.error('  EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true is set in this build env.');
    console.error('  Refusing to produce a deployable bundle with auth bypass enabled.');
    console.error('  - For production: UNSET EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS and rebuild.');
    console.error('  - For local-dev synthetic bundle: also set ASPIRE_BUILD_FOR_LOCAL_DEV=true.');
    console.error('');
    process.exit(1);
  }
  console.warn('');
  console.warn('  [SECURITY] Building with EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true');
  console.warn('  ASPIRE_BUILD_FOR_LOCAL_DEV=true acknowledged — DO NOT DEPLOY this bundle.');
  console.warn('');
}

const buildEnv = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
};

await run(npxCommand, ['expo', 'export', '-p', 'web', '--clear'], buildEnv, {
  shell: process.platform === 'win32',
});
await run(process.execPath, ['scripts/fix-viewport.js']);
await run(process.execPath, ['scripts/copy-worklets.js']);
