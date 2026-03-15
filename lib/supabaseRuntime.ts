export function hasSupabaseWebConfig(): boolean {
  // IMPORTANT: Must use process.env.EXPO_PUBLIC_* directly — Metro only inlines
  // direct references, not parameter/variable indirection (env.EXPO_PUBLIC_*).
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function allowDevSupabaseBypass(): boolean {
  const explicitBypass = process.env.EXPO_PUBLIC_ALLOW_SUPABASE_BYPASS === 'true';
  // Allow bypass even in production builds when explicitly set and Supabase is not configured.
  // Expo web always sets NODE_ENV=production at build time, so we cannot use it to gate this.
  return !hasSupabaseWebConfig() && explicitBypass;
}
