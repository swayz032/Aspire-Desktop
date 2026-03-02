import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';

interface AgentWidgetProps {
  agentId: string;
  suiteId: string;
  officeId: string;
}

const AGENT_META: Record<string, { name: string; role: string; accent: string; avatar: any }> = {
  ava: {
    name: 'Ava',
    role: 'Executive AI Assistant',
    accent: '#3B82F6',
    avatar: require('@/assets/avatars/ava.png'),
  },
  eli: {
    name: 'Eli',
    role: 'Communications & Inbox',
    accent: '#F59E0B',
    avatar: require('@/assets/avatars/eli.png'),
  },
  finn: {
    name: 'Finn',
    role: 'Finance & Accounting',
    accent: '#8B5CF6',
    avatar: require('@/assets/avatars/finn.png'),
  },
};

export function AgentWidget({ agentId }: AgentWidgetProps) {
  const meta = AGENT_META[agentId] || AGENT_META.ava;

  return (
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        <View style={[styles.avatarRing, { borderColor: meta.accent }]}>
          <Image source={meta.avatar} style={styles.avatar} resizeMode="cover" />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{meta.name}</Text>
          <Text style={styles.role}>{meta.role}</Text>
        </View>
      </View>
      <View style={[styles.statusBar, { backgroundColor: `${meta.accent}22` }]}>
        <View style={[styles.statusDot, { backgroundColor: meta.accent }]} />
        <Text style={[styles.statusText, { color: meta.accent }]}>Ready</Text>
      </View>
      <Text style={styles.hint}>Tap the dock icon to start a voice session</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2,
    padding: 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 13,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  role: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.1,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 6px currentColor',
    } as any),
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
