import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const DEV_BYPASS_AUTH = !process.env.EXPO_PUBLIC_SUPABASE_URL;

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

  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  const suiteId = session?.user?.user_metadata?.suite_id ?? null;

  const signOut = async () => {
    if (DEV_BYPASS_AUTH) return;
    await supabase.auth.signOut();
    setSession(null);
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
