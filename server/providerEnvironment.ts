import { PlaidEnvironments } from 'plaid';
import { isProductionEnv } from './runtimeGuards';

function normalize(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

export function resolvePlaidBasePath(env: NodeJS.ProcessEnv = process.env): string {
  const plaidEnv = normalize(env.PLAID_ENV);
  if (plaidEnv === 'production') return PlaidEnvironments.production;
  if (plaidEnv === 'development') return PlaidEnvironments.development;
  return PlaidEnvironments.sandbox;
}

export function resolveGustoBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const gustoEnv = normalize(env.GUSTO_ENV);
  if (gustoEnv === 'sandbox') return 'https://api.gusto-demo.com';
  if (gustoEnv === 'production') return 'https://api.gusto.com';
  return isProductionEnv(env) ? 'https://api.gusto.com' : 'https://api.gusto-demo.com';
}

export function resolveQboApiBase(env: NodeJS.ProcessEnv = process.env): string {
  const qboEnv = normalize(env.QUICKBOOKS_ENV || env.QBO_ENV);
  if (qboEnv === 'sandbox') return 'https://sandbox-quickbooks.api.intuit.com';
  if (qboEnv === 'production') return 'https://quickbooks.api.intuit.com';
  return isProductionEnv(env) ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com';
}

export function isQuickBooksSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveQboApiBase(env).includes('sandbox-quickbooks');
}
