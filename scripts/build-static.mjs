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

const buildEnv = {
  ...process.env,
  NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
};

await run(npxCommand, ['expo', 'export', '-p', 'web', '--clear'], buildEnv, {
  shell: process.platform === 'win32',
});
await run(process.execPath, ['scripts/fix-viewport.js']);
await run(process.execPath, ['scripts/copy-worklets.js']);
