// Bundle @anam-ai/js-sdk into a single same-origin ESM file under
// public/vendor/anam/<version>/index.js. Replaces runtime loads from
// https://esm.sh/@anam-ai/js-sdk@<version> so the SDK ships with the
// Aspire-desktop deploy and Railway serves it from /vendor/anam/<version>.
//
// The version path is derived from the installed @anam-ai/js-sdk package
// version — when you bump the package, the output path bumps with it,
// which automatically invalidates the immutable browser cache.
//
// Triggered as part of `npm run build` (which Railway runs on deploy).
//
// If the import in AvaDeskPanel.tsx is updated to a new version, also
// update this script's expectation (or just bump the npm dep — the
// version is read from package.json automatically).

import { build } from 'esbuild';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`[build-anam-sdk] FAIL: ${msg}`);
  process.exit(1);
}

// Resolve @anam-ai/js-sdk's package.json from node_modules.
let sdkPkgPath;
try {
  sdkPkgPath = require.resolve('@anam-ai/js-sdk/package.json', { paths: [repoRoot] });
} catch (e) {
  fail(
    `@anam-ai/js-sdk is not installed. Run \`npm install\` (or \`pnpm install\`) first. Underlying error: ${e.message}`
  );
}

const sdkPkg = JSON.parse(readFileSync(sdkPkgPath, 'utf8'));
const sdkVersion = sdkPkg.version;
const sdkRoot = dirname(sdkPkgPath);

// Determine the entry — prefer the ESM module field, fall back to main.
const entryRel =
  (sdkPkg.exports && (sdkPkg.exports['.']?.import || sdkPkg.exports['.']?.default)) ||
  sdkPkg.module ||
  sdkPkg.main;
if (!entryRel) {
  fail(`Could not determine entry point for @anam-ai/js-sdk@${sdkVersion} (no exports/module/main).`);
}
const entry = resolve(sdkRoot, entryRel);
if (!existsSync(entry)) {
  fail(`Entry file does not exist: ${entry}`);
}

const outDir = resolve(repoRoot, 'public', 'vendor', 'anam', sdkVersion);
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'index.js');

console.log(`[build-anam-sdk] bundling @anam-ai/js-sdk@${sdkVersion}`);
console.log(`[build-anam-sdk]   entry  : ${entry}`);
console.log(`[build-anam-sdk]   outFile: ${outFile}`);

await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  outfile: outFile,
  sourcemap: 'external',
  legalComments: 'none',
  minify: true,
  treeShaking: true,
  // Anam SDK is browser-only; no Node polyfills needed. If the SDK
  // pulls in `events` or `buffer`, esbuild will surface a clear error
  // here rather than silently shipping broken code.
}).catch((e) => fail(`esbuild failed: ${e.message}`));

const sizeKB = (statSync(outFile).size / 1024).toFixed(1);
console.log(`[build-anam-sdk] OK — ${sizeKB} KB written to public/vendor/anam/${sdkVersion}/index.js`);
console.log(`[build-anam-sdk] iframe import path: /vendor/anam/${sdkVersion}/index.js`);
