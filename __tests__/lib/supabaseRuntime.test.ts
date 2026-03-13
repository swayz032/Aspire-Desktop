import { allowDevSupabaseBypass, hasSupabaseWebConfig, isProductionRuntime } from '../../lib/supabaseRuntime';

describe('supabaseRuntime', () => {
  it('detects when web Supabase config is complete', () => {
    expect(hasSupabaseWebConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('treats partial config as not configured', () => {
    expect(hasSupabaseWebConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('recognizes production runtime', () => {
    expect(isProductionRuntime({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
    expect(isProductionRuntime({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('allows bypass only outside production with missing config', () => {
    expect(allowDevSupabaseBypass({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
    expect(allowDevSupabaseBypass({
      NODE_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    } as NodeJS.ProcessEnv)).toBe(false);
    expect(allowDevSupabaseBypass({
      NODE_ENV: 'development',
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    } as NodeJS.ProcessEnv)).toBe(false);
  });
});
