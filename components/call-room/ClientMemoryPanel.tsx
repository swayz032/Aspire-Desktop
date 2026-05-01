// components/call-room/ClientMemoryPanel.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClientContext } from './types';

export function ClientMemoryPanel({ client }: { client: ClientContext }): React.ReactElement {
  if (!client.name && !client.service) {
    return (
      <View style={styles.panel} testID="client-memory-empty">
        <SectionLabel>Client Memory</SectionLabel>
        <Text style={styles.empty}>New caller · No history yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.panel} testID="client-memory">
      <SectionLabel>Client Memory</SectionLabel>
      {client.name && <Text style={styles.name}>{client.name}</Text>}
      <Text style={styles.phone}>{formatPhone(client.phoneE164)}</Text>
      <View style={styles.divider} />
      {client.service && <Row label="Service" value={client.service} />}
      {client.urgency && <UrgencyRow level={client.urgency} />}
      {client.note && (
        <View style={styles.noteBlock}>
          <Text style={styles.rowLabel}>Note</Text>
          <Text style={styles.noteText}>{client.note}</Text>
        </View>
      )}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function UrgencyRow({ level }: { level: 'low' | 'medium' | 'high' }) {
  const borderColor =
    level === 'high' ? '#dc2626' : level === 'medium' ? '#eab308' : 'rgba(120,170,220,0.6)';
  const textColor =
    level === 'high' ? '#fca5a5' : level === 'medium' ? '#fde68a' : 'rgba(120,170,220,0.95)';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>Urgency</Text>
      <View style={[styles.pill, { borderColor }]}>
        <Text style={[styles.pillText, { color: textColor }]}>{level.toUpperCase()}</Text>
      </View>
    </View>
  );
}

function formatPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

const styles = StyleSheet.create({
  panel: {
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    // Stretch vertically so left + right panels equalize in height.
    // Body's alignItems: 'stretch' (default) makes the taller of the two
    // pull the shorter one up to match.
    alignSelf: 'stretch',
    width: '100%',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  name: { color: '#fff', fontSize: 18, fontWeight: '600' },
  phone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  rowLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 13 },
  rowValue: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  // Restrained urgency pill — thin border only, no filled background that would compete
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  noteBlock: { marginTop: 10 },
  noteText: { color: 'rgba(255,255,255,0.78)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  empty: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontStyle: 'italic' },
});
