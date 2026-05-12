import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fetchFrontDeskConfig } from '@/lib/api/frontDesk';
import { useAuthFetch } from '@/lib/authenticatedFetch';
import { useTenant } from '@/providers/TenantProvider';

type Persona = 'sarah' | 'tiffany';

const PERSONA_DISPLAY: Record<Persona, string> = {
  sarah: 'Sarah',
  tiffany: 'Tiffany',
};

export function FrontDeskHeaderStrip() {
  const router = useRouter();
  const { authenticatedFetch } = useAuthFetch();
  const { tenant } = useTenant();
  // Default persona = Tiffany (founder lock 2026-05-12). FrontDeskConfig
  // override still wins if the user picks a different persona in Setup.
  const [persona, setPersona] = useState<Persona>('tiffany');

  // Pass I P0 fix: thread the required {authenticatedFetch, officeId}. Guard
  // the effect so it only fires once tenant resolution lands — fetching
  // config with an undefined officeId would surface as a tenant-isolation
  // gap (Law #6) AND crash the runtime (Law #3 fail-closed).
  useEffect(() => {
    const officeId = tenant?.officeId;
    if (!officeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchFrontDeskConfig({ authenticatedFetch, officeId });
        const slug = (res?.config as any)?.receptionist_persona;
        if (!cancelled && (slug === 'sarah' || slug === 'tiffany')) {
          setPersona(slug);
        }
      } catch {
        // keep default tiffany
      }
    })();
    return () => { cancelled = true; };
  }, [authenticatedFetch, tenant?.officeId]);

  const name = PERSONA_DISPLAY[persona];

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.title}>Front Desk</Text>
        <Text style={styles.subtitle}>
          {`${name} is handling calls, voice messages, texts, and callback notes.`}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/session/calls/setup')}
        style={({ pressed, hovered }: any) => [
          styles.setupBtn,
          (pressed || hovered) && styles.setupBtnHover,
        ]}
      >
        <Ionicons name="settings-outline" size={16} color="#3B82F6" />
        <Text style={styles.setupBtnText}>Front Desk Setup</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
    ...(Platform.OS === 'web' ? ({ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' } as any) : null),
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any) : null),
  },
  setupBtnHover: {
    backgroundColor: '#242426',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  setupBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
});
