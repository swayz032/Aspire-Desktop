import type { Session } from '@supabase/supabase-js';

import {
  signInWithVerifiedSession,
  UNVERIFIED_SESSION_ERROR,
  type SupabasePasswordAuthLike,
} from '@/lib/auth/passwordAuthFlow';

function makeSession(accessToken: string): Session {
  return {
    access_token: accessToken,
    refresh_token: `${accessToken}-refresh`,
    expires_in: 3600,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user: {
      id: `user-${accessToken}`,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${accessToken}@example.com`,
      app_metadata: {},
      user_metadata: {},
      identities: [],
      created_at: '2026-04-19T00:00:00.000Z',
      updated_at: '2026-04-19T00:00:00.000Z',
    },
  };
}

function makeAuthMock(config: {
  signInError?: string | null;
  currentSession?: Session | null;
  refreshedSession?: Session | null;
  validTokens?: string[];
}): SupabasePasswordAuthLike {
  const validTokens = new Set(config.validTokens ?? []);

  return {
    signInWithPassword: jest.fn(async () => ({
      error: config.signInError ? { message: config.signInError } : null,
    })),
    getSession: jest.fn(async () => ({ data: { session: config.currentSession ?? null } })),
    refreshSession: jest.fn(async () => ({ data: { session: config.refreshedSession ?? null } })),
    getUser: jest.fn(async (jwt?: string) => {
      if (jwt && validTokens.has(jwt)) {
        return { data: { user: { id: `user-${jwt}` } as any }, error: null };
      }
      return { data: { user: null }, error: { message: 'invalid jwt' } as any };
    }),
  };
}

describe('signInWithVerifiedSession', () => {
  it('returns a validated session after a successful sign-in', async () => {
    const session = makeSession('current-token');
    const auth = makeAuthMock({
      currentSession: session,
      validTokens: ['current-token'],
    });

    await expect(signInWithVerifiedSession(auth, 'user@example.com', 'secret')).resolves.toEqual({
      session,
      error: null,
    });
  });

  it('recovers by using an already valid session when sign-in returns an auth error', async () => {
    const session = makeSession('current-token');
    const auth = makeAuthMock({
      signInError: 'Invalid login credentials',
      currentSession: session,
      validTokens: ['current-token'],
    });

    await expect(signInWithVerifiedSession(auth, 'user@example.com', 'secret')).resolves.toEqual({
      session,
      error: null,
    });
  });

  it('returns the auth error when sign-in fails and no valid session exists', async () => {
    const auth = makeAuthMock({
      signInError: 'Invalid login credentials',
      currentSession: null,
      validTokens: [],
    });

    await expect(signInWithVerifiedSession(auth, 'user@example.com', 'secret')).resolves.toEqual({
      session: null,
      error: 'Invalid login credentials',
    });
  });

  it('returns a verification error when sign-in succeeds but no validated session can be resolved', async () => {
    const auth = makeAuthMock({
      currentSession: null,
      validTokens: [],
    });

    await expect(signInWithVerifiedSession(auth, 'user@example.com', 'secret')).resolves.toEqual({
      session: null,
      error: UNVERIFIED_SESSION_ERROR,
    });
  });
});
