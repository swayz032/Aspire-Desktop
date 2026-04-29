/**
 * MemoryKeyDecisionsCard — checklist of key decisions made in the memory.
 *
 * Read-only V1 (toggle reserved for V2 once an authority/audit-trail
 * persistence layer is in place per plan §3.4).
 *
 * Visual:
 *   ┌──────────────────────────────────┐
 *   │ Key Decisions                     │
 *   │                                   │
 *   │ ✓ Approve revised layout          │   ← green check + body 15/500
 *   │ ✓ Increase budget cap to $1.2M    │
 *   │ ✓ Update finish package options   │
 *   │ ✓ Target start date: May 12       │
 *   └──────────────────────────────────┘
 *
 * Each row is gap-12 vertically — comfortable for scanning, never cramped.
 * The check icon uses `Colors.semantic.success` (not custom green) so it
 * inherits future theme adjustments cleanly.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { KeyDecision } from './types';

export interface MemoryKeyDecisionsCardProps {
  items: KeyDecision[];
  eyebrow?: string;
}

export function MemoryKeyDecisionsCard({
  items,
  eyebrow = 'Key Decisions',
}: MemoryKeyDecisionsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>No key decisions captured yet.</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.checkWrap}>
                <Ionicons
                  name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={item.checked ? Colors.semantic.success : Colors.text.muted}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  !item.checked && styles.labelUnchecked,
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    lineHeight: 22,
    flex: 1,
    minWidth: 0,
    letterSpacing: -0.1,
  },
  labelUnchecked: {
    color: Colors.text.secondary,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
});

export default MemoryKeyDecisionsCard;
