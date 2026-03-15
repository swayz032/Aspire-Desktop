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

if (!SUPABASE_WEB_CONFIGURED && isProductionRuntime()) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in production.');
}

if (!SUPABASE_WEB_CONFIGURED && !DEV_BYPASS) {
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
