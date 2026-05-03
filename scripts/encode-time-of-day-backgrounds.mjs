// scripts/encode-time-of-day-backgrounds.mjs
//
// Encode the 2 new time-of-day source photos into 2560×1435 WebP backgrounds:
//   day.webp   = original modern-minimalist-office.jpg (already encoded as
//                full-static.webp; we just rename/copy it)
//   dusk.webp  = maciej-zurawski-VYqf3ib_onw-unsplash.jpg (cave / rock / forest)
//   night.webp = modern-minimalist-office (2).jpg (city skyline twilight)

import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const OUT_DIR = path.join(repoRoot, 'components', 'call-room', 'layers');

const W = 2560;
const H = 1435;

const SOURCES = [
  {
    name: 'dusk',
    path: 'C:/Users/tonio/Downloads/maciej-zurawski-VYqf3ib_onw-unsplash.jpg',
  },
  {
    name: 'night',
    path: 'C:/Users/tonio/Downloads/modern-minimalist-office (2).jpg',
  },
];

async function main() {
  for (const src of SOURCES) {
    const meta = await sharp(src.path).metadata();
    console.log(`${src.name}: source ${meta.width}×${meta.height} → ${W}×${H}`);
    const out = path.join(OUT_DIR, `${src.name}.webp`);
    await sharp(src.path)
      .resize(W, H, { fit: 'cover', position: 'center', kernel: 'lanczos3' })
      .webp({ quality: 86, effort: 6 })
      .toFile(out);
    const stat = await fs.stat(out);
    console.log(`  ✓ ${src.name}.webp (${(stat.size / 1024).toFixed(0)} KB)`);
  }

  // Copy existing full-static.webp → day.webp for explicit naming.
  const fullStatic = path.join(OUT_DIR, 'full-static.webp');
  const dayOut = path.join(OUT_DIR, 'day.webp');
  await fs.copyFile(fullStatic, dayOut);
  const dayStat = await fs.stat(dayOut);
  console.log(`  ✓ day.webp (${(dayStat.size / 1024).toFixed(0)} KB) — copied from full-static.webp`);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
