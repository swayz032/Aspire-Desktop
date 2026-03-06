import { Router } from 'express';

const router = Router();

// GOOGLE_MAPS_API_KEY is set by AWS Secrets Manager at server startup (via secrets.ts).
// Falls back to EXPO_PUBLIC_GOOGLE_PLACES_API_KEY for local dev with .env.
const GKEY = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

router.post('/api/places/autocomplete', async (req, res) => {
  const { input } = req.body ?? {};
  if (!input || typeof input !== 'string' || input.trim().length < 2) {
    return res.json({ suggestions: [] });
  }
  if (!GKEY) {
    return res.status(503).json({ error: 'Places API key not configured' });
  }
  try {
    const upstream = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GKEY },
      body: JSON.stringify({ input: input.trim(), includedRegionCodes: ['us', 'ca', 'gb', 'au', 'mx'] }),
    });
    const data = await upstream.json() as any;
    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }
    return res.json({ suggestions: data.suggestions || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Places fetch failed' });
  }
});

router.get('/api/places/details/:placeId', async (req, res) => {
  const { placeId } = req.params;
  if (!placeId) return res.status(400).json({ error: 'placeId required' });
  if (!GKEY) return res.status(503).json({ error: 'Places API key not configured' });
  try {
    const upstream = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=addressComponents,formattedAddress`,
      { headers: { 'X-Goog-Api-Key': GKEY } },
    );
    const data = await upstream.json() as any;
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Place details fetch failed' });
  }
});

export default router;
