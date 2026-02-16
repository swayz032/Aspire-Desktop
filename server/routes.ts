import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { storage } from './storage';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { getDefaultSuiteId } from './suiteContext';

// Supabase admin client for bootstrap operations (user_metadata updates)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

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

/**
 * Suite Bootstrap — creates suite infrastructure for new users
 * Called during onboarding when user has no suite_id in their metadata.
 * Uses service role to bypass RLS for initial setup.
 */
router.post('/api/onboarding/bootstrap', async (req: Request, res: Response) => {
  const userId = (req as any).authenticatedUserId;
  if (!userId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Must be authenticated' });
  }

  // Check if user already has a suite (idempotent)
  const existingSuiteId = (req as any).authenticatedSuiteId;
  if (existingSuiteId && existingSuiteId !== getDefaultSuiteId()) {
    return res.json({ suiteId: existingSuiteId, created: false });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'BOOTSTRAP_UNAVAILABLE', message: 'Admin client not configured' });
  }

  try {
    const { businessName, ownerName, ownerTitle, industry, teamSize,
            servicesNeeded, currentTools, painPoint } = req.body;

    // 1. Create suite via app.ensure_suite (handles duplicates gracefully)
    const tenantId = `tenant-${userId.slice(0, 8)}-${Date.now()}`;
    const suiteName = businessName?.trim() || 'My Business';
    let suiteId: string;

    try {
      const result = await db.execute(sql`
        SELECT app.ensure_suite(${tenantId}, ${suiteName}) AS suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    } catch {
      // If app.ensure_suite doesn't exist, insert directly
      const result = await db.execute(sql`
        INSERT INTO app.suites (tenant_id, name)
        VALUES (${tenantId}, ${suiteName})
        RETURNING suite_id
      `);
      const rows = (result.rows || result) as any[];
      suiteId = rows[0]?.suite_id;
    }

    if (!suiteId) {
      return res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: 'Could not create suite' });
    }

    // 2. Get user email from Supabase admin
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return res.status(500).json({ error: 'USER_LOOKUP_FAILED', message: 'Could not find user' });
    }

    // 3. Create suite_profile (service role bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from('suite_profiles')
      .upsert({
        suite_id: suiteId,
        email: user.email || '',
        name: ownerName?.trim() || user.email?.split('@')[0] || 'Owner',
        business_name: businessName?.trim() || null,
        ...(industry ? { industry } : {}),
        ...(teamSize ? { team_size: teamSize } : {}),
        ...(ownerName ? { owner_name: ownerName.trim() } : {}),
        ...(ownerTitle ? { owner_title: ownerTitle.trim() } : {}),
        ...(servicesNeeded ? { services_needed: servicesNeeded } : {}),
        ...(currentTools ? { current_tools: currentTools.split?.(',').map((t: string) => t.trim()) || [] } : {}),
        ...(painPoint ? { pain_point: painPoint.trim() } : {}),
        ...(businessName ? { onboarding_completed_at: new Date().toISOString() } : {}),
      }, { onConflict: 'suite_id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Non-fatal — suite_id is still valid, onboarding form can save later
    }

    // 4. Update user_metadata with suite_id (so client gets it on session refresh)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { suite_id: suiteId },
    });

    if (updateError) {
      console.error('User metadata update error:', updateError);
      return res.status(500).json({ error: 'METADATA_UPDATE_FAILED', message: 'Suite created but metadata update failed' });
    }

    res.json({ suiteId, created: true });
  } catch (error: any) {
    console.error('Bootstrap error:', error);
    res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: error.message });
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
      return res.status(500).json({ error: 'Voice synthesis service not configured' });
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
      return res.status(500).json({ error: 'Voice synthesis service not configured' });
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
    const suiteId = (req as any).authenticatedSuiteId || req.headers['x-suite-id'] as string;
    if (!suiteId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Suite context required. Complete onboarding first.' });
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

      // Extract human-readable text from orchestrator error response
      let errorData: any = null;
      try { errorData = JSON.parse(errorText); } catch { /* non-JSON error */ }
      const responseText = errorData?.text || errorData?.message || 'I\'m having trouble processing that right now. Please try again.';

      return res.status(response.status).json({
        response: responseText,
        error: errorData?.error || `Orchestrator returned ${response.status}`,
        approval_payload_hash: errorData?.approval_payload_hash || null,
        required_approvals: errorData?.required_approvals || null,
        receipt_ids: errorData?.receipt_ids || [],
        correlation_id: correlationId,
      });
    }

    // Success — reset circuit breaker
    orchestratorConsecutiveFailures = 0;

    const data = await response.json();
    res.json({
      response: data.text || data.message || 'I processed your request.',
      receipt_id: data.governance?.receipt_ids?.[0] || null,
      receipt_ids: data.governance?.receipt_ids || [],
      action: data.plan?.task_type || null,
      governance: data.governance || null,
      risk_tier: data.risk?.tier || null,
      route: data.route || null,
      plan: data.plan || null,
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
  const suiteId = (req as any).authenticatedSuiteId || req.headers['x-suite-id'] as string;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Suite context required. Complete onboarding first.' });
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
  const suiteId = (req as any).authenticatedSuiteId || req.headers['x-suite-id'] as string;
  if (!suiteId) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Suite context required. Complete onboarding first.' });
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
      return res.status(503).json({ error: 'AVATAR_NOT_CONFIGURED', message: 'Avatar service not configured' });
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
      console.error('Avatar session token error:', response.status, errorText);
      return res.status(502).json({ error: 'AVATAR_SESSION_FAILED', message: 'Avatar service temporarily unavailable' });
    }

    const data = await response.json() as { sessionToken?: string };
    if (!data.sessionToken) {
      return res.status(502).json({ error: 'AVATAR_NO_TOKEN', message: 'Avatar service returned invalid response' });
    }

    // Return only the session token — no API key exposure
    res.json({ sessionToken: data.sessionToken });
  } catch (error: any) {
    console.error('Avatar session error:', error);
    res.status(500).json({ error: 'AVATAR_ERROR', message: 'Avatar service error' });
  }
});

// ─── Mail Onboarding API (Domain Rail Proxy) ───

const DOMAIN_RAIL_URL = process.env.DOMAIN_RAIL_URL || 'https://domain-rail-production.up.railway.app';

function getMailHmacHeaders(bodyStr: string): Record<string, string> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) throw new Error('DOMAIN_RAIL_HMAC_SECRET not configured');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyStr}`).digest('hex');
  return {
    'Content-Type': 'application/json',
    'Authorization': `HMAC-SHA256 ${signature}`,
    'X-Timestamp': timestamp,
    'X-Suite-Id': getDefaultSuiteId(),
  };
}

async function mailProxy(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  const secret = process.env.DOMAIN_RAIL_HMAC_SECRET;
  if (!secret) return { status: 503, data: { error: 'DOMAIN_RAIL_HMAC_SECRET not configured — mail onboarding unavailable' } };
  const bodyStr = body ? JSON.stringify(body) : '';
  const url = `${DOMAIN_RAIL_URL}${path}`;
  const opts: RequestInit = { method, headers: getMailHmacHeaders(bodyStr) };
  if (body && method !== 'GET') opts.body = bodyStr;
  const response = await fetch(url, opts);
  const data = await response.json().catch(() => ({ error: 'Invalid response from Domain Rail' }));
  return { status: response.status, data };
}

// GET /api/mail/accounts
router.get('/api/mail/accounts', async (req: Request, res: Response) => {
  try {
    const userId = getParam(req.query.userId as string || '');
    const { status, data } = await mailProxy('GET', `/api/mail/accounts?userId=${encodeURIComponent(userId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/mail/onboarding
router.get('/api/mail/onboarding', async (req: Request, res: Response) => {
  try {
    const userId = getParam(req.query.userId as string || '');
    const { status, data } = await mailProxy('GET', `/api/mail/onboarding?userId=${encodeURIComponent(userId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/mail/onboarding
router.patch('/api/mail/onboarding', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('PATCH', '/api/mail/onboarding', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/mail/onboarding/checks/run
router.post('/api/mail/onboarding/checks/run', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/api/mail/onboarding/checks/run', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/mail/onboarding/activate
router.post('/api/mail/onboarding/activate', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/api/mail/onboarding/activate', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/mail/receipts
router.get('/api/mail/receipts', async (req: Request, res: Response) => {
  try {
    const userId = getParam(req.query.userId as string || '');
    const { status, data } = await mailProxy('GET', `/api/mail/receipts?userId=${encodeURIComponent(userId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── /v1/* Mail Onboarding API (Domain Rail Proxy) ───

// GET /v1/inbox/accounts
router.get('/v1/inbox/accounts', async (req: Request, res: Response) => {
  try {
    const userId = getParam(req.query.userId as string || '');
    const { status, data } = await mailProxy('GET', `/v1/inbox/accounts?userId=${encodeURIComponent(userId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/onboarding/start
router.post('/v1/mail/onboarding/start', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/v1/mail/onboarding/start', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /v1/mail/onboarding/:jobId
router.get('/v1/mail/onboarding/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const { status, data } = await mailProxy('GET', `/v1/mail/onboarding/${encodeURIComponent(jobId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/onboarding/:jobId/dns/plan
router.post('/v1/mail/onboarding/:jobId/dns/plan', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const { status, data } = await mailProxy('POST', `/v1/mail/onboarding/${encodeURIComponent(jobId)}/dns/plan`, req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/onboarding/:jobId/dns/check
router.post('/v1/mail/onboarding/:jobId/dns/check', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const { status, data } = await mailProxy('POST', `/v1/mail/onboarding/${encodeURIComponent(jobId)}/dns/check`, req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /v1/domains/search
router.get('/v1/domains/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) return res.status(400).json({ error: 'q parameter required' });
    const { status, data } = await mailProxy('GET', `/v1/domains/search?q=${encodeURIComponent(q)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/domains/purchase/request
router.post('/v1/domains/purchase/request', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/v1/domains/purchase/request', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/domains/checkout/start
router.post('/v1/domains/checkout/start', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/v1/domains/checkout/start', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /v1/mail/oauth/google/start
router.get('/v1/mail/oauth/google/start', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string;
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const { status, data } = await mailProxy('GET', `/v1/mail/oauth/google/start?jobId=${encodeURIComponent(jobId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/onboarding/:jobId/checks/run
router.post('/v1/mail/onboarding/:jobId/checks/run', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const { status, data } = await mailProxy('POST', `/v1/mail/onboarding/${encodeURIComponent(jobId)}/checks/run`, req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/eli/policy/apply
router.post('/v1/mail/eli/policy/apply', async (req: Request, res: Response) => {
  try {
    const { status, data } = await mailProxy('POST', '/v1/mail/eli/policy/apply', req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /v1/mail/onboarding/:jobId/activate
router.post('/v1/mail/onboarding/:jobId/activate', async (req: Request, res: Response) => {
  try {
    const jobId = getParam(req.params.jobId);
    const { status, data } = await mailProxy('POST', `/v1/mail/onboarding/${encodeURIComponent(jobId)}/activate`, req.body);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /v1/receipts (by jobId)
router.get('/v1/receipts', async (req: Request, res: Response) => {
  try {
    const jobId = req.query.jobId as string;
    if (!jobId) return res.status(400).json({ error: 'jobId required' });
    const { status, data } = await mailProxy('GET', `/v1/receipts?jobId=${encodeURIComponent(jobId)}`);
    res.status(status).json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
