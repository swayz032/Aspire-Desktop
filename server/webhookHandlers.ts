import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import type Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. '
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const bookingId = session.metadata?.bookingId;
    if (bookingId) {
      await storage.updateBooking(bookingId, {
        paymentStatus: 'paid',
        status: 'confirmed',
        stripeCheckoutSessionId: session.id,
      });
    }
  }

  static async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const bookingId = paymentIntent.metadata?.bookingId;
    if (bookingId) {
      await storage.updateBooking(bookingId, {
        paymentStatus: 'failed',
      });
    }
  }
}
