import type { Session } from '@supabase/supabase-js';

import { getValidatedSession, type SupabaseAuthLike } from '@/lib/auth/validatedSession';

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
  currentSession?: Session | null;
  refreshedSession?: Session | null;
  validTokens?: string[];
}): SupabaseAuthLike {
  const validTokens = new Set(config.validTokens ?? []);

  return {
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

describe('getValidatedSession', () => {
  it('returns the current session when the current token validates', async () => {
    const session = makeSession('current-token');
    const auth = makeAuthMock({
      currentSession: session,
      validTokens: ['current-token'],
    });

    await expect(getValidatedSession(auth)).resolves.toEqual(session);
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes and returns the refreshed session when the current token fails validation', async () => {
    const currentSession = makeSession('stale-token');
    const refreshedSession = makeSession('fresh-token');
    const auth = makeAuthMock({
      currentSession,
      refreshedSession,
      validTokens: ['fresh-token'],
    });

    await expect(getValidatedSession(auth)).resolves.toEqual(refreshedSession);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('returns null when neither the current nor refreshed session validates', async () => {
    const auth = makeAuthMock({
      currentSession: makeSession('stale-token'),
      refreshedSession: makeSession('still-stale-token'),
      validTokens: [],
    });

    await expect(getValidatedSession(auth)).resolves.toBeNull();
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });
});
