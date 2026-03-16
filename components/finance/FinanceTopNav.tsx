import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, type Href } from 'expo-router';
import { useSupabase, useTenant } from '@/providers';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type SubItem = {
  id: string;
  label: string;
  icon: IoniconsName;
  route: Href;
};

type NavPill = {
  id: string;
  label: string;
  route: Href;
  isExternal?: boolean;
  subItems?: SubItem[];
};

const navPills: NavPill[] = [
  { id: 'home', label: 'Home', route: '/(tabs)', isExternal: true },
  { id: 'overview', label: 'Overview', route: '/finance-hub' },
  { id: 'cash', label: 'Cash', route: '/finance-hub/cash' },
  { id: 'books', label: 'Books', route: '/finance-hub/books' },
  {
    id: 'payroll',
    label: 'Payroll',
    route: '/finance-hub/payroll',
    subItems: [
      { id: 'payroll-run', label: 'Run Payroll', icon: 'play-circle-outline', route: '/finance-hub/payroll' },
      { id: 'payroll-people', label: 'People', icon: 'people-outline', route: '/finance-hub/payroll/people' },
      { id: 'payroll-contractors', label: 'Contractors', icon: 'briefcase-outline', route: '/finance-hub/payroll/contractors' },
      { id: 'payroll-timeoff', label: 'Time Off', icon: 'calendar-outline', route: '/finance-hub/payroll/time-off' },
      { id: 'payroll-tax', label: 'Tax & Compliance', icon: 'shield-checkmark-outline', route: '/finance-hub/payroll/tax-compliance' },
      { id: 'payroll-history', label: 'Pay History', icon: 'time-outline', route: '/finance-hub/payroll/pay-history' },
      { id: 'payroll-settings', label: 'Settings', icon: 'settings-outline', route: '/finance-hub/payroll/settings' },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    route: '/finance-hub/invoices',
    subItems: [
      { id: 'invoices-list', label: 'All Invoices', icon: 'document-text-outline', route: '/finance-hub/invoices' },
      { id: 'invoices-quotes', label: 'Quotes', icon: 'pricetag-outline', route: '/finance-hub/quotes' },
      { id: 'invoices-clients', label: 'Clients', icon: 'people-outline', route: '/finance-hub/clients' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    route: '/finance-hub/documents',
    subItems: [
      { id: 'docs-all', label: 'All Documents', icon: 'documents-outline', route: '/finance-hub/documents' },
      { id: 'docs-templates', label: 'Templates', icon: 'copy-outline', route: '/finance-hub/documents/templates' },
      { id: 'docs-pending', label: 'Awaiting Signature', icon: 'create-outline', route: '/finance-hub/documents/pending' },
    ],
  },
  { id: 'connections', label: 'Connections', route: '/finance-hub/connections' },
  { id: 'receipts', label: 'Memory', route: '/finance-hub/receipts' },
];

interface FinanceTopNavProps {
  isTablet?: boolean;
}

export function FinanceTopNav({ isTablet }: FinanceTopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-finance-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  const isActive = (pill: NavPill) => {
    if (pill.isExternal) return false;
    if (pill.route === '/finance-hub') {
      return pathname === '/finance-hub' || pathname === '/finance-hub/';
    }
    if (pill.id === 'payroll') return pathname.startsWith('/finance-hub/payroll');
    if (pill.id === 'invoices') {
      return pathname === '/finance-hub/invoices' || pathname.startsWith('/finance-hub/quotes') || pathname.startsWith('/finance-hub/clients');
    }
    if (pill.id === 'documents') return pathname.startsWith('/finance-hub/documents');
    return pathname.startsWith(pill.route);
  };

  const isSubActive = (sub: SubItem) => {
    if (sub.route === '/finance-hub/payroll') return pathname === '/finance-hub/payroll' || pathname === '/finance-hub/payroll/';
    if (sub.route === '/finance-hub/invoices') return pathname === '/finance-hub/invoices' || pathname === '/finance-hub/invoices/';
    if (sub.route === '/finance-hub/documents') return pathname === '/finance-hub/documents' || pathname === '/finance-hub/documents/';
    return pathname === sub.route || pathname === sub.route + '/';
  };

  const handlePillPress = (pill: NavPill) => {
    if (pill.subItems && pill.subItems.length > 0) {
      setOpenDropdown(prev => prev === pill.id ? null : pill.id);
    } else {
      setOpenDropdown(null);
      router.push(pill.route);
    }
  };

  const handleSubPress = (sub: SubItem) => {
    setOpenDropdown(null);
    router.push(sub.route);
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.brandText}>Finance Hub</Text>
      </View>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 24,
      paddingRight: 24,
      backgroundColor: 'transparent',
      position: 'relative' as const,
      zIndex: 100,
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1C1C1E',
        borderRadius: 26,
        padding: '3px 4px',
        border: '1px solid rgba(255,255,255,0.04)',
        gap: 1,
        position: 'relative' as const,
        ...(isTablet ? { overflowX: 'auto' as const, whiteSpace: 'nowrap' as const, maxWidth: 'calc(100% - 240px)' } : {}),
      }} data-finance-dropdown="true">
        {navPills.map((pill) => {
          const active = isActive(pill);
          const hasDropdown = pill.subItems && pill.subItems.length > 0;
          const isDropdownOpen = openDropdown === pill.id;

          return (
            <div key={pill.id} style={{ position: 'relative' as const }}>
              <button
                onClick={() => handlePillPress(pill)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '6px 14px',
                  borderRadius: 22,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#0A0A0F' : 'rgba(255,255,255,0.5)',
                  background: active
                    ? 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)'
                    : 'transparent',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap' as const,
                  letterSpacing: '-0.1px',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {pill.label}
                {hasDropdown && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ marginLeft: 1, opacity: 0.6, transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                    <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={active ? '#0A0A0F' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {hasDropdown && isDropdownOpen && (
                <div style={{
                  position: 'absolute' as const,
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: 200,
                  background: 'linear-gradient(180deg, #161620 0%, #111118 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: '6px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                  zIndex: 200,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}>
                  {pill.subItems!.map((sub) => {
                    const subActive = isSubActive(sub);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubPress(sub)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          outline: 'none',
                          cursor: 'pointer',
                          background: subActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                          transition: 'all 0.15s ease',
                          textAlign: 'left' as const,
                        }}
                        onMouseEnter={(e) => {
                          if (!subActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (!subActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <Ionicons name={sub.icon} size={15} color={subActive ? '#3B82F6' : 'rgba(255,255,255,0.4)'} />
                        <span style={{
                          fontSize: 13,
                          fontWeight: subActive ? 600 : 400,
                          color: subActive ? '#3B82F6' : 'rgba(255,255,255,0.7)',
                          letterSpacing: '-0.1px',
                        }}>{sub.label}</span>
                        {subActive && (
                          <div style={{
                            marginLeft: 'auto',
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            background: '#3B82F6',
                            boxShadow: '0 0 6px rgba(59,130,246,0.5)',
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#1A1A24',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  brandText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
