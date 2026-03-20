import { spawn } from 'node:child_process';
import process from 'node:process';

const npmCmd = process.platform === 'win32' ? 'npm' : 'npm';
const mode = process.env.ASPIRE_E2E_MODE === 'public' ? 'public' : 'auth';
const port = process.env.E2E_PORT || '4173';

function sanitizeEnv(env) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => !key.startsWith('=') && value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)]),
  );
}

function withBuildEnv() {
  const env = {
    ...process.env,
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_ASPIRE_RELEASE: `e2e-${mode}`,
    EXPO_PUBLIC_ASPIRE_SYNTHETIC_ENV: mode === 'auth' ? 'local-smoke' : 'local-public-smoke',
    EXPO_PUBLIC_SENTRY_ENVIRONMENT: 'e2e',
    E2E_PORT: port,
  };

  if (mode === 'auth') {
    env.EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS = 'true';
    env.EXPO_PUBLIC_SUPABASE_URL = '';
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
  } else {
    env.EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS = 'false';
    env.EXPO_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'placeholder-anon-key';
  }

  return sanitizeEnv(env);
}

function withServerEnv() {
  return sanitizeEnv({
    ...process.env,
    ASPIRE_SYNTHETIC_ENV: mode === 'auth' ? 'local-smoke' : 'local-public-smoke',
    PORT: port,
    NODE_ENV: 'development',
    ASPIRE_ENV: 'development',
    DEV_BYPASS_AUTH: mode === 'auth' ? 'true' : 'false',
    SUPABASE_URL: mode === 'auth' ? '' : process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: mode === 'auth' ? '' : process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  });
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

console.log(`[e2e-server] building Aspire desktop in ${mode} mode on port ${port}`);
await runCommand(npmCmd, ['run', 'build:static'], withBuildEnv());

console.log('[e2e-server] starting Aspire desktop server');
const server = spawn(npmCmd, ['run', 'start'], {
  cwd: process.cwd(),
  env: withServerEnv(),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const shutdown = (signal) => {
  if (!server.killed) {
    console.log(`[e2e-server] shutting down on ${signal}`);
    server.kill('SIGTERM');
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.on('exit', (code) => {
  process.exit(code ?? 0);
});

server.on('error', (error) => {
  console.error('[e2e-server] failed to start server', error);
  process.exit(1);
});
