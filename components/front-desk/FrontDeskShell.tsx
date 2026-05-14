import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSafeAreaInsetsCompat } from '@/lib/safeArea';
// ScrollView no longer used — body is a flex View so cards size to viewport.

type SubItem = {
  id: string;
  label: string;
  route: Href;
};

type NavPill = {
  id: string;
  label: string;
  route: Href;
  subItems?: SubItem[];
};

// Mirrors components/desktop/DesktopSidebar.tsx navItems exactly — same labels,
// same order, same routes. The Front Desk Hub top pill is the Aspire main nav.
const NAV_PILLS: NavPill[] = [
  { id: 'home', label: 'Home', route: '/(tabs)' },
  { id: 'inbox', label: 'Inbox', route: '/(tabs)/inbox' },
  { 
    id: 'front-desk', 
    label: 'Front Desk', 
    route: '/session/front-desk',
    subItems: [
      { id: 'setup', label: 'Front Desk Setup', route: '/session/calls/setup' as any },
      { id: 'estimate-studio', label: 'Estimate Studio', route: '/service-hub/estimate-studio' as any },
    ]
  },
  { id: 'office-memory', label: 'Office Memory', route: '/office-memory' },
  { id: 'office-store', label: 'Office Store', route: '/office-store' },
  { id: 'team', label: 'Team Workspace', route: '/team-workspace' },
];

type Props = { children?: React.ReactNode };

function FrontDeskShellInner({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsetsCompat();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-front-desk-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  const isActive = (pill: NavPill) =>
    pill.id === 'front-desk' ? pathname.startsWith('/session/front-desk') : pathname.startsWith(String(pill.route));

  const isSubActive = (sub: SubItem) => pathname.startsWith(String(sub.route));

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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.nativeBrand}>
          <Text style={styles.nativeBrandText}>Front Desk</Text>
        </View>
        <View style={styles.body}>{children}</View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <div
        style={{
          width: '100%',
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          backgroundColor: 'transparent',
          position: 'relative',
          zIndex: 100,
          flexShrink: 0,
        }}
        data-front-desk-dropdown="true"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1C1C1E',
            borderRadius: 26,
            padding: '3px 4px',
            border: '1px solid rgba(255,255,255,0.04)',
            gap: 1,
            position: 'relative',
          }}
        >
          {NAV_PILLS.map((pill) => {
            const active = isActive(pill);
            const hasDropdown = pill.subItems && pill.subItems.length > 0;
            const isDropdownOpen = openDropdown === pill.id;

            return (
              <div key={pill.id} style={{ position: 'relative' }}>
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
                    color: active ? '#0a0a0a' : 'rgba(255,255,255,0.5)',
                    background: active
                      ? 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)'
                      : 'transparent',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap',
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
                      <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={active ? '#0a0a0a' : 'currentColor'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
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
                          <Ionicons name="settings-outline" size={15} color={subActive ? '#3b82f6' : 'rgba(255,255,255,0.4)'} />
                          <span style={{
                            fontSize: 13,
                            fontWeight: subActive ? 600 : 400,
                            color: subActive ? '#3b82f6' : 'rgba(255,255,255,0.7)',
                            letterSpacing: '-0.1px',
                          }}>{sub.label}</span>
                          {subActive && (
                            <div style={{
                              marginLeft: 'auto',
                              width: 4,
                              height: 4,
                              borderRadius: 2,
                              background: '#3b82f6',
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

      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    // Founder lock 2026-05-13: vertically center the hub inside the body
    // so the maxHeight cap (780/700) doesn't leave a big gap at the bottom
    // on tall monitors. Distributes leftover space above + below instead.
    justifyContent: 'center',
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 32,
  },
  nativeBrand: {
    height: 52,
    paddingHorizontal: 24,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  nativeBrandText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export function FrontDeskShell(props: Props) {
  return (
    <PageErrorBoundary pageName="front-desk-shell">
      <FrontDeskShellInner {...props} />
    </PageErrorBoundary>
  );
}
