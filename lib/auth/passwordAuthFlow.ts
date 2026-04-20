import type { Session } from '@supabase/supabase-js';

import { getValidatedSession, type SupabaseAuthLike } from '@/lib/auth/validatedSession';

export const UNVERIFIED_SESSION_ERROR =
  'Signed in, but we could not verify your session. Please try again.';

type PasswordAuthError = { message: string } | null;
type PasswordAuthResponse = Promise<{ error: PasswordAuthError }>;

export interface SupabasePasswordAuthLike extends SupabaseAuthLike {
  signInWithPassword: (credentials: { email: string; password: string }) => PasswordAuthResponse;
}

export interface VerifiedPasswordSignInResult {
  error: string | null;
  session: Session | null;
}

export async function signInWithVerifiedSession(
  auth: SupabasePasswordAuthLike,
  email: string,
  password: string,
): Promise<VerifiedPasswordSignInResult> {
  const { error: authError } = await auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (authError) {
    const recoveredSession = await getValidatedSession(auth);
    if (recoveredSession) {
      return { session: recoveredSession, error: null };
    }

    return { session: null, error: authError.message };
  }

  const validatedSession = await getValidatedSession(auth);
  if (!validatedSession) {
    return { session: null, error: UNVERIFIED_SESSION_ERROR };
  }

  return { session: validatedSession, error: null };
}
