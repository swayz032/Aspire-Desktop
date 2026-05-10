import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, type Href } from 'expo-router';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

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
  { id: 'home', label: 'Home', route: '/(tabs)' as Href, isExternal: true },
  { id: 'overview', label: 'Overview', route: '/service-hub' as Href },
  { id: 'service-lab', label: 'Service Lab', route: '/service-hub/service-lab' as Href },
  { id: 'research-lab', label: 'Research Lab', route: '/service-hub/research-lab' as Href },
  {
    id: 'estimate-studio',
    label: 'Estimate Studio',
    route: '/service-hub/estimate-studio' as Href,
    subItems: [
      { id: 'es-visuals',       label: 'Visuals',         icon: 'image-outline',           route: '/service-hub/estimate-studio/visuals' as Href },
      { id: 'es-plans-photos',  label: 'Plans & Photos',  icon: 'document-attach-outline', route: '/service-hub/estimate-studio/plans-photos' as Href },
      { id: 'es-scope',         label: 'Scope',           icon: 'list-outline',            route: '/service-hub/estimate-studio/scope' as Href },
      { id: 'es-materials',     label: 'Materials',       icon: 'cube-outline',            route: '/service-hub/estimate-studio/materials' as Href },
      { id: 'es-takeoff',       label: 'Takeoff',         icon: 'grid-outline',            route: '/service-hub/estimate-studio/takeoff' as Href },
      { id: 'es-estimate',      label: 'Estimate',        icon: 'calculator-outline',      route: '/service-hub/estimate-studio/estimate' as Href },
    ],
  },
  { id: 'marketing', label: 'Marketing', route: '/service-hub/marketing' as Href },
  { id: 'jobs', label: 'Jobs', route: '/service-hub/jobs' as Href },
  { id: 'scheduling', label: 'Scheduling', route: '/service-hub/scheduling' as Href },
  { id: 'contracts', label: 'Contracts', route: '/service-hub/contracts' as Href },
  { id: 'documents', label: 'Documents', route: '/service-hub/documents' as Href },
  { id: 'memory', label: 'Memory', route: '/service-hub/memory' as Href },
];

interface ServiceHubTopNavProps {
  isTablet?: boolean;
}

function ServiceHubTopNavInner({ isTablet }: ServiceHubTopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-service-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  const isActive = (pill: NavPill) => {
    if (pill.isExternal) return false;
    const routeStr = String(pill.route);
    if (routeStr === '/service-hub') {
      return pathname === '/service-hub' || pathname === '/service-hub/';
    }
    if (pill.id === 'estimate-studio') return pathname.startsWith('/service-hub/estimate-studio');
    return pathname.startsWith(routeStr);
  };

  const isSubActive = (sub: SubItem) => {
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
        <Text style={styles.brandText}>Service Hub</Text>
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
      }} data-service-dropdown="true">
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
                          background: subActive ? 'rgba(251,191,36,0.12)' : 'transparent',
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
                        <Ionicons name={sub.icon} size={15} color={subActive ? '#fbbf24' : 'rgba(255,255,255,0.4)'} />
                        <span style={{
                          fontSize: 13,
                          fontWeight: subActive ? 600 : 400,
                          color: subActive ? '#fbbf24' : 'rgba(255,255,255,0.7)',
                          letterSpacing: '-0.1px',
                        }}>{sub.label}</span>
                        {subActive && (
                          <div style={{
                            marginLeft: 'auto',
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            background: '#fbbf24',
                            boxShadow: '0 0 6px rgba(251,191,36,0.5)',
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

export function ServiceHubTopNav(props: ServiceHubTopNavProps) {
  return (
    <PageErrorBoundary pageName="service-hub-top-nav">
      <ServiceHubTopNavInner {...props} />
    </PageErrorBoundary>
  );
}
