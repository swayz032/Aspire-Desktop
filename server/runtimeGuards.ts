export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = (env.NODE_ENV || '').trim().toLowerCase();
  const aspireEnv = (env.ASPIRE_ENV || '').trim().toLowerCase();
  return nodeEnv === 'production' || aspireEnv === 'production';
}

export function allowInsecureWebhookSandbox(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isProductionEnv(env);
}

export function resolveGooglePlacesApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const serverKey = (env.GOOGLE_MAPS_API_KEY || '').trim();
  if (serverKey) return serverKey;
  if (!isProductionEnv(env)) {
    return (env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '').trim();
  }
  return '';
}
