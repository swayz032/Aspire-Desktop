import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, type Href } from 'expo-router';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type Tab = {
  id: string;
  label: string;
  icon: IoniconsName;
  route: Href;
};

const tabs: Tab[] = [
  { id: 'visuals',       label: 'Visuals',         icon: 'image-outline',           route: '/service-hub/estimate-studio/visuals' as Href },
  { id: 'plans-photos',  label: 'Plans & Photos',  icon: 'document-attach-outline', route: '/service-hub/estimate-studio/plans-photos' as Href },
  { id: 'scope',         label: 'Scope',           icon: 'list-outline',            route: '/service-hub/estimate-studio/scope' as Href },
  { id: 'materials',     label: 'Materials',       icon: 'cube-outline',            route: '/service-hub/estimate-studio/materials' as Href },
  { id: 'takeoff',       label: 'Takeoff',         icon: 'grid-outline',            route: '/service-hub/estimate-studio/takeoff' as Href },
  { id: 'estimate',      label: 'Estimate',        icon: 'calculator-outline',      route: '/service-hub/estimate-studio/estimate' as Href },
];

export function EstimateStudioTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (tab: Tab) => {
    const routeStr = String(tab.route);
    return pathname === routeStr || pathname === routeStr + '/';
  };

  if (Platform.OS !== 'web') {
    // Native fallback — simple tab list.
    return (
      <View style={styles.containerNative}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Text
              key={tab.id}
              style={[styles.nativeTab, active && styles.nativeTabActive]}
              onPress={() => router.push(tab.route)}
            >
              {tab.label}
            </Text>
          );
        })}
      </View>
    );
  }

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 10,
        padding: 3,
        border: '1px solid rgba(255,255,255,0.06)',
        gap: 1,
        flexWrap: 'wrap' as const,
      }} data-estimate-studio-tabs="true">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.route)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 7,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active ? 600 : 500,
                color: active ? '#0A0A0F' : 'rgba(255,255,255,0.55)',
                background: active
                  ? 'linear-gradient(135deg, #ffffff 0%, #e8e8e8 100%)'
                  : 'transparent',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap' as const,
                letterSpacing: '-0.1px',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.25)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
            >
              <Ionicons name={tab.icon} size={13} color={active ? '#0A0A0F' : 'rgba(255,255,255,0.55)'} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles = StyleSheet.create({
  containerNative: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 4,
  },
  nativeTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  nativeTabActive: {
    color: '#0A0A0F',
    backgroundColor: '#ffffff',
    fontWeight: '600',
  },
});
