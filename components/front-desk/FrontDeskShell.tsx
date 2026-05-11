import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useSafeAreaInsetsCompat } from '@/lib/safeArea';
// ScrollView no longer used — body is a flex View so cards size to viewport.

type NavPill = {
  id: string;
  label: string;
  route: Href;
};

// Mirrors components/desktop/DesktopSidebar.tsx navItems exactly — same labels,
// same order, same routes. The Front Desk Hub top pill is the Aspire main nav.
const NAV_PILLS: NavPill[] = [
  { id: 'home', label: 'Home', route: '/(tabs)' },
  { id: 'inbox', label: 'Inbox', route: '/(tabs)/inbox' },
  { id: 'front-desk', label: 'Front Desk', route: '/session/front-desk' },
  { id: 'office-memory', label: 'Office Memory', route: '/office-memory' },
  { id: 'office-store', label: 'Office Store', route: '/office-store' },
  { id: 'team', label: 'Team Workspace', route: '/team-workspace' },
];

type Props = { children?: React.ReactNode };

function FrontDeskShellInner({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsetsCompat();

  const isActive = (pill: NavPill) =>
    pill.id === 'front-desk' ? pathname.startsWith('/session/front-desk') : false;

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
          }}
        >
          {NAV_PILLS.map((pill) => {
            const active = isActive(pill);
            return (
              <button
                key={pill.id}
                onClick={() => router.push(pill.route)}
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
              </button>
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
