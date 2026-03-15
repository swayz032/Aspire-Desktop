import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { allowDevSupabaseBypass, hasSupabaseWebConfig, isProductionRuntime } from './supabaseRuntime';

const SUPABASE_WEB_CONFIGURED = hasSupabaseWebConfig();
const DEV_BYPASS = allowDevSupabaseBypass();
const SUPABASE_URL = SUPABASE_WEB_CONFIGURED
  ? process.env.EXPO_PUBLIC_SUPABASE_URL!
  : 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = SUPABASE_WEB_CONFIGURED
  ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
  : 'placeholder-anon-key';

if (!SUPABASE_WEB_CONFIGURED && !DEV_BYPASS) {
  // Only throw when neither Supabase config nor bypass is set.
  // Note: isProductionRuntime() is always true for Expo web builds regardless of environment,
  // so we rely on the explicit DEV_BYPASS flag instead of NODE_ENV.
  if (isProductionRuntime()) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Set EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true to run without Supabase credentials.',
    );
  }
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS=true only for local development.',
  );
}

if (DEV_BYPASS) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — Supabase client will use placeholder values (dev bypass mode).',
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
