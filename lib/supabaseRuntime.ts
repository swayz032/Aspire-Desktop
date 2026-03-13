export function hasSupabaseWebConfig(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.EXPO_PUBLIC_SUPABASE_URL?.trim() && env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

export function allowDevSupabaseBypass(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isProductionRuntime(env) && !hasSupabaseWebConfig(env);
}
