import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { allowDevSupabaseBypass } from '@/lib/supabaseRuntime';
import type { Session } from '@supabase/supabase-js';

const DEV_BYPASS_AUTH = allowDevSupabaseBypass();

const DEV_FAKE_SESSION = {
  access_token: 'dev-bypass-token',
  refresh_token: 'dev-bypass-refresh',
  expires_in: 999999,
  token_type: 'bearer',
  user: {
    id: 'dev-user-00000000-0000-0000-0000-000000000000',
    email: 'dev@aspire.local',
    role: 'authenticated',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: { suite_id: 'dev-suite-00000000-0000-0000-0000-000000000000' },
    created_at: new Date().toISOString(),
  },
} as unknown as Session;

interface SupabaseContextType {
  session: Session | null;
  isLoading: boolean;
  suiteId: string | null;
  signOut: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(DEV_BYPASS_AUTH ? DEV_FAKE_SESSION : null);
  const [isLoading, setIsLoading] = useState(DEV_BYPASS_AUTH ? false : true);
  // Prevent rapid session oscillation — if session was valid within the last 2s,
  // don't set it to null (wait for a stable SIGNED_OUT event instead).
  const lastValidSessionRef = useRef<number>(0);
  // When true, stableSetSession skips refresh-attempt logic — the user explicitly signed out.
  const deliberateSignOutRef = useRef(false);
  const stableSetSession = (s: Session | null) => {
    if (s) {
      // If a deliberate sign-out is in progress, ignore any session restoration
      // (e.g. from a refresh race or stale auth event).
      if (deliberateSignOutRef.current) return;
      lastValidSessionRef.current = Date.now();
      setSession(s);
    } else {
      // Deliberate sign-out — accept null immediately, no refresh attempt.
      if (deliberateSignOutRef.current) {
        setSession(null);
        return;
      }
      const timeSinceValid = Date.now() - lastValidSessionRef.current;
      if (timeSinceValid < 2000 && lastValidSessionRef.current > 0) {
        // Session was valid very recently — likely a token refresh race, not a real signout.
        // Attempt refresh before accepting null.
        supabase.auth.refreshSession().then(({ data }) => {
          if (data.session) {
            lastValidSessionRef.current = Date.now();
            setSession(data.session);
          } else {
            setSession(null);
          }
        }).catch(() => {
          setSession(null);
        });
        return;
      }
      setSession(null);
    }
  };

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    let authChangeReceived = false;
    let initialSessionFetched = false;

    // Subscribe to auth changes FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      stableSetSession(s);
      authChangeReceived = true;
      if (initialSessionFetched) setIsLoading(false);
    });

    // Then restore from storage
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        if (s) stableSetSession(s);
        initialSessionFetched = true;
        // Only stop loading once we've had at least one auth change event OR getSession finished
        if (authChangeReceived || s) setIsLoading(false);
        // Fallback for no-session case: wait 500ms for listener to settle
        setTimeout(() => setIsLoading(false), 500);
      })
      .catch(() => {
        setIsLoading(false); // Never hang on error
      });

    return () => subscription.unsubscribe();
  }, []);

  // Visibility-change token refresh — handles backgrounded tab where token expired
  useEffect(() => {
    if (DEV_BYPASS_AUTH || Platform.OS !== 'web') return;
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const { data } = await supabase.auth.getSession();
        if (!data.session && session) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (!refreshed.session) {
            stableSetSession(null);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [session]);

  const suiteId = session?.user?.user_metadata?.suite_id ?? null;

  const signOut = async () => {
    if (DEV_BYPASS_AUTH) return;
    // Mark deliberate sign-out BEFORE calling supabase.auth.signOut() —
    // prevents stableSetSession from re-establishing the session via refreshSession().
    deliberateSignOutRef.current = true;
    lastValidSessionRef.current = 0;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('[Auth] Sign out API error:', e);
    }
    setSession(null);
    // Clear all Aspire-related storage
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('aspire.bootstrap.identity');
      window.localStorage.removeItem('aspire-desktop-auth');
      const keys = Object.keys(window.localStorage);
      keys.forEach(k => {
        if (k.startsWith('sb-') || k.startsWith('supabase.')) {
          window.localStorage.removeItem(k);
        }
      });
    }
  };

  return (
    <SupabaseContext.Provider value={{ session, isLoading, suiteId, signOut }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase(): SupabaseContextType {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
}
