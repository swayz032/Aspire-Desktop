/**
 * Roof Aerial Route — GET /api/property/roof-aerial?address=<full address>
 *
 * Returns a sharp-processed JPEG/WebP of the roof cropped from Google Solar
 * dataLayers RGB GeoTIFF (~10cm/pixel) using the building footprint polygon
 * to centre on the actual roof, not the surrounding parcel.
 *
 * Why this exists: Apify Zillow's "roof" categorization is unreliable — it
 * often returns whatever exterior photo Adam labelled "roof", which may be
 * an oblique angle. Solar's true top-down aerial at 10cm/pixel is the right
 * data source for an estimating UI.
 *
 * Auth: bypassed (loaded via <img src>, which can't carry Bearer JWT).
 * Tenant safety: no PII in URL; address resolves via public geocoder.
 *
 * Aspire Laws:
 *   Law #3 (fail-closed): on any error, returns 404/502 — never serves a
 *     placeholder that the UI could mistake for real data.
 *   Law #9 (no secrets logged): Solar URLs scrubbed before logging.
 */

import type { Request, Response } from 'express';
import sharp from 'sharp';
import { logger } from '../../logger';
import { geocodeAddress } from './googleGeocodingClient';
import {
  fetchSolarRoofAerial,
  fetchSolarSignedUrlBytes,
  type SolarRoofAerial,
} from './googleSolarClient';
import { fetchBuildingFootprint } from './buildingFootprintClient';

// In-memory cache: keyed on cleanAddress → processed WebP bytes.
// Solar signed URLs are short-lived but the cropped output is stable; cache
// for 24h to avoid hammering Solar/Sharp on repeat loads.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
type CachedEntry = { bytes: Buffer; mime: string; expiresAt: number };
const cache = new Map<string, CachedEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

export async function handleRoofAerial(req: Request, res: Response): Promise<void> {
  const rawAddress = String(req.query.address ?? '').trim();
  if (!rawAddress) {
    res.status(400).json({ error: 'address parameter required' });
    return;
  }

  // Cache lookup
  pruneCache();
  const cached = cache.get(rawAddress);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Aspire-Cache', 'hit');
    res.send(cached.bytes);
    return;
  }

  // Geocode for Solar coords
  const geo = await geocodeAddress(rawAddress);
  if (geo.status !== 'ok' || !geo.coords) {
    logger.warn('[roofAerialRoute] geocoding failed', { address: rawAddress.slice(0, 60) });
    res.status(404).json({ error: 'address not found' });
    return;
  }
  const { lat, lng } = geo.coords;

  // Fan out: Solar aerial + building footprint in parallel.
  const [aerial, footprint]: [SolarRoofAerial, Awaited<ReturnType<typeof fetchBuildingFootprint>>] =
    await Promise.all([
      fetchSolarRoofAerial({ lat, lng }, { radiusMeters: 50 }),
      fetchBuildingFootprint({ lat, lng }),
    ]);

  if (aerial.status !== 'ok' || !aerial.rgbUrl) {
    logger.info('[roofAerialRoute] solar aerial unavailable', {
      status: aerial.status,
      address: rawAddress.slice(0, 60),
    });
    res.status(404).json({ error: 'no aerial available for this address' });
    return;
  }

  // Pull the GeoTIFF bytes
  const dl = await fetchSolarSignedUrlBytes(aerial.rgbUrl);
  if (dl.status !== 'ok') {
    res.status(502).json({ error: 'aerial download failed' });
    return;
  }

  // Process: sharp can read TIFF. Decode to get dimensions, then either
  // polygon-crop (footprint available) or centre-crop (fallback).
  const inputBuf = Buffer.from(dl.bytes);
  let src: sharp.Sharp;
  try {
    src = sharp(inputBuf);
  } catch (err) {
    logger.warn('[roofAerialRoute] sharp init failed', {
      reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    res.status(502).json({ error: 'image decode failed' });
    return;
  }
  const meta = await src.metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (srcW < 64 || srcH < 64) {
    res.status(502).json({ error: 'aerial too small' });
    return;
  }

  // Compute crop window
  let cropMode: 'polygon' | 'center' = 'center';
  let crop: { left: number; top: number; width: number; height: number };
  const bbox = aerial.boundingBox;
  const hasPolygon =
    footprint.status === 'ready' &&
    bbox &&
    Array.isArray(footprint.data.polygon) &&
    footprint.data.polygon.length >= 3;

  if (hasPolygon && bbox && footprint.status === 'ready') {
    // Map each polygon [lng, lat] → pixel (x, y).
    // x grows east (lng), y grows south (lat decreases).
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [pLng, pLat] of footprint.data.polygon) {
      const fx = (pLng - bbox.sw.lng) / (bbox.ne.lng - bbox.sw.lng);
      const fy = (bbox.ne.lat - pLat) / (bbox.ne.lat - bbox.sw.lat);
      xs.push(fx * srcW);
      ys.push(fy * srcH);
    }
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(srcW, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(srcH, Math.max(...ys));
    const w = maxX - minX;
    const h = maxY - minY;
    if (w > 32 && h > 32) {
      // 50% padding around the footprint so the roof reads as the subject
      // with context, not a tight crop.
      const padX = w * 0.5;
      const padY = h * 0.5;
      const left = Math.max(0, Math.floor(minX - padX));
      const top = Math.max(0, Math.floor(minY - padY));
      const width = Math.min(srcW - left, Math.ceil(w + padX * 2));
      const height = Math.min(srcH - top, Math.ceil(h + padY * 2));
      crop = { left, top, width, height };
      cropMode = 'polygon';
    } else {
      crop = centerCrop(srcW, srcH);
    }
  } else {
    crop = centerCrop(srcW, srcH);
  }

  // Sharp pipeline: extract → sharpen → contrast → upscale → WebP
  let outBuf: Buffer;
  try {
    outBuf = await sharp(inputBuf)
      .extract(crop)
      .sharpen({ sigma: 1.2, m1: 1.0, m2: 3.0 })
      .linear(1.1, -10)
      .normalize()
      .resize({ width: 1280, kernel: 'lanczos3', withoutEnlargement: false })
      .webp({ quality: 90, effort: 4 })
      .toBuffer();
  } catch (err) {
    logger.warn('[roofAerialRoute] sharp pipeline failed', {
      reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
    });
    res.status(502).json({ error: 'image processing failed' });
    return;
  }

  // Cache + respond
  cache.set(rawAddress, {
    bytes: outBuf,
    mime: 'image/webp',
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  logger.info('[roofAerialRoute] served', {
    address: rawAddress.slice(0, 60),
    crop_mode: cropMode,
    src_w: srcW,
    src_h: srcH,
    crop_w: crop.width,
    crop_h: crop.height,
    out_bytes: outBuf.byteLength,
  });
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.setHeader('X-Aspire-Cache', 'miss');
  res.send(outBuf);
}

function centerCrop(srcW: number, srcH: number): {
  left: number; top: number; width: number; height: number;
} {
  // 60% center crop — wider than tight footprint to keep context.
  const width = Math.floor(srcW * 0.6);
  const height = Math.floor(srcH * 0.6);
  return {
    left: Math.floor((srcW - width) / 2),
    top: Math.floor((srcH - height) / 2),
    width,
    height,
  };
}
