/**
 * Copies ElevenLabs AudioWorklet processor files to public/ and dist/.
 *
 * AudioWorklets must be served as standalone JS files from the same origin.
 * The @elevenlabs/client SDK ships them in node_modules but they need to be
 * accessible via HTTP at runtime for the browser to load them.
 *
 * Runs as postinstall (public/) and post-build (dist/).
 */
const fs = require('fs');
const path = require('path');

const WORKLETS = ['audioConcatProcessor.js', 'rawAudioProcessor.js'];
const SRC_DIR = path.join(__dirname, '..', 'node_modules', '@elevenlabs', 'client', 'worklets');

const targets = [
  path.join(__dirname, '..', 'public', 'elevenlabs'),
  path.join(__dirname, '..', 'dist', 'elevenlabs'),
];

for (const dest of targets) {
  // Skip dist/ if it doesn't exist yet (pre-build)
  const parentExists = fs.existsSync(path.dirname(dest));
  if (!parentExists && dest.includes('dist')) continue;

  fs.mkdirSync(dest, { recursive: true });

  for (const file of WORKLETS) {
    const src = path.join(SRC_DIR, file);
    const out = path.join(dest, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, out);
      console.log(`Copied ${file} → ${path.relative(process.cwd(), out)}`);
    }
  }
}
