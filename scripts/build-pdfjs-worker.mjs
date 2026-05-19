// Copy pdfjs-dist's web worker to public/vendor/pdfjs/pdf.worker.min.mjs
// so it ships with the Aspire-desktop deploy and Railway serves it from
// /vendor/pdfjs/pdf.worker.min.mjs (same-origin, no CSP friction).
//
// Loaded at runtime by components/PdfBlobCanvasPreview.tsx via:
//   pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
//
// Triggered as part of `npm run build` (Railway runs this on deploy).
//
// Path follows the existing /vendor pattern (see build-anam-sdk.mjs).
// We do NOT version the path here because pdfjs-dist's worker is loaded
// dynamically (via GlobalWorkerOptions) rather than being a build-time
// import. Cache invalidation happens via the asset's content hash in
// Express's default static-file etag.

import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(`[build-pdfjs-worker] FAIL: ${msg}`);
  process.exit(1);
}

let pkgPath;
try {
  pkgPath = require.resolve('pdfjs-dist/package.json', { paths: [repoRoot] });
} catch (e) {
  fail(`pdfjs-dist is not installed. Run \`pnpm install\` first. Underlying: ${e.message}`);
}

const pkgRoot = dirname(pkgPath);
const workerSrc = resolve(pkgRoot, 'build', 'pdf.worker.min.mjs');

if (!existsSync(workerSrc)) {
  fail(`Worker file not found at ${workerSrc}. pdfjs-dist install may be corrupt.`);
}

const outDir = resolve(repoRoot, 'public', 'vendor', 'pdfjs');
mkdirSync(outDir, { recursive: true });

const outFile = resolve(outDir, 'pdf.worker.min.mjs');
copyFileSync(workerSrc, outFile);

const size = statSync(outFile).size;
console.log(`[build-pdfjs-worker] OK: copied to ${outFile} (${(size / 1024).toFixed(1)} KB)`);
