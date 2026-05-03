// scripts/slice-call-room-layers.mjs
//
// Slices the office color image into 4 depth-banded PNG layers using a
// depth map. Output:
//   components/call-room/layers/bg-far.png   (full image, anchor, no mask)
//   components/call-room/layers/bg-mid.png   (depth band ~ far-mid)
//   components/call-room/layers/bg-near.png  (depth band ~ mid-near)
//   components/call-room/layers/fg-near.png  (depth band ~ near foreground)
//
// Smooth alpha gradients (no jagged threshold cuts).

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const COLOR = 'C:/Users/tonio/Downloads/modern-minimalist-office.jpg';
const DEPTH = 'C:/Users/tonio/Downloads/image-depth-map-generator_1a1391bb.png';
const OUT_DIR = path.join(repoRoot, 'components', 'call-room', 'layers');

// Output resolution — matches existing full-static.webp (2560×1435 ≈ 16:9)
const OUT_W = 2560;
const OUT_H = 1435;

// Each band: trapezoidal alpha ramp. Pixels with depth in [hardMin, hardMax]
// get full alpha; soft falloff to 0 at [softMin, softMax]. This produces
// overlapping bands so adjacent layers blend without seams.
const BANDS = [
  { name: 'bg-mid',  softMin:  20, hardMin:  60, hardMax: 110, softMax: 150 },
  { name: 'bg-near', softMin:  90, hardMin: 130, hardMax: 180, softMax: 210 },
  { name: 'fg-near', softMin: 160, hardMin: 200, hardMax: 255, softMax: 255 },
];

function rampAlpha(d, b) {
  if (d <= b.softMin || d >= b.softMax) return 0;
  if (d >= b.hardMin && d <= b.hardMax) return 255;
  if (d < b.hardMin) {
    return Math.round(((d - b.softMin) / (b.hardMin - b.softMin)) * 255);
  }
  return Math.round(((b.softMax - d) / (b.softMax - b.hardMax)) * 255);
}

async function main() {
  console.log('Reading source images…');
  const colorMeta = await sharp(COLOR).metadata();
  const depthMeta = await sharp(DEPTH).metadata();
  console.log(`  color: ${colorMeta.width}×${colorMeta.height}`);
  console.log(`  depth: ${depthMeta.width}×${depthMeta.height}`);

  // Downsample BOTH to web-output resolution before slicing — keeps memory
  // sane and matches the size of the existing full-static.webp.
  const W = OUT_W;
  const H = OUT_H;

  const depthRaw = await sharp(DEPTH)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .grayscale()
    .raw()
    .toBuffer();

  console.log(`  depth resampled to ${W}×${H}, ${depthRaw.length} bytes`);

  const colorRaw = await sharp(COLOR)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer();

  console.log(`  color raw: ${colorRaw.length} bytes (expected ${W * H * 3})`);

  // Output dir
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toFile(path.join(OUT_DIR, '.write-test.png'));
  // (above just ensures dir is writable & creates if missing — actually
  //  sharp doesn't mkdir; rely on existing dir. We'll fail loudly if not.)

  // 1) bg-far.webp — full image, no mask. This is the anchor backdrop.
  console.log('\n[1/4] bg-far.webp (full anchor)…');
  await sharp(COLOR)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 82, effort: 6 })
    .toFile(path.join(OUT_DIR, 'bg-far.webp'));
  console.log('  ✓ bg-far.webp');

  // 2-4) Banded layers
  for (let i = 0; i < BANDS.length; i++) {
    const band = BANDS[i];
    console.log(`\n[${i + 2}/4] ${band.name}.png (depth ${band.softMin}–${band.softMax})…`);

    // Build RGBA buffer: original RGB + alpha computed from depth band ramp.
    const rgba = Buffer.alloc(W * H * 4);
    let nonZero = 0;
    for (let p = 0; p < W * H; p++) {
      const d = depthRaw[p];
      const a = rampAlpha(d, band);
      rgba[p * 4 + 0] = colorRaw[p * 3 + 0];
      rgba[p * 4 + 1] = colorRaw[p * 3 + 1];
      rgba[p * 4 + 2] = colorRaw[p * 3 + 2];
      rgba[p * 4 + 3] = a;
      if (a > 0) nonZero++;
    }
    const coverage = ((nonZero / (W * H)) * 100).toFixed(1);
    console.log(`  alpha coverage: ${coverage}% of pixels`);

    await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(path.join(OUT_DIR, `${band.name}.webp`));
    console.log(`  ✓ ${band.name}.webp`);
  }

  // Cleanup test artifact
  try {
    const fs = await import('node:fs/promises');
    await fs.unlink(path.join(OUT_DIR, '.write-test.png'));
  } catch {}

  console.log('\n✓ Done. 4 layers written to:');
  console.log(`  ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
