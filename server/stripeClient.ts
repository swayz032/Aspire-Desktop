import Stripe from 'stripe';
import { handleProviderAuthError } from './secrets';
import { logger } from './logger';

let stripeInstance: Stripe | null = null;

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_CONNECT_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not found in environment');
  }
  return key;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const secretKey = getSecretKey();
  return new Stripe(secretKey, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  });
}

/**
 * Execute a Stripe operation with automatic secret rotation retry.
 * If the operation fails with an auth error (stale key after rotation),
 * reloads secrets from SM and retries once.
 */
export async function withStripeRetry<T>(
  operation: (stripe: Stripe) => Promise<T>
): Promise<T> {
  const client = await getUncachableStripeClient();
  try {
    return await operation(client);
  } catch (error: unknown) {
    const reloaded = await handleProviderAuthError('stripe', error);
    if (reloaded) {
      // Retry once with fresh credentials
      const freshClient = await getUncachableStripeClient();
      return await operation(freshClient);
    }
    throw error;
  }
}

export async function getStripePublishableKey(): Promise<string> {
  const key = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error('STRIPE_PUBLISHABLE_KEY not found in environment');
  }
  return key;
}

export async function getStripeSecretKey(): Promise<string> {
  return getSecretKey();
}

let stripeSync: { processWebhook: (payload: Buffer, sig: string) => Promise<void>; findOrCreateManagedWebhook: (url: string) => Promise<any>; syncBackfill: () => Promise<any> } | null = null;

export async function getStripeSync() {
  if (!stripeSync) {
    try {
      const { StripeSync } = await import('stripe-replit-sync');
      const secretKey = getSecretKey();
      stripeSync = new StripeSync({
        poolConfig: {
          connectionString: process.env.DATABASE_URL!,
          max: 2,
        },
        stripeSecretKey: secretKey,
      });
    } catch (e) {
      logger.info('stripe-replit-sync not available, skipping sync setup');
      return null;
    }
  }
  return stripeSync;
}
