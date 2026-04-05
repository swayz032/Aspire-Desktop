import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '@/types';
import { getSuiteProfile, getTenantIdentity } from '@/lib/api';
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
  suiteId?: string;
  officeId?: string;
  suiteDisplayId?: string;
  officeDisplayId?: string;
  businessName?: string;
  ownerName?: string;
};

function readBootstrapIdentityCache(): BootstrapIdentityCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOOTSTRAP_IDENTITY_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BootstrapIdentityCache;
  } catch {
    return null;
  }
}

function mapSuiteProfileToTenant(profile: any): Tenant {
  return {
    id: profile.id ?? profile.suite_id ?? '',
    businessName: profile.business_name ?? profile.businessName ?? 'Aspire Business',
    suiteId: profile.suite_id ?? profile.suiteId ?? '',
    officeId: profile.office_id ?? profile.officeId ?? '',
    displayId: profile.display_id ?? profile.displayId ?? undefined,
    officeDisplayId: profile.office_display_id ?? profile.officeDisplayId ?? undefined,
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

  // Pre-populate from bootstrap cache so UI renders instantly with last-known data
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
      const cached = readBootstrapIdentityCache();
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
      // Persist to bootstrap cache so next load is instant
      try {
        if (typeof window !== 'undefined') {
          const cacheData: BootstrapIdentityCache = {
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
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
      const cached = readBootstrapIdentityCache();
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
