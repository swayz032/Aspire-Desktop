#!/usr/bin/env node
/**
 * patch-import-meta.mjs — runs as a postinstall hook.
 *
 * Why this exists: zustand (a deep transitive dep of @react-three/drei)
 * and n8ao (transitive of postprocessing) both ship ESM modules that use
 * Vite-only `import.meta.env.MODE`. Metro bundles those modules into a
 * non-module entry chunk, so the browser blows up at parse time with
 * `SyntaxError: Cannot use 'import.meta' outside a module`.
 *
 * pnpm patch would be the canonical fix, but it generates one .patch
 * file per package version and we have three zustand versions in the
 * tree (3.7.2, 4.5.x, 5.x). A single idempotent postinstall script is
 * lower-maintenance and survives upstream version bumps as long as the
 * `import.meta.env.MODE` pattern stays the same.
 *
 * The transformations are a strict subset:
 *   `import.meta.env.MODE`      ->  `"development"`
 *   `import.meta.env`           ->  `undefined`
 *
 * Both substitutions yield expressions that resolve to the same value
 * zustand expects in dev/prod paths, so behavior is preserved.
 *
 * The n8ao dev-server.js file is a Vite dev harness shipped inside the
 * production package by mistake — empty content keeps Metro from
 * tripping on its `import.meta` reference.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const PNPM_DIR = join(ROOT, 'node_modules', '.pnpm');

const NEEDLE_MODE = /import\.meta\.env\.MODE/g;
const NEEDLE_ENV = /import\.meta\.env\b/g;
const REPLACE_MODE = '"development"';
const REPLACE_ENV = 'undefined';

let patched = 0;
let nuked = 0;

function patchFile(path) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  if (!NEEDLE_ENV.test(content)) {
    NEEDLE_ENV.lastIndex = 0;
    return;
  }
  NEEDLE_ENV.lastIndex = 0;
  NEEDLE_MODE.lastIndex = 0;
  const replaced = content
    .replace(NEEDLE_MODE, REPLACE_MODE)
    .replace(NEEDLE_ENV, REPLACE_ENV);
  if (replaced !== content) {
    writeFileSync(path, replaced, 'utf8');
    patched++;
  }
}

function nukeFile(path) {
  try {
    const size = statSync(path).size;
    if (size === 0) return;
    writeFileSync(path, '', 'utf8');
    nuked++;
  } catch {
    /* file does not exist — fine */
  }
}

function listPnpmEntries(prefix) {
  let entries;
  try {
    entries = readdirSync(PNPM_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith(prefix))
    .map((e) => join(PNPM_DIR, e.name));
}

function patchZustandIn(pkgRoot) {
  const esmDir = join(pkgRoot, 'node_modules', 'zustand', 'esm');
  let files;
  try {
    files = readdirSync(esmDir);
  } catch {
    return;
  }
  for (const f of files) {
    if (f.endsWith('.js') || f.endsWith('.mjs')) {
      patchFile(join(esmDir, f));
    }
  }
}

function nukeN8aoDevServerIn(pkgRoot) {
  nukeFile(join(pkgRoot, 'node_modules', 'n8ao', 'dev-server.js'));
}

// Apply across every zustand variant pnpm has materialized.
for (const root of listPnpmEntries('zustand@')) {
  patchZustandIn(root);
}

// Apply across every n8ao variant.
for (const root of listPnpmEntries('n8ao@')) {
  nukeN8aoDevServerIn(root);
}

if (patched || nuked) {
  console.log(
    `[patch-import-meta] patched ${patched} zustand file(s), nuked ${nuked} n8ao dev-server file(s)`,
  );
} else {
  console.log('[patch-import-meta] nothing to patch — already clean');
}
