import type { Session, UserResponse } from '@supabase/supabase-js';

type SessionResponse = Promise<{ data: { session: Session | null } }>;
type RefreshResponse = Promise<{ data: { session: Session | null } }>;

export interface SupabaseAuthLike {
  getSession: () => SessionResponse;
  refreshSession: () => RefreshResponse;
  getUser: (jwt?: string) => Promise<UserResponse>;
}

async function validateSession(
  auth: SupabaseAuthLike,
  session: Session | null,
): Promise<Session | null> {
  if (!session?.access_token) return null;

  const { data, error } = await auth.getUser(session.access_token);
  if (error || !data.user) return null;
  return session;
}

export async function getValidatedSession(
  auth: SupabaseAuthLike,
  options?: { allowRefresh?: boolean },
): Promise<Session | null> {
  try {
    const current = await auth.getSession();
    const currentSession = current.data.session;
    const validatedCurrent = await validateSession(auth, currentSession);
    if (validatedCurrent) return validatedCurrent;

    if (!currentSession || options?.allowRefresh === false) return null;

    const refreshed = await auth.refreshSession();
    return validateSession(auth, refreshed.data.session);
  } catch {
    return null;
  }
}
