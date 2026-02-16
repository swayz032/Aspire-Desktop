/**
 * Mock seed is a no-op in production.
 * All data comes from Supabase via lib/api.ts.
 */

export function seedDatabase(): void {
  // no-op — all data is fetched from Supabase
}

export function isDbSeeded(): boolean {
  return true;
}
