/**
 * Aerial Thumb Route — GET /api/property/aerial-thumb?address=<full address>
 *
 * Returns a top-down Google Static Maps satellite tile of the property
 * for the Aerial 3D card's small lane thumbnail. The big canvas already
 * uses the live Cesium 3D Tiles experience (LiveHouseInspectorHero) — this
 * route is JUST for the tile preview so the card reads as "real Earth view"
 * instead of a generic map icon.
 *
 * Why Static Maps and not Aerial View API:
 *   - Aerial View returns video, not a still
 *   - Static Maps satellite at zoom 20 gives a crisp top-down house image
 *     at 640×640 (Static Maps max) — perfectly sized for a 96-128px tile
 *   - Single GET, free-tier friendly, sub-second response
 *
 * Auth: bypassed (loaded via <img src>, no Bearer JWT possible).
 * Tenant safety: address-only proxy; no PII in URL.
 *
 * Aspire Laws:
 *   Law #3 (fail-closed): on any error, 502 — never a placeholder.
 *   Law #9 (no secrets logged): API key never logged or echoed.
 */

import type { Request, Response } from 'express';
import { logger } from '../../logger';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
type CachedEntry = { bytes: Buffer; mime: string; expiresAt: number };
const cache = new Map<string, CachedEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt <= now) cache.delete(k);
  }
}

export async function handleAerialThumb(req: Request, res: Response): Promise<void> {
  const rawAddress = String(req.query.address ?? '').trim();
  if (!rawAddress) {
    res.status(400).json({ error: 'address parameter required' });
    return;
  }
  // 200-char cap on address to keep the upstream URL bounded.
  const address = rawAddress.slice(0, 200);

  pruneCache();
  const cached = cache.get(address);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Aspire-Cache', 'hit');
    res.send(cached.bytes);
    return;
  }

  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) {
    logger.warn('[aerialThumbRoute] GOOGLE_MAPS_API_KEY not configured');
    res.status(503).json({ error: 'upstream unavailable' });
    return;
  }

  // Optional w/h params for callers that want non-square thumbs. Google
  // caps Static Maps at 640×640 per request (scale=2 doubles tile detail
  // up to 1280×1280 effective resolution for retina).
  const w = Math.min(Math.max(parseInt(String(req.query.w || '640'), 10) || 640, 64), 640);
  const h = Math.min(Math.max(parseInt(String(req.query.h || '640'), 10) || 640, 64), 640);
  // Zoom 20 frames a single property tight; zoom 19 is a fallback if 20
  // returns a generic tile. Static Maps caps zoom at 21.
  const zoomRaw = parseInt(String(req.query.zoom || '20'), 10);
  const zoom = Number.isFinite(zoomRaw) ? Math.min(Math.max(zoomRaw, 1), 21) : 20;

  const params = new URLSearchParams();
  params.set('center', address);
  params.set('zoom', String(zoom));
  params.set('size', `${w}x${h}`);
  params.set('scale', '2');                 // 2x detail for retina screens
  params.set('maptype', 'satellite');       // pure satellite, no labels
  params.set('format', 'jpg');
  params.set('key', apiKey);

  const upstreamUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  const safeUrl = 'https://maps.googleapis.com/maps/api/staticmap?<params>&key=<REDACTED>';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const upstream = await fetch(upstreamUrl, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!upstream.ok) {
      logger.warn('[aerialThumbRoute] upstream non-2xx', {
        status: upstream.status, url: safeUrl,
      });
      res.status(502).json({ error: 'upstream error' });
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    cache.set(address, {
      bytes: buf,
      mime: 'image/jpeg',
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Aspire-Cache', 'miss');
    res.send(buf);
  } catch (err: unknown) {
    clearTimeout(timer);
    logger.warn('[aerialThumbRoute] fetch error', {
      reason: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      url: safeUrl,
    });
    res.status(502).json({ error: 'fetch failed' });
  }
}
