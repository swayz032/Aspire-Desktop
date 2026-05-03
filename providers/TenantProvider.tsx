import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '@/types';
import { getSuiteProfile, getTenantIdentity, NoSuiteScopeError } from '@/lib/api';
import { useSupabase } from './SupabaseProvider';

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
  children: ReactNode;
}

const BOOTSTRAP_IDENTITY_CACHE_KEY = 'aspire.bootstrap.identity';

type BootstrapIdentityCache = {
  // userId is REQUIRED for the cache to be considered valid — prevents tenant
  // data from leaking between users (e.g. admin's cache showing up for a
  // regular user, or vice versa).
  userId?: string;
  suiteId?: string;
  officeId?: string;
  suiteDisplayId?: string;
  officeDisplayId?: string;
  businessName?: string;
  ownerName?: string;
};

function readBootstrapIdentityCache(currentUserId?: string): BootstrapIdentityCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootstrapIdentityCache;
    // Discard cache that belongs to a different user. Without this guard the
    // admin's cached identity leaks into a regular user's session (and vice
    // versa) when localStorage persists across logins.
    if (currentUserId && parsed.userId && parsed.userId !== currentUserId) {
      window.localStorage.removeItem(BOOTSTRAP_IDENTITY_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function mapSuiteProfileToTenant(profile: any): Tenant {
  // Aspire's data model is currently 1:1 suite-to-office. There is no
  // separate `office_profiles` table; office identity lives on
  // `suite_profiles` via `office_display_id`. When a profile fetch returns
  // no `office_id` (older sessions, partial onboarding metadata), fall
  // back to `suite_id` so downstream API calls (e.g. `/v1/front-desk/*`,
  // capability tokens) have a valid office scope. Same pattern for
  // `officeDisplayId` — fall back to `display_id` so the header shows a
  // human-readable identifier instead of "Pending".
  const suiteIdResolved = profile.suite_id ?? profile.suiteId ?? '';
  const displayIdResolved = profile.display_id ?? profile.displayId ?? undefined;
  return {
    id: profile.id ?? profile.suite_id ?? '',
    businessName: profile.business_name ?? profile.businessName ?? 'Aspire Business',
    suiteId: suiteIdResolved,
    officeId: profile.office_id ?? profile.officeId ?? suiteIdResolved,
    displayId: displayIdResolved,
    officeDisplayId:
      profile.office_display_id ?? profile.officeDisplayId ?? displayIdResolved ?? undefined,
    ownerName: profile.owner_name ?? profile.ownerName ?? '',
    ownerEmail: profile.owner_email ?? profile.ownerEmail ?? '',
    role: profile.role ?? 'Founder',
    timezone: profile.timezone ?? 'America/Los_Angeles',
    currency: profile.currency ?? 'USD',
    createdAt: profile.created_at ?? profile.createdAt ?? new Date().toISOString(),
    updatedAt: profile.updated_at ?? profile.updatedAt ?? new Date().toISOString(),
    // Intake fields from suite_profiles (populated after onboarding)
    industry: profile.industry ?? null,
    industrySpecialty: profile.industry_specialty ?? profile.industrySpecialty ?? null,
    incomeRange: profile.income_range ?? profile.incomeRange ?? null,
    referralSource: profile.referral_source ?? profile.referralSource ?? null,
    gender: profile.gender ?? null,
    teamSize: profile.team_size ?? profile.teamSize ?? null,
    entityType: profile.entity_type ?? profile.entityType ?? null,
    yearsInBusiness: profile.years_in_business ?? profile.yearsInBusiness ?? null,
    businessGoals: profile.business_goals ?? profile.businessGoals ?? null,
    painPoint: profile.pain_point ?? profile.painPoint ?? null,
    salesChannel: profile.sales_channel ?? profile.salesChannel ?? null,
    customerType: profile.customer_type ?? profile.customerType ?? null,
    preferredChannel: profile.preferred_channel ?? profile.preferredChannel ?? null,
    onboardingCompleted: !!(profile.onboarding_completed_at ?? profile.onboardingCompletedAt),
  };
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { session, isLoading: authLoading } = useSupabase();

  // Pre-populate from bootstrap cache so UI renders instantly with last-known data.
  // Note: at first mount we don't yet know which user is signing in; the cache
  // guard reads `parsed.userId` and discards it on the next loadTenant() call
  // if it belongs to a different user.
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    const cached = readBootstrapIdentityCache();
    if (!cached?.suiteId) return null;
    return {
      id: cached.suiteId,
      businessName: cached.businessName || 'Aspire Business',
      suiteId: cached.suiteId,
      officeId: cached.officeId || '',
      displayId: cached.suiteDisplayId || undefined,
      officeDisplayId: cached.officeDisplayId || undefined,
      ownerName: cached.ownerName || '',
      ownerEmail: '',
      role: 'Founder',
      timezone: 'America/New_York',
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      industry: null, industrySpecialty: null, incomeRange: null,
      referralSource: null, gender: null, teamSize: null,
      entityType: null, yearsInBusiness: null, businessGoals: null,
      painPoint: null, salesChannel: null, customerType: null,
      preferredChannel: null, onboardingCompleted: true,
    };
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = async () => {
    const currentUserId = session?.user?.id;
    try {
      setIsLoading(true);
      setError(null);
      const profile = await getSuiteProfile();
      const mapped = mapSuiteProfileToTenant(profile);
      let identity: { suiteDisplayId?: string; officeDisplayId?: string; businessName?: string } | null = null;
      try {
        identity = await getTenantIdentity();
      } catch (identityErr) {
        // Log but don't block — identity is supplementary to profile
        if (__DEV__) console.warn('[TenantProvider] Identity fetch failed:', identityErr);
        identity = null;
      }
      const cached = readBootstrapIdentityCache(currentUserId);
      if (cached) {
        setTenant({
          ...mapped,
          businessName: mapped.businessName || identity?.businessName || cached.businessName || 'Aspire Business',
          ownerName: mapped.ownerName || cached.ownerName || '',
          suiteId: mapped.suiteId || cached.suiteId || '',
          officeId: mapped.officeId || cached.officeId || '',
          displayId: mapped.displayId || identity?.suiteDisplayId || cached.suiteDisplayId || undefined,
          officeDisplayId: mapped.officeDisplayId || identity?.officeDisplayId || cached.officeDisplayId || undefined,
        });
      } else {
        setTenant({
          ...mapped,
          businessName: mapped.businessName || identity?.businessName || 'Aspire Business',
          displayId: mapped.displayId || identity?.suiteDisplayId || undefined,
          officeDisplayId: mapped.officeDisplayId || identity?.officeDisplayId || undefined,
        });
      }
      // Persist to bootstrap cache so next load is instant. Bind to userId so
      // a different user signing in on the same browser doesn't inherit this
      // session's tenant data.
      try {
        if (typeof window !== 'undefined' && currentUserId) {
          const cacheData: BootstrapIdentityCache = {
            userId: currentUserId,
            suiteId: mapped.suiteId,
            officeId: mapped.officeId,
            suiteDisplayId: mapped.displayId || identity?.suiteDisplayId,
            officeDisplayId: mapped.officeDisplayId || identity?.officeDisplayId,
            businessName: mapped.businessName || identity?.businessName,
            ownerName: mapped.ownerName,
          };
          window.localStorage.setItem(BOOTSTRAP_IDENTITY_CACHE_KEY, JSON.stringify(cacheData));
        }
      } catch (_e) { /* localStorage may be unavailable */ }
    } catch (err) {
      // Platform admin (no metadata.suite_id, multi-membership) has no single
      // tenant to load. Don't surface an error — admin UIs render a tenant
      // picker / overview instead of a per-suite dashboard.
      if (err instanceof NoSuiteScopeError) {
        setError(null);
        setTenant(null);
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(BOOTSTRAP_IDENTITY_CACHE_KEY);
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
      const cached = readBootstrapIdentityCache(currentUserId);
      if (cached?.suiteId) {
        setTenant({
          id: cached.suiteId,
          businessName: cached.businessName || 'Aspire Business',
          suiteId: cached.suiteId,
          officeId: cached.officeId || '',
          displayId: cached.suiteDisplayId || undefined,
          officeDisplayId: cached.officeDisplayId || undefined,
          ownerName: cached.ownerName || '',
          ownerEmail: '',
          role: 'Founder',
          timezone: 'America/New_York',
          currency: 'USD',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          industry: null,
          industrySpecialty: null,
          incomeRange: null,
          referralSource: null,
          gender: null,
          teamSize: null,
          entityType: null,
          yearsInBusiness: null,
          businessGoals: null,
          painPoint: null,
          salesChannel: null,
          customerType: null,
          preferredChannel: null,
          onboardingCompleted: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before querying RLS-protected tables
    if (authLoading) return;
    // Only fetch if we have a session (authenticated user)
    if (!session) {
      setTenant(null);
      setIsLoading(false);
      return;
    }
    loadTenant();
  }, [session, authLoading]);

  const value: TenantContextType = {
    tenant,
    isLoading,
    error,
    refresh: loadTenant,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
