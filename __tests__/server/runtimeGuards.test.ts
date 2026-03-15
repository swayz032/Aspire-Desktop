import { allowInsecureWebhookSandbox, isProductionEnv, resolveGooglePlacesApiKey } from '../../server/runtimeGuards';

describe('runtimeGuards', () => {
  test('production is detected from NODE_ENV', () => {
    expect(isProductionEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
  });

  test('production is detected from ASPIRE_ENV', () => {
    expect(isProductionEnv({ ASPIRE_ENV: 'production' } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  test('insecure webhook sandbox is blocked in production', () => {
    expect(allowInsecureWebhookSandbox({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  test('google places uses server key in production', () => {
    const env = {
      NODE_ENV: 'production',
      GOOGLE_MAPS_API_KEY: 'server-key',
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: 'public-key',
    } as NodeJS.ProcessEnv;

    expect(resolveGooglePlacesApiKey(env)).toBe('server-key');
  });

  test('google places does not use public fallback in production', () => {
    const env = {
      NODE_ENV: 'production',
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: 'public-key',
    } as NodeJS.ProcessEnv;

    expect(resolveGooglePlacesApiKey(env)).toBe('');
  });

  test('google places allows public fallback in non-production', () => {
    const env = {
      NODE_ENV: 'development',
      EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: 'public-key',
    } as NodeJS.ProcessEnv;

    expect(resolveGooglePlacesApiKey(env)).toBe('public-key');
  });
});
