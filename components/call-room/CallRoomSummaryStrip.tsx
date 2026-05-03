// components/call-room/CallRoomSummaryStrip.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClientContext } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function CallRoomSummaryStrip({ client }: { client: ClientContext }): React.ReactElement | null {
  if (!client.service && !client.urgency && !client.note) return null;

  const need = client.note ?? client.service ?? '—';
  const urgency = describeUrgency(client.urgency);
  const nextStep = 'Schedule inspection · Friday after 2 PM.';

  return (
    <View style={styles.strip} testID="call-room-summary">
      <Cell icon="document-text-outline" label="Need" value={need} />
      <Divider />
      <Cell icon="alert-circle-outline" label="Urgency" value={urgency} />
      <Divider />
      <Cell icon="checkmark-circle-outline" label="Next Step" value={nextStep} />
    </View>
  );
}

function Cell({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Ionicons name={icon} size={14} color="rgba(255,255,255,0.6)" style={styles.icon} />
      <View style={styles.cellText}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function describeUrgency(level: 'low' | 'medium' | 'high' | null): string {
  if (level === 'high') return 'High, after recent storm.';
  if (level === 'medium') return 'Medium.';
  if (level === 'low') return 'Low.';
  return '—';
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: 10,
    gap: 16,
    // Constrain so the strip doesn't span the full 1200px card. Centered
    // beneath the controls pill at a comfortable enterprise reading width.
    alignSelf: 'center',
    width: '100%',
    maxWidth: 760,
  },
  cell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  icon: { marginRight: 10, marginTop: 2 },
  cellText: { flex: 1 },
  label: { color: 'rgba(255,255,255,0.55)', fontSize: 11, letterSpacing: 0.6, marginBottom: 3, textTransform: 'uppercase', fontWeight: '600' },
  value: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', alignSelf: 'stretch' },
});
