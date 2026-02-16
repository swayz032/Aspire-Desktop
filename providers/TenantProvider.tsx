import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '@/types';
import { getSuiteProfile } from '@/lib/api';

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

function mapSuiteProfileToTenant(profile: any): Tenant {
  return {
    id: profile.id ?? profile.suite_id ?? '',
    businessName: profile.business_name ?? profile.businessName ?? 'Aspire Business',
    suiteId: profile.suite_id ?? profile.suiteId ?? '',
    officeId: profile.office_id ?? profile.officeId ?? '',
    ownerName: profile.owner_name ?? profile.ownerName ?? '',
    ownerEmail: profile.owner_email ?? profile.ownerEmail ?? '',
    role: profile.role ?? 'Founder',
    timezone: profile.timezone ?? 'America/Los_Angeles',
    currency: profile.currency ?? 'USD',
    createdAt: profile.created_at ?? profile.createdAt ?? new Date().toISOString(),
    updatedAt: profile.updated_at ?? profile.updatedAt ?? new Date().toISOString(),
  };
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const profile = await getSuiteProfile();
      setTenant(mapSuiteProfileToTenant(profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, []);

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
