import { Router, Request, Response } from 'express';
import { storage } from './storage';
import { getUncachableStripeClient, getStripePublishableKey } from './stripeClient';

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

router.get('/api/frontdesk/setup', async (req: Request, res: Response) => {
  try {
    const suiteId = (req.query.userId as string) || (req.query.suiteId as string);
    if (!suiteId) return res.status(400).json({ error: 'suiteId required' });
    const setup = await storage.getFrontDeskSetup(suiteId);
    res.json(setup || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/api/frontdesk/setup', async (req: Request, res: Response) => {
  try {
    const { userId, suiteId: bodySuiteId, ...data } = req.body;
    const suiteId = bodySuiteId || userId;
    if (!suiteId) return res.status(400).json({ error: 'suiteId required' });
    const setup = await storage.upsertFrontDeskSetup(suiteId, data);
    res.json(setup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/frontdesk/preview-audio', async (req: Request, res: Response) => {
  try {
    const { clipType, reason, businessName, voiceId } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

    console.log('Audio preview request:', { clipType, reason, businessName, voiceId });
    console.log('ElevenLabs API key present:', !!ELEVENLABS_API_KEY);

    if (!ELEVENLABS_API_KEY) {
      console.error('ElevenLabs API key not found in environment');
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    let text = '';
    if (clipType === 'greeting') {
      text = `Hi, this is Sarah, the AI assistant for ${businessName || 'your business'}. How can I help you today?`;
    } else {
      text = `Hi, this is Sarah, the AI assistant for ${businessName || 'your business'}. I'd be happy to help you with that. Let me ask you a few quick questions to make sure I get all the details right.`;
    }

    const targetVoiceId = voiceId || 'uMM5TEnpKKgD758knVJO';
    console.log('Calling ElevenLabs TTS with voice:', targetVoiceId);

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    console.log('ElevenLabs response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      return res.status(500).json({ error: `ElevenLabs error: ${response.status} - ${errorText}` });
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    console.log('Audio generated successfully, size:', audioBuffer.byteLength);
    res.json({ audioUrl, cached: false });
  } catch (error: any) {
    console.error('Audio preview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/elevenlabs/signed-url', async (req: Request, res: Response) => {
  try {
    const { agent } = req.body;
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    let agentId: string | undefined;
    if (agent === 'eli') {
      agentId = process.env.ELEVENLABS_ELI_AGENT_ID;
    } else if (agent === 'ava') {
      agentId = process.env.ELEVENLABS_AVA_AGENT_ID;
    }

    if (!agentId) {
      return res.status(400).json({ error: `Unknown agent: ${agent}` });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs signed URL error:', response.status, errorText);
      return res.status(500).json({ error: `Failed to get signed URL: ${response.status}` });
    }

    const data = await response.json() as { signed_url: string };
    res.json({ signedUrl: data.signed_url });
  } catch (error: any) {
    console.error('Signed URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/inbox/items', async (_req: Request, res: Response) => {
  res.json({
    items: [
      {
        id: 'inb-1',
        type: 'email',
        from: 'Marcus Chen',
        subject: 'Q4 Vendor Contract Renewals',
        preview: 'Three vendor contracts are up for renewal this quarter. I\'ve reviewed the terms and have some concerns about the pricing escalation clauses in the Apex Logistics agreement.',
        priority: 'High',
        unread: true,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        tags: ['contracts', 'urgent'],
      },
      {
        id: 'inb-2',
        type: 'email',
        from: 'Sarah Kim',
        subject: 'New Pallet Order - BlueLine Distribution',
        preview: 'BlueLine Distribution has placed a new order for 500 standard pallets. They\'re requesting a 15% volume discount based on their annual commitment.',
        priority: 'Medium',
        unread: true,
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        tags: ['orders', 'pricing'],
      },
      {
        id: 'inb-3',
        type: 'notification',
        from: 'System',
        subject: 'Cash Position Alert',
        preview: 'Your operating account balance has dropped below the $50,000 threshold. Current balance: $47,230. Two pending payables totaling $12,400 are due this week.',
        priority: 'High',
        unread: false,
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        tags: ['finance', 'alert'],
      },
      {
        id: 'inb-4',
        type: 'email',
        from: 'James Wright',
        subject: 'Warehouse Capacity Planning',
        preview: 'We\'re at 87% warehouse capacity. With the seasonal uptick coming, we should discuss either expanding storage or optimizing our current layout.',
        priority: 'Medium',
        unread: false,
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        tags: ['operations'],
      },
      {
        id: 'inb-5',
        type: 'email',
        from: 'Lisa Rodriguez',
        subject: 'Insurance Policy Renewal Quote',
        preview: 'Attached is the renewal quote for our general liability and workers comp policies. Premium increase of 8% from last year. Alternative quotes from two other carriers included.',
        priority: 'Low',
        unread: false,
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        tags: ['insurance', 'finance'],
      },
    ],
  });
});

router.get('/api/authority-queue', async (_req: Request, res: Response) => {
  res.json({
    pendingApprovals: [
      {
        id: 'aq-1',
        type: 'invoice',
        title: 'Apex Logistics Invoice #4892',
        amount: 8750,
        currency: 'usd',
        requestedBy: 'Marcus Chen',
        risk: 'Medium',
        status: 'pending',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'aq-2',
        type: 'contract',
        title: 'BlueLine Distribution Service Agreement',
        amount: 45000,
        currency: 'usd',
        requestedBy: 'Sarah Kim',
        risk: 'Low',
        status: 'pending',
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'aq-3',
        type: 'expense',
        title: 'Forklift Maintenance - Q4',
        amount: 3200,
        currency: 'usd',
        requestedBy: 'James Wright',
        risk: 'Low',
        status: 'pending',
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      },
    ],
    recentReceipts: [
      {
        id: 'rc-1',
        type: 'payment',
        title: 'Payroll - November 2025',
        amount: 34500,
        currency: 'usd',
        status: 'completed',
        completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'rc-2',
        type: 'payment',
        title: 'Utility Bill - Warehouse',
        amount: 2180,
        currency: 'usd',
        status: 'completed',
        completedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    ],
  });
});

router.post('/api/authority-queue/:id/approve', async (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ id, status: 'approved', approvedAt: new Date().toISOString() });
});

router.post('/api/authority-queue/:id/deny', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  res.json({ id, status: 'denied', reason, deniedAt: new Date().toISOString() });
});

export default router;
