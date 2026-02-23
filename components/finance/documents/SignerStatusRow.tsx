/**
 * SignerStatusRow -- Row component showing a signer's name, masked email, and signing status.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';

type SignerStatus = 'pending' | 'viewed' | 'signed' | 'declined';

const STATUS_META: Record<SignerStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: 'time-outline', color: Colors.text.muted, label: 'Pending' },
  viewed: { icon: 'eye-outline', color: '#f59e0b', label: 'Viewed' },
  signed: { icon: 'checkmark-circle', color: '#34c759', label: 'Signed' },
  declined: { icon: 'close-circle', color: '#ff3b30', label: 'Declined' },
};

export interface SignerData {
  name: string;
  email: string;
  status: SignerStatus;
  signed_at?: string;
}

interface SignerStatusRowProps {
  signer: SignerData;
}

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx <= 1) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 2))}${domain}`;
}

function SignerStatusRowInner({ signer }: SignerStatusRowProps) {
  const meta = STATUS_META[signer.status] ?? STATUS_META.pending;

  return (
    <View
      style={[
        styles.row,
        Platform.OS === 'web' ? { transition: 'background-color 0.15s ease' } as any : {},
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Signer ${signer.name}, ${meta.label}`}
    >
      <View style={styles.left}>
        <View style={[styles.avatar, { borderColor: meta.color + '40' }]}>
          <Text style={styles.avatarText}>
            {signer.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.name} numberOfLines={1}>{signer.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{maskEmail(signer.email)}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Ionicons name={meta.icon as any} size={16} color={meta.color} />
        <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

export const SignerStatusRow = React.memo(SignerStatusRowInner);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  email: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
