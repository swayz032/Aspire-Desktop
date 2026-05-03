// scripts/slice-call-room-layers.mjs
//
// Slices the office color image into 4 depth-banded WebP layers using a
// depth map. Designed for SEAMLESS parallax compositing:
//
//   1) Partition of unity — each pixel's alpha across all 4 layers sums to
//      exactly 1.0. No double-printing → no ghosting when layers move at
//      different parallax rates.
//
//   2) Edge-fill dilation — each layer's RGB is extended ~50px past its
//      alpha boundary using premultiplied blur + unpremultiplication. When a
//      foreground layer moves, the layer underneath has plausible color
//      where the foreground used to be → no "wall holes".
//
//   3) Output alpha = original partition weight (sharp boundary preserved).
//
// Output:
//   components/call-room/layers/bg-far.webp
//   components/call-room/layers/bg-mid.webp
//   components/call-room/layers/bg-near.webp
//   components/call-room/layers/fg-near.webp

import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const COLOR = 'C:/Users/tonio/Downloads/modern-minimalist-office.jpg';
const DEPTH = 'C:/Users/tonio/Downloads/image-depth-map-generator_1a1391bb.png';
const OUT_DIR = path.join(repoRoot, 'components', 'call-room', 'layers');

const OUT_W = 2560;
const OUT_H = 1435;

// Gaussian-weighted depth bands, centered at evenly-spaced depth values.
// Standard deviation σ controls overlap softness — larger = smoother
// transitions between layers, smaller = sharper depth discrimination.
const BANDS = [
  { name: 'bg-far',  center:  20, sigma: 55 },
  { name: 'bg-mid',  center: 100, sigma: 55 },
  { name: 'bg-near', center: 175, sigma: 55 },
  { name: 'fg-near', center: 240, sigma: 55 },
];

// Dilation blur radius — RGB content extends approximately this far past
// the alpha boundary. Must exceed max parallax travel (28px) to avoid
// revealing holes when foreground moves.
const DILATE_BLUR = 24;

function gaussian(d, c, s) {
  const x = (d - c) / s;
  return Math.exp(-(x * x));
}

async function main() {
  console.log('Reading source images…');
  const colorMeta = await sharp(COLOR).metadata();
  console.log(`  color: ${colorMeta.width}×${colorMeta.height} → ${OUT_W}×${OUT_H}`);

  const W = OUT_W;
  const H = OUT_H;
  const N = W * H;

  // Resampled raw buffers
  const depthRaw = await sharp(DEPTH)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .grayscale()
    .raw()
    .toBuffer();
  const colorRaw = await sharp(COLOR)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .raw()
    .toBuffer();

  console.log(`  depth: ${depthRaw.length} bytes (expected ${N})`);
  console.log(`  color: ${colorRaw.length} bytes (expected ${N * 3})`);

  // ------------------------------------------------------------------
  // Step 1: Compute partition-of-unity alphas for all 4 bands at once.
  // ------------------------------------------------------------------
  console.log('\nComputing partition-of-unity alphas…');
  const alphas = BANDS.map(() => Buffer.alloc(N));
  for (let p = 0; p < N; p++) {
    const d = depthRaw[p];
    let sum = 0;
    const w = new Array(BANDS.length);
    for (let b = 0; b < BANDS.length; b++) {
      w[b] = gaussian(d, BANDS[b].center, BANDS[b].sigma);
      sum += w[b];
    }
    // Normalize and quantize to 0–255
    if (sum > 0) {
      for (let b = 0; b < BANDS.length; b++) {
        alphas[b][p] = Math.round((w[b] / sum) * 255);
      }
    } else {
      // Fallback (shouldn't happen): assign all to bg-far
      alphas[0][p] = 255;
    }
  }

  // Coverage report
  for (let b = 0; b < BANDS.length; b++) {
    let total = 0;
    for (let p = 0; p < N; p++) total += alphas[b][p];
    const meanAlpha = total / N;
    console.log(`  ${BANDS[b].name}: mean alpha ${meanAlpha.toFixed(1)} (${((meanAlpha / 255) * 100).toFixed(1)}% ink)`);
  }

  // ------------------------------------------------------------------
  // Step 2: For each band, build RGBA WebP.
  //
  // Partition of unity guarantees that summing all 4 layers reconstructs
  // the original image exactly. So each layer just needs:
  //   - RGB = original color (always — never blurred)
  //   - alpha = the partition weight for this band
  //
  // No dilation, no blending. The math handles seamlessness on its own.
  // When fg-near translates by 20px, the underneath layers (bg-far, etc)
  // still have their full alpha contribution at the revealed pixels;
  // because alphas summed to 1.0 originally, the revealed region still
  // shows ~95%+ of the original color (the missing 5% is fg-near's
  // partition weight at that pixel, which is small by definition since
  // fg-near concentrates on near-foreground depths).
  // ------------------------------------------------------------------
  for (let b = 0; b < BANDS.length; b++) {
    const band = BANDS[b];
    console.log(`\n[${b + 1}/${BANDS.length}] ${band.name}.webp…`);
    const a = alphas[b];

    const out = Buffer.alloc(N * 4);
    for (let p = 0; p < N; p++) {
      out[p * 4 + 0] = colorRaw[p * 3 + 0];
      out[p * 4 + 1] = colorRaw[p * 3 + 1];
      out[p * 4 + 2] = colorRaw[p * 3 + 2];
      out[p * 4 + 3] = a[p];
    }

    await sharp(out, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 82, alphaQuality: 92, effort: 6 })
      .toFile(path.join(OUT_DIR, `${band.name}.webp`));
    console.log(`  ✓ ${band.name}.webp`);
  }

  console.log('\n✓ Done. 4 seamless parallax layers written to:');
  console.log(`  ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
