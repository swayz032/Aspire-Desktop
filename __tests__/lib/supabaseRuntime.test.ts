describe('supabaseRuntime', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('detects when web Supabase config is complete', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const { hasSupabaseWebConfig } = require('../../lib/supabaseRuntime');
    expect(hasSupabaseWebConfig()).toBe(true);
  });

  it('treats partial config as not configured', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const { hasSupabaseWebConfig } = require('../../lib/supabaseRuntime');
    expect(hasSupabaseWebConfig()).toBe(false);
  });

  it('recognizes production runtime', () => {
    process.env.NODE_ENV = 'production';
    const mod1 = require('../../lib/supabaseRuntime');
    expect(mod1.isProductionRuntime()).toBe(true);

    jest.resetModules();
    process.env.NODE_ENV = 'development';
    const mod2 = require('../../lib/supabaseRuntime');
    expect(mod2.isProductionRuntime()).toBe(false);
  });

  it('allows bypass only outside production with missing config', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const mod1 = require('../../lib/supabaseRuntime');
    expect(mod1.allowDevSupabaseBypass()).toBe(true);

    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    const mod2 = require('../../lib/supabaseRuntime');
    expect(mod2.allowDevSupabaseBypass()).toBe(false);

    jest.resetModules();
    process.env.NODE_ENV = 'development';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    const mod3 = require('../../lib/supabaseRuntime');
    expect(mod3.allowDevSupabaseBypass()).toBe(false);
  });
});
