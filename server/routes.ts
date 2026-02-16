import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';

const router = Router();

const getParam = (param: string | string[]): string =>
  Array.isArray(param) ? param[0] : param;

router.get('/api/stripe/publishable-key', async (req: Request, res: Response) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/suites/:suiteId', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfile(getParam(req.params.suiteId));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Backward-compatible alias: /api/users/:userId -> suite profile lookup
router.get('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfile(getParam(req.params.userId));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/slug/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/users', async (req: Request, res: Response) => {
  try {
    const profile = await storage.createSuiteProfile(req.body);
    res.status(201).json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/users/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await storage.updateSuiteProfile(getParam(req.params.userId), req.body);
    if (!profile) return res.status(404).json({ error: 'Suite profile not found' });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/services', async (req: Request, res: Response) => {
  try {
    const services = await storage.getServices(getParam(req.params.userId));
    res.json(services);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/services/active', async (req: Request, res: Response) => {
  try {
    const services = await storage.getActiveServices(getParam(req.params.userId));
    res.json(services);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/users/:userId/services', async (req: Request, res: Response) => {
  try {
    const stripe = await getUncachableStripeClient();

    const product = await stripe.products.create({
      name: req.body.name,
      description: req.body.description || '',
      metadata: { suiteId: getParam(req.params.userId) },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: req.body.price,
      currency: req.body.currency || 'usd',
    });

    const service = await storage.createService({
      ...req.body,
      suiteId: getParam(req.params.userId),
      stripeProductId: product.id,
      stripePriceId: price.id,
    });

    res.status(201).json(service);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/services/:serviceId', async (req: Request, res: Response) => {
  try {
    const service = await storage.updateService(getParam(req.params.serviceId), req.body);
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json(service);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/services/:serviceId', async (req: Request, res: Response) => {
  try {
    await storage.deleteService(getParam(req.params.serviceId));
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/availability', async (req: Request, res: Response) => {
  try {
    const availability = await storage.getAvailability(getParam(req.params.userId));
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/users/:userId/availability', async (req: Request, res: Response) => {
  try {
    const slots = req.body.slots.map((slot: any) => ({
      ...slot,
      suiteId: getParam(req.params.userId),
    }));
    const availability = await storage.setAvailability(getParam(req.params.userId), slots);
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  try {
    const settings = await storage.getBufferSettings(getParam(req.params.userId));
    res.json(settings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/api/users/:userId/buffer-settings', async (req: Request, res: Response) => {
  try {
    const settings = await storage.upsertBufferSettings(getParam(req.params.userId), req.body);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/bookings', async (req: Request, res: Response) => {
  try {
    const bookings = await storage.getBookings(getParam(req.params.userId));
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/bookings/upcoming', async (req: Request, res: Response) => {
  try {
    const bookings = await storage.getUpcomingBookings(getParam(req.params.userId));
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/users/:userId/bookings/stats', async (req: Request, res: Response) => {
  try {
    const stats = await storage.getBookingStats(getParam(req.params.userId));
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/bookings/:bookingId', async (req: Request, res: Response) => {
  try {
    const booking = await storage.getBooking(getParam(req.params.bookingId));
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  try {
    const booking = await storage.cancelBooking(getParam(req.params.bookingId), req.body.reason);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/book/:slug', async (req: Request, res: Response) => {
  try {
    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const services = await storage.getActiveServices(profile.suiteId);
    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);

    res.json({
      user: { id: profile.suiteId, name: profile.name, businessName: profile.businessName, logoUrl: profile.logoUrl, accentColor: profile.accentColor },
      services,
      availability,
      bufferSettings: bufferSettings || { beforeBuffer: 0, afterBuffer: 15, minimumNotice: 60, maxAdvanceBooking: 30 },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/book/:slug/slots', async (req: Request, res: Response) => {
  try {
    const { serviceId, date } = req.query;
    if (!serviceId || !date) {
      return res.status(400).json({ error: 'serviceId and date are required' });
    }

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId as string);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const availability = await storage.getAvailability(profile.suiteId);
    const bufferSettings = await storage.getBufferSettings(profile.suiteId);
    const existingBookings = await storage.getBookingsByDate(profile.suiteId, new Date(date as string));

    const requestedDate = new Date(date as string);
    const dayOfWeek = requestedDate.getDay();
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek && a.isActive);

    const slots: string[] = [];
    const buffer = bufferSettings?.afterBuffer || 15;

    for (const avail of dayAvailability) {
      const [startHour, startMin] = avail.startTime.split(':').map(Number);
      const [endHour, endMin] = avail.endTime.split(':').map(Number);

      let currentTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      while (currentTime + service.duration <= endTime) {
        const slotStart = new Date(requestedDate);
        slotStart.setHours(Math.floor(currentTime / 60), currentTime % 60, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + service.duration);

        const isAvailable = !existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledAt);
          const bookingEnd = new Date(bookingStart);
          bookingEnd.setMinutes(bookingEnd.getMinutes() + booking.duration);
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (isAvailable) {
          const hours = Math.floor(currentTime / 60).toString().padStart(2, '0');
          const mins = (currentTime % 60).toString().padStart(2, '0');
          slots.push(`${hours}:${mins}`);
        }

        currentTime += 30;
      }
    }

    res.json({ slots });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/book/:slug/checkout', async (req: Request, res: Response) => {
  try {
    const { serviceId, scheduledAt, clientName, clientEmail, clientPhone, clientNotes } = req.body;

    const profile = await storage.getSuiteProfileBySlug(getParam(req.params.slug));
    if (!profile) return res.status(404).json({ error: 'Booking page not found' });

    const service = await storage.getService(serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    const booking = await storage.createBooking({
      suiteId: profile.suiteId,
      serviceId,
      clientName,
      clientEmail,
      clientPhone,
      clientNotes,
      scheduledAt: new Date(scheduledAt),
      duration: service.duration,
      amount: service.price,
      currency: service.currency,
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    if (service.price > 0 && service.stripePriceId) {
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: service.stripePriceId, quantity: 1 }],
        mode: 'payment',
        success_url: `${baseUrl}/book/${getParam(req.params.slug)}/success?bookingId=${booking.id}`,
        cancel_url: `${baseUrl}/book/${getParam(req.params.slug)}/cancel?bookingId=${booking.id}`,
        metadata: { bookingId: booking.id },
        customer_email: clientEmail,
      });

      await storage.updateBooking(booking.id, { stripeCheckoutSessionId: session.id });

      res.json({ checkoutUrl: session.url, bookingId: booking.id });
    } else {
      await storage.updateBooking(booking.id, { status: 'confirmed', paymentStatus: 'free' });
      res.json({ bookingId: booking.id, confirmed: true });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/book/:slug/confirm/:bookingId', async (req: Request, res: Response) => {
  try {
    const booking = await storage.updateBooking(getParam(req.params.bookingId), {
      status: 'confirmed',
      paymentStatus: 'paid',
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json(booking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// @deprecated — frontdesk setup/preview-audio endpoints moved to telephonyEnterpriseRoutes.ts

/**
 * ElevenLabs TTS — Text-to-Speech Only (Law #1: Single Brain)
 *
 * ElevenLabs is the mouth. NOT the brain.
 * Intelligence comes from the LangGraph orchestrator via OpenAI SDK skill packs.
 * This route converts orchestrator response text → audio via ElevenLabs TTS API.
 */
const VOICE_IDS: Record<string, string> = {
  ava: '56bWURjYFHyYyVf490Dp',
  eli: 'c6kFzbpMaJ8UMD5P6l72',
  finn: 's3TPKV1kjDlVtZbl4Ksh',
  nora: '6aDn1KB0hjpdcocrUkmq',
};

router.post('/api/elevenlabs/tts', async (req: Request, res: Response) => {
  try {
    const { agent, text, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    if (!resolvedVoiceId) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      return res.status(500).json({ error: `TTS failed: ${response.status}` });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error: any) {
    console.error('TTS error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/elevenlabs/tts/stream', async (req: Request, res: Response) => {
  try {
    const { agent, text, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const resolvedVoiceId = voiceId || VOICE_IDS[agent];
    if (!resolvedVoiceId) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS stream error:', response.status, errorText);
      return res.status(500).json({ error: `TTS stream failed: ${response.status}` });
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('Transfer-Encoding', 'chunked');
    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    };
    await pump();
  } catch (error: any) {
    console.error('TTS stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Sandbox Health Check — Verify provider sandbox API keys are configured
 * Does NOT log or expose key values (Law #9: Never log secrets)
 */
router.get('/api/sandbox/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { configured: boolean; sandbox: boolean; status: string }> = {};

  // Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  checks.stripe = {
    configured: !!stripeKey,
    sandbox: stripeKey.startsWith('sk_test_'),
    status: !stripeKey ? 'NOT_SET' : stripeKey.startsWith('sk_test_') ? 'SANDBOX_OK' : 'LIVE_KEY_WARNING',
  };

  // Plaid
  const plaidId = process.env.PLAID_CLIENT_ID || '';
  const plaidSecret = process.env.PLAID_SECRET || '';
  checks.plaid = {
    configured: !!plaidId && !!plaidSecret,
    sandbox: true, // Plaid sandbox is env-based, not key-prefix based
    status: !plaidId || !plaidSecret ? 'NOT_SET' : 'CONFIGURED',
  };

  // Gusto
  const gustoId = process.env.GUSTO_CLIENT_ID || '';
  checks.gusto = {
    configured: !!gustoId,
    sandbox: true, // Gusto uses gusto-demo.com for sandbox
    status: !gustoId ? 'NOT_SET' : 'CONFIGURED',
  };

  // QuickBooks
  const qbId = process.env.QUICKBOOKS_CLIENT_ID || '';
  checks.quickbooks = {
    configured: !!qbId,
    sandbox: true, // QB sandbox is app-level config
    status: !qbId ? 'NOT_SET' : 'CONFIGURED',
  };

  // ElevenLabs
  checks.elevenlabs = {
    configured: !!process.env.ELEVENLABS_API_KEY,
    sandbox: true,
    status: process.env.ELEVENLABS_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };

  // Deepgram
  checks.deepgram = {
    configured: !!process.env.DEEPGRAM_API_KEY,
    sandbox: true,
    status: process.env.DEEPGRAM_API_KEY ? 'CONFIGURED' : 'NOT_SET',
  };

  // Domain Rail / PolarisM
  checks.domain_rail = {
    configured: !!process.env.DOMAIN_RAIL_HMAC_SECRET,
    sandbox: true,
    status: process.env.DOMAIN_RAIL_HMAC_SECRET ? 'CONFIGURED' : 'NOT_SET',
  };

  // Orchestrator
  const orchUrl = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
  checks.orchestrator = {
    configured: !!process.env.ORCHESTRATOR_URL,
    sandbox: true,
    status: process.env.ORCHESTRATOR_URL ? 'CONFIGURED' : 'DEFAULT_LOCALHOST',
  };

  // LiveKit
  checks.livekit = {
    configured: !!process.env.LIVEKIT_URL && !!process.env.LIVEKIT_API_KEY,
    sandbox: true,
    status: !process.env.LIVEKIT_URL ? 'NOT_SET' : 'CONFIGURED',
  };

  // Supabase
  checks.supabase = {
    configured: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
    sandbox: false,
    status: process.env.EXPO_PUBLIC_SUPABASE_URL ? 'CONFIGURED' : 'NOT_SET',
  };

  const total = Object.keys(checks).length;
  const configured = Object.values(checks).filter(c => c.configured).length;

  res.json({
    summary: `${configured}/${total} providers configured`,
    all_configured: configured === total,
    checks,
  });
});

/**
 * Orchestrator Intent Proxy — Law #1: Single Brain
 *
 * Routes user text/voice intent to the LangGraph orchestrator.
 * The orchestrator decides which skill pack handles the intent.
 * Returns response text that gets spoken via ElevenLabs TTS.
 *
 * Hardened with:
 * - 15s timeout (AbortController) — Gate 3: Reliability
 * - Circuit breaker (3 failures → open 60s) — Gate 3: Reliability
 * - Correlation ID forwarding — Gate 2: Observability
 */
const ORCHESTRATOR_TIMEOUT_MS = 15_000;
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 60_000;
let orchestratorConsecutiveFailures = 0;
let orchestratorLastFailureAt = 0;

router.post('/api/orchestrator/intent', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || `corr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { agent, text, voiceId, channel } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Missing or empty text parameter' });
    }

    const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:8000';
    const suiteId = req.headers['x-suite-id'] as string;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Missing required header: X-Suite-Id' });
    }

    // Circuit breaker check — Law #3: fail fast when orchestrator is known-down
    const now = Date.now();
    if (
      orchestratorConsecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD &&
      (now - orchestratorLastFailureAt) < CIRCUIT_BREAKER_RESET_MS
    ) {
      return res.status(503).json({
        error: 'ORCHESTRATOR_CIRCUIT_OPEN',
        message: 'Orchestrator circuit breaker open. Retrying automatically.',
        correlation_id: correlationId,
      });
    }

    // Timeout enforcement — Gate 3: Reliability
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS);

    const response = await fetch(`${ORCHESTRATOR_URL}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Suite-Id': suiteId,
        'X-Correlation-Id': correlationId,
      },
      body: JSON.stringify({
        text: text.trim(),
        agent: agent || 'ava',
        voice_id: voiceId,
        channel: channel || 'voice',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      orchestratorConsecutiveFailures++;
      orchestratorLastFailureAt = Date.now();
      const errorText = await response.text();
      console.error(`Orchestrator error [${correlationId}]:`, response.status, errorText);
      return res.status(response.status).json({
        response: 'I\'m having trouble processing that right now. Please try again.',
        error: `Orchestrator returned ${response.status}`,
        correlation_id: correlationId,
      });
    }

    // Success — reset circuit breaker
    orchestratorConsecutiveFailures = 0;

    const data = await response.json();
    res.json({
      response: data.response || data.text || data.message || 'I processed your request.',
      receipt_id: data.receipt_id,
      action: data.action,
      governance: data.governance || null,
      risk_tier: data.risk_tier || data.risk?.tier || null,
      route: data.route || null,
      activity: data.activity || data.pipeline_steps || null,
      correlation_id: correlationId,
    });
  } catch (error: any) {
    orchestratorConsecutiveFailures++;
    orchestratorLastFailureAt = Date.now();

    if (error.name === 'AbortError') {
      console.error(`Orchestrator timeout [${correlationId}]: exceeded ${ORCHESTRATOR_TIMEOUT_MS}ms`);
      return res.status(504).json({
        error: 'ORCHESTRATOR_TIMEOUT',
        message: `Orchestrator request timed out after ${ORCHESTRATOR_TIMEOUT_MS / 1000}s`,
        correlation_id: correlationId,
      });
    }

    console.error(`Orchestrator intent error [${correlationId}]:`, error.message);
    // Law #3: Fail Closed — return 503, not 200
    res.status(503).json({
      error: 'ORCHESTRATOR_UNAVAILABLE',
      message: 'The orchestrator is currently unavailable. Please try again.',
      correlation_id: correlationId,
    });
  }
});

router.get('/api/inbox/items', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT id, type, sender_name AS "from", subject, preview, priority,
             unread, created_at AS timestamp, tags
      FROM inbox_items
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const rows = (result.rows || result) as any[];
    res.json({ items: rows });
  } catch (error: any) {
    // Graceful degradation: table may not exist yet
    console.warn('inbox_items query failed, returning empty:', error.message);
    res.json({ items: [] });
  }
});

router.get('/api/authority-queue', async (_req: Request, res: Response) => {
  try {
    // Query pending approval requests
    const approvalResult = await db.execute(sql`
      SELECT id, action_type AS type, title, amount, currency,
             requested_by AS "requestedBy", risk_tier AS risk,
             status, created_at AS "createdAt"
      FROM approval_requests
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    const pendingApprovals = (approvalResult.rows || approvalResult) as any[];

    // Query recent completed receipts
    const receiptResult = await db.execute(sql`
      SELECT receipt_id AS id, action_type AS type, title, amount, currency,
             outcome AS status, executed_at AS "completedAt"
      FROM receipts
      WHERE outcome = 'success'
      ORDER BY executed_at DESC
      LIMIT 10
    `);
    const recentReceipts = (receiptResult.rows || receiptResult) as any[];

    res.json({ pendingApprovals, recentReceipts });
  } catch (error: any) {
    // Graceful degradation: tables may not exist yet
    console.warn('authority-queue query failed, returning empty:', error.message);
    res.json({ pendingApprovals: [], recentReceipts: [] });
  }
});

router.post('/api/authority-queue/:id/approve', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require suite context for state-changing operations
  const suiteId = req.headers['x-suite-id'] as string;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Missing required header: X-Suite-Id' });
  }

  const { id } = req.params;
  try {
    // Update approval request status (RLS-scoped via middleware)
    await db.execute(sql`
      UPDATE approval_requests
      SET status = 'approved', resolved_at = NOW()
      WHERE id = ${id}
    `);

    // Generate approval receipt (Law #2: Receipt for All)
    const receiptId = `RCP-${Date.now()}`;
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, action_type, outcome, reason_code, risk_tier,
                            suite_id, correlation_id, actor_type, executed_at, title)
      VALUES (${receiptId}, 'approval', 'success', 'user_approved', 'yellow',
              ${suiteId}, ${correlationId}, 'user', NOW(),
              (SELECT title FROM approval_requests WHERE id = ${id}))
    `);

    res.json({ id, status: 'approved', approvedAt: new Date().toISOString(), receiptId });
  } catch (error: any) {
    console.warn('approve failed:', error.message);
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'APPROVE_FAILED', message: 'Failed to approve request' });
  }
});

router.post('/api/authority-queue/:id/deny', async (req: Request, res: Response) => {
  // Law #3: Fail Closed — require suite context for state-changing operations
  const suiteId = req.headers['x-suite-id'] as string;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Missing required header: X-Suite-Id' });
  }

  const { id } = req.params;
  const { reason } = req.body;
  try {
    // Update approval request status (RLS-scoped via middleware)
    await db.execute(sql`
      UPDATE approval_requests
      SET status = 'denied', resolved_at = NOW(), denial_reason = ${reason || 'No reason provided'}
      WHERE id = ${id}
    `);

    // Generate denial receipt (Law #2: Receipt for All)
    const receiptId = `RCP-${Date.now()}`;
    const correlationId = req.headers['x-correlation-id'] as string || `corr-${Date.now()}`;
    await db.execute(sql`
      INSERT INTO receipts (receipt_id, action_type, outcome, reason_code, risk_tier,
                            suite_id, correlation_id, actor_type, executed_at, title)
      VALUES (${receiptId}, 'denial', 'denied', ${reason || 'user_denied'}, 'yellow',
              ${suiteId}, ${correlationId}, 'user', NOW(),
              (SELECT title FROM approval_requests WHERE id = ${id}))
    `);

    res.json({ id, status: 'denied', reason, deniedAt: new Date().toISOString(), receiptId });
  } catch (error: any) {
    console.warn('deny failed:', error.message);
    // Law #3: Fail Closed — return error, not fake success
    res.status(500).json({ error: 'DENY_FAILED', message: 'Failed to deny request' });
  }
});

/**
 * Anam Avatar — Session Token Exchange (Law #9: secrets server-side only)
 *
 * The Anam API key stays on the server. The client receives a short-lived
 * session token to initialize the Anam JS SDK with streamToVideoElement().
 * Cara avatar (30fa96d0) + Emma voice (6bfbe25a) for Ava.
 */
const ANAM_PERSONA = {
  name: 'Ava',
  avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',
  voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',
  systemPrompt: 'You are Ava, the AI executive assistant for Aspire. You help small business professionals manage their operations. Be professional, concise, and helpful.',
};

router.post('/api/anam/session', async (req: Request, res: Response) => {
  try {
    const ANAM_API_KEY = process.env.ANAM_API_KEY;
    if (!ANAM_API_KEY) {
      // Law #3: Fail Closed
      return res.status(503).json({ error: 'ANAM_NOT_CONFIGURED', message: 'Anam API key not configured' });
    }

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        persona: ANAM_PERSONA,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anam session token error:', response.status, errorText);
      return res.status(502).json({ error: 'ANAM_SESSION_FAILED', message: `Anam returned ${response.status}` });
    }

    const data = await response.json() as { sessionToken?: string };
    if (!data.sessionToken) {
      return res.status(502).json({ error: 'ANAM_NO_TOKEN', message: 'Anam did not return a session token' });
    }

    // Return only the session token — no API key exposure
    res.json({ sessionToken: data.sessionToken });
  } catch (error: any) {
    console.error('Anam session error:', error);
    res.status(500).json({ error: 'ANAM_ERROR', message: error.message });
  }
});

// ─── Mail Onboarding API (Stubbed) ───

const mailOnboardingStore: Record<string, any> = {};
const mailAccountsStore: Record<string, any[]> = {};
const mailReceiptsStore: Record<string, any[]> = {};
const mailJobsStore: Record<string, any> = {};
const domainSearchCache: Record<string, any[]> = {};

const generateJobId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function getMailReceipts(userId: string) {
  if (!mailReceiptsStore[userId]) mailReceiptsStore[userId] = [];
  return mailReceiptsStore[userId];
}

function addMailReceipt(userId: string, action: string, status: string, detail?: string, jobId?: string) {
  const receipts = getMailReceipts(userId);
  receipts.unshift({
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    action,
    timestamp: new Date().toISOString(),
    status,
    detail: detail || undefined,
    jobId: jobId || undefined,
  });
  if (receipts.length > 20) receipts.length = 20;
}

function getMailReceiptsByJobId(jobId: string) {
  const all: any[] = [];
  for (const userId of Object.keys(mailReceiptsStore)) {
    for (const r of mailReceiptsStore[userId]) {
      if (r.jobId === jobId) all.push(r);
    }
  }
  return all;
}

router.get('/api/mail/accounts', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || '');
  const accounts = mailAccountsStore[userId] || [];
  res.json({ accounts });
});

router.get('/api/mail/onboarding', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || '');
  const state = mailOnboardingStore[userId] || {};
  res.json(state);
});

router.patch('/api/mail/onboarding', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || req.body.userId || '');
  if (!mailOnboardingStore[userId]) mailOnboardingStore[userId] = {};
  const current = mailOnboardingStore[userId];
  Object.assign(current, req.body);
  delete current.userId;

  if (req.body.provider) {
    addMailReceipt(userId, 'mail.provider.selected', 'success', `Provider: ${req.body.provider}`);
  }
  if (req.body.domain) {
    addMailReceipt(userId, 'mail.domain.verification.requested', 'success', `Domain: ${req.body.domain}`);
  }
  if (req.body.mailboxes) {
    req.body.mailboxes.forEach((mb: any) => {
      addMailReceipt(userId, 'mail.mailbox.create.requested', 'success', `Mailbox: ${mb.email}`);
    });
  }
  if (req.body.eli) {
    addMailReceipt(userId, 'mail.eli.configured', 'success', `Draft: ${req.body.eli.canDraft}, Send: ${req.body.eli.canSend}`);
  }

  res.json(current);
});

router.post('/api/mail/onboarding/checks/run', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || req.body.userId || '');
  const checksToRun: string[] = req.body.checks || ['LIST', 'DRAFT', 'SEND_TEST', 'LABEL'];

  const results = checksToRun.map((id: string) => {
    const pass = id !== 'SEND_TEST';
    const status = pass ? 'PASS' : 'NOT_RUN';
    const message = pass
      ? `${id} check passed (mocked)`
      : `${id} requires manual trigger`;

    addMailReceipt(userId, `mail.check.${id.toLowerCase()}`, pass ? 'success' : 'pending', message);

    return { id, status, message };
  });

  if (!mailOnboardingStore[userId]) mailOnboardingStore[userId] = {};
  mailOnboardingStore[userId].checks = results;
  res.json({ checks: results });
});

router.post('/api/mail/onboarding/activate', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || req.body.userId || '');
  const state = mailOnboardingStore[userId] || {};

  const account = {
    id: `ma-${Date.now()}`,
    provider: state.provider || 'POLARIS',
    email: state.mailboxes?.[0]?.email || 'hello@yourbusiness.com',
    displayName: state.mailboxes?.[0]?.displayName || 'Business Email',
    status: 'ACTIVE',
    capabilities: {
      canSend: true,
      canDraft: true,
      canLabels: state.provider === 'GOOGLE',
      canJunk: true,
      canThreads: true,
    },
  };

  if (!mailAccountsStore[userId]) mailAccountsStore[userId] = [];
  mailAccountsStore[userId].push(account);
  addMailReceipt(userId, 'mail.mailbox.created', 'success', `Activated: ${account.email}`);

  mailOnboardingStore[userId] = {};
  res.json({ account });
});

router.get('/api/mail/receipts', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || '');
  const receipts = getMailReceipts(userId);
  res.json({ receipts: receipts.slice(0, 5) });
});

// ─── /v1/* Mail Onboarding API ───

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function generateMockDnsPlan(domain: string, mailbox: string) {
  return [
    { type: 'MX', host: domain, value: `mail.${domain}`, ttl: 3600 },
    { type: 'SPF', host: domain, value: `v=spf1 include:_spf.${domain} ~all`, ttl: 3600 },
    { type: 'DKIM', host: `default._domainkey.${domain}`, value: `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG...mock`, ttl: 3600 },
    { type: 'DMARC', host: `_dmarc.${domain}`, value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`, ttl: 3600 },
  ];
}

router.get('/v1/inbox/accounts', (req: Request, res: Response) => {
  const userId = getParam(req.query.userId as string || '');
  const accounts = mailAccountsStore[userId] || [];
  res.json({ accounts });
});

router.post('/v1/mail/onboarding/start', (req: Request, res: Response) => {
  const { userId, provider, context } = req.body;
  if (!userId || !provider) {
    return res.status(400).json({ error: 'userId and provider are required' });
  }
  const jobId = generateJobId();
  const job = {
    jobId,
    userId,
    provider,
    status: 'SETUP_REQUIRED',
    domain: null,
    mailbox: null,
    dnsPlan: null,
    dnsStatus: null,
    oauthStatus: null,
    checks: [],
    eli: null,
    domainMode: null,
    domainPurchase: null,
    createdAt: new Date().toISOString(),
    context: context || null,
  };
  mailJobsStore[jobId] = job;
  addMailReceipt(userId, 'mail.onboarding.started', 'success', `Provider: ${provider}`, jobId);
  res.json(job);
});

router.get('/v1/mail/onboarding/:jobId', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

router.post('/v1/mail/onboarding/:jobId/dns/plan', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { domain, mailbox, displayName, domainMode } = req.body;
  const dnsPlan = generateMockDnsPlan(domain, mailbox);

  job.domain = domain;
  job.mailbox = mailbox;
  job.displayName = displayName;
  job.domainMode = domainMode;
  job.dnsPlan = dnsPlan;

  addMailReceipt(job.userId, 'mail.domain.dns_plan.generated', 'success', `Domain: ${domain}`, jobId);
  res.json({ dnsPlan, domain, mailbox });
});

router.post('/v1/mail/onboarding/:jobId/dns/check', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const plan = job.dnsPlan || [];
  const results = plan.map((record: any) => ({
    type: record.type,
    ok: record.type !== 'DKIM',
    observed: record.type === 'DKIM' ? 'NOT_FOUND' : record.value,
  }));

  const dnsStatus = { lastCheckedAt: new Date().toISOString(), results };
  job.dnsStatus = dnsStatus;

  addMailReceipt(job.userId, 'mail.domain.dns.checked', 'success', `Checked ${results.length} records`, jobId);
  res.json({ dnsStatus });
});

router.get('/v1/domains/search', (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim().toLowerCase();
  if (!query) return res.status(400).json({ error: 'q parameter required' });

  if (domainSearchCache[query]) {
    return res.json({ query, results: domainSearchCache[query] });
  }

  const h = hashCode(query);
  const tlds = ['.com', '.io', '.co', '.dev', '.app'];
  const prices = ['$12.99/yr', '$29.99/yr', '$19.99/yr', '$14.99/yr', '$49.99/yr'];
  const terms = [1, 1, 1, 2, 1];
  const baseName = query.includes('.') ? query.split('.')[0] : query;

  const results: any[] = [];

  if (query.includes('.')) {
    const tldIdx = tlds.indexOf('.' + query.split('.').pop());
    results.push({
      domain: query,
      available: (h % 10) < 7,
      price: prices[h % prices.length],
      currency: 'USD',
      tld: '.' + query.split('.').pop(),
      term: tldIdx >= 0 ? terms[tldIdx] : 1,
    });
  }

  for (let i = 0; i < tlds.length; i++) {
    const dom = baseName + tlds[i];
    if (dom === query) continue;
    const domHash = hashCode(dom);
    results.push({
      domain: dom,
      available: (domHash % 10) < 7,
      price: prices[i],
      currency: 'USD',
      tld: tlds[i],
      term: terms[i],
    });
  }

  domainSearchCache[query] = results;
  res.json({ query, results });
});

router.post('/v1/domains/purchase/request', (req: Request, res: Response) => {
  const { jobId, domain } = req.body;
  if (!jobId || !domain) return res.status(400).json({ error: 'jobId and domain required' });
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  job.domainPurchase = {
    domain,
    status: 'PENDING_APPROVAL',
    requestedAt: new Date().toISOString(),
  };

  addMailReceipt(job.userId, 'domain.purchase.requested', 'pending', `Domain: ${domain}`, jobId);
  res.json({ status: 'PENDING_APPROVAL', message: 'Purchase request submitted for approval' });
});

router.post('/v1/domains/checkout/start', (req: Request, res: Response) => {
  const { jobId, domain } = req.body;
  if (!jobId || !domain) return res.status(400).json({ error: 'jobId and domain required' });
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const orderId = `ord-${Date.now()}`;
  job.domainPurchase = {
    domain,
    status: 'CHECKOUT_STARTED',
    checkoutUrl: null,
    orderId,
  };

  job.domain = domain;
  job.domainPurchase.status = 'COMPLETED';

  const dnsPlan = generateMockDnsPlan(domain, job.mailbox || 'hello');
  job.dnsPlan = dnsPlan;

  addMailReceipt(job.userId, 'domain.purchase.approved', 'success', `Domain: ${domain}`, jobId);
  addMailReceipt(job.userId, 'domain.purchase.executed', 'success', `Order: ${orderId}`, jobId);
  res.json({ status: 'COMPLETED', orderId, domain, dnsPlan });
});

router.get('/v1/mail/oauth/google/start', (req: Request, res: Response) => {
  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const scopes = ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.modify'];
  job.oauthStatus = { connectedEmail: 'user@workspace.google.com', scopes };

  addMailReceipt(job.userId, 'mail.oauth.google.connected', 'success', 'Google Workspace connected', jobId);
  res.json({ redirectUrl: null, connected: true, email: 'user@workspace.google.com', scopes });
});

router.post('/v1/mail/onboarding/:jobId/checks/run', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const checksToRun: string[] = req.body.checks || ['LIST', 'DRAFT', 'SEND_TEST', 'LABEL'];

  const results = checksToRun.map((id: string) => {
    const pass = id !== 'SEND_TEST';
    const status = pass ? 'PASS' : 'NOT_RUN';
    const message = pass
      ? `${id} check passed (mocked)`
      : `${id} requires manual trigger`;

    addMailReceipt(job.userId, `mail.check.${id.toLowerCase()}`, pass ? 'success' : 'pending', message, jobId);
    return { id, status, message };
  });

  job.checks = results;
  res.json({ checks: results });
});

router.post('/v1/mail/eli/policy/apply', (req: Request, res: Response) => {
  const { jobId, policy } = req.body;
  if (!jobId || !policy) return res.status(400).json({ error: 'jobId and policy required' });
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  job.eli = { ...policy };
  addMailReceipt(job.userId, 'mail.eli.policy.applied', 'success', `Draft: ${policy.canDraft}, Send: ${policy.canSend}`, jobId);
  res.json({ eli: job.eli });
});

router.post('/v1/mail/onboarding/:jobId/activate', (req: Request, res: Response) => {
  const jobId = getParam(req.params.jobId);
  const job = mailJobsStore[jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const account = {
    id: `ma-${Date.now()}`,
    provider: job.provider || 'POLARIS',
    email: job.mailbox ? `${job.mailbox}@${job.domain}` : 'hello@yourbusiness.com',
    displayName: job.displayName || 'Business Email',
    status: 'ACTIVE',
    capabilities: {
      canSend: true,
      canDraft: true,
      canLabels: job.provider === 'GOOGLE',
      canJunk: true,
      canThreads: true,
    },
  };

  if (!mailAccountsStore[job.userId]) mailAccountsStore[job.userId] = [];
  mailAccountsStore[job.userId].push(account);
  addMailReceipt(job.userId, 'mail.mailbox.activated', 'success', `Activated: ${account.email}`, jobId);

  job.status = 'COMPLETED';
  res.json({ account });
});

router.get('/v1/receipts', (req: Request, res: Response) => {
  const jobId = req.query.jobId as string;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });
  const receipts = getMailReceiptsByJobId(jobId);
  res.json({ receipts });
});

export default router;
