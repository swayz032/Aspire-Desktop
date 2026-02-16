import Stripe from 'stripe';

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
    apiVersion: '2024-12-18.acacia' as any,
  });
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

let stripeSync: any = null;

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
      console.log('stripe-replit-sync not available, skipping sync setup');
      return null;
    }
  }
  return stripeSync;
}
