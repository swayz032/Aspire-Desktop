// scripts/slice-call-room-layers.mjs
//
// Produces 2 parallax layers from the office color image + depth map:
//
//   bg-far.webp  — Full image, alpha=1 everywhere. Foreground regions
//                  (where depth > NEAR_THRESHOLD) replaced with a heavy
//                  blur of the original (acting as cheap "behind-the-
//                  foreground" inpainting). When fg-near moves, the
//                  small revealed sliver shows plausible wall/floor color.
//
//   fg-near.webp — Foreground content only. Smooth alpha ramp based on
//                  depth. RGB is the original sharp color. Where alpha is
//                  high, this layer fully covers bg-far's fake-fill. Where
//                  alpha is low, bg-far shows through with original color.
//
// At rest the composite is bit-identical to the original photo (because
// where fg-near.alpha < 1, bg-far still has the original color). When
// fg-near translates, the reveal is small and fills with smooth blur.
//
// No partition-of-unity, no global blur. Just 2 layers, bit-perfect at rest.

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

// Foreground alpha ramp: alpha = 0 below ALPHA_LO, 1 above ALPHA_HI,
// smooth transition in between. Tighter range = sharper depth cutoff.
const ALPHA_LO = 150;
const ALPHA_HI = 210;

// Inpainting kicks in for pixels where depth > INPAINT_LO. Above
// INPAINT_HI we use 100% blurred fill. Smooth transition between.
// Set INPAINT_LO higher than ALPHA_LO so the bg-far transition zone is
// always still ORIGINAL where fg-near is partially transparent — this
// keeps the at-rest composite bit-identical to the source.
const INPAINT_LO = 215;
const INPAINT_HI = 245;

const INPAINT_BLUR = 50;

function smoothstep(x, lo, hi) {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

async function main() {
  console.log('Reading source images…');
  const colorMeta = await sharp(COLOR).metadata();
  console.log(`  color: ${colorMeta.width}×${colorMeta.height} → ${OUT_W}×${OUT_H}`);

  const W = OUT_W;
  const H = OUT_H;
  const N = W * H;

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

  // Pre-compute heavily blurred color for inpainting fill in bg-far.
  console.log(`Generating inpaint fill (blur radius ${INPAINT_BLUR})…`);
  const blurredRaw = await sharp(COLOR)
    .resize(W, H, { fit: 'fill', kernel: 'lanczos3' })
    .removeAlpha()
    .blur(INPAINT_BLUR)
    .raw()
    .toBuffer();

  // ------------------------------------------------------------------
  // bg-far.webp — full image with foreground inpainted.
  // ------------------------------------------------------------------
  console.log('\n[1/2] bg-far.webp (full image + inpainted foreground)…');
  const bgFar = Buffer.alloc(N * 4);
  let inpaintedPixels = 0;
  for (let p = 0; p < N; p++) {
    const d = depthRaw[p];
    const w = smoothstep(d, INPAINT_LO, INPAINT_HI); // 0 = original, 1 = blurred
    if (w > 0.01) inpaintedPixels++;

    bgFar[p * 4 + 0] = (colorRaw[p * 3 + 0] * (1 - w) + blurredRaw[p * 3 + 0] * w) | 0;
    bgFar[p * 4 + 1] = (colorRaw[p * 3 + 1] * (1 - w) + blurredRaw[p * 3 + 1] * w) | 0;
    bgFar[p * 4 + 2] = (colorRaw[p * 3 + 2] * (1 - w) + blurredRaw[p * 3 + 2] * w) | 0;
    bgFar[p * 4 + 3] = 255;
  }
  console.log(`  inpaint applied to ${inpaintedPixels.toLocaleString()} / ${N.toLocaleString()} pixels (${((inpaintedPixels / N) * 100).toFixed(1)}%)`);

  await sharp(bgFar, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(OUT_DIR, 'bg-far.webp'));
  console.log('  ✓ bg-far.webp');

  // ------------------------------------------------------------------
  // fg-near.webp — foreground only, sharp original color, smooth alpha.
  // ------------------------------------------------------------------
  console.log('\n[2/2] fg-near.webp (foreground sharp color + smooth alpha)…');
  const fgNear = Buffer.alloc(N * 4);
  let visiblePixels = 0;
  for (let p = 0; p < N; p++) {
    const d = depthRaw[p];
    const a = (smoothstep(d, ALPHA_LO, ALPHA_HI) * 255) | 0;
    if (a > 0) visiblePixels++;
    fgNear[p * 4 + 0] = colorRaw[p * 3 + 0];
    fgNear[p * 4 + 1] = colorRaw[p * 3 + 1];
    fgNear[p * 4 + 2] = colorRaw[p * 3 + 2];
    fgNear[p * 4 + 3] = a;
  }
  console.log(`  visible foreground: ${visiblePixels.toLocaleString()} pixels (${((visiblePixels / N) * 100).toFixed(1)}%)`);

  await sharp(fgNear, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 92, alphaQuality: 95, effort: 6 })
    .toFile(path.join(OUT_DIR, 'fg-near.webp'));
  console.log('  ✓ fg-near.webp');

  console.log('\n✓ Done. 2 sharp parallax layers written.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
