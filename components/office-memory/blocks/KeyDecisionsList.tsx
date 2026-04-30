/**
 * KeyDecisionsList — Pass-15 reusable variant of MemoryKeyDecisionsCard with
 * support for revealing supporting transcript excerpts.
 *
 * Behavior:
 *   - Each decision row: green check + label.
 *   - If `transcriptExcerpt` is provided, the row is pressable and reveals
 *     a quoted excerpt panel underneath ("As said in the conversation:")
 *     so the decision is traceable to its source.
 *   - Excerpts use a left accent bar (Aspire-blue) + italic body text — reads
 *     as "magazine pull quote", per §12.1 editorial direction.
 */

import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';

export interface KeyDecisionEntry {
  label: string;
  /** Optional source quote — when present, row becomes expandable. */
  transcriptExcerpt?: string;
}

export interface KeyDecisionsListProps {
  decisions: KeyDecisionEntry[];
  /** Eyebrow override (default: "Key Decisions"). */
  eyebrow?: string;
}

export function KeyDecisionsList({
  decisions,
  eyebrow = 'Key Decisions',
}: KeyDecisionsListProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      {decisions.length === 0 ? (
        <Text style={styles.empty}>No key decisions captured yet.</Text>
      ) : (
        <View style={styles.list}>
          {decisions.map((decision, idx) => (
            <DecisionRow key={`${decision.label}-${idx}`} decision={decision} />
          ))}
        </View>
      )}
    </View>
  );
}

function DecisionRow({ decision }: { decision: KeyDecisionEntry }) {
  const [open, setOpen] = useState(false);
  const expandable = !!decision.transcriptExcerpt;

  const RowContainer: React.ComponentType<{ children: React.ReactNode }> = expandable
    ? ({ children }) => (
        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={decision.label}
          accessibilityState={{ expanded: open }}
          style={({ hovered }: { hovered?: boolean }) => [
            styles.row,
            hovered && styles.rowHover,
          ]}
        >
          {children}
        </Pressable>
      )
    : ({ children }) => <View style={styles.row}>{children}</View>;

  return (
    <View>
      <RowContainer>
        <View style={styles.checkWrap}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.semantic.success as string} />
        </View>
        <Text style={styles.label}>{decision.label}</Text>
        {expandable && (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.text.tertiary as string}
          />
        )}
      </RowContainer>

      {open && decision.transcriptExcerpt && (
        <View style={styles.excerptWrap}>
          <View style={styles.excerptBar} />
          <View style={styles.excerptBody}>
            <Text style={styles.excerptLabel}>From the conversation</Text>
            <Text style={styles.excerptText}>"{decision.transcriptExcerpt}"</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.memory.cardBg as string,
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
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'background-color 140ms ease-out',
        } as unknown as ViewStyle)
      : {}),
  },
  rowHover: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  checkWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary as string,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
  },
  excerptWrap: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 32,
    marginTop: 4,
    marginBottom: 6,
  },
  excerptBar: {
    width: 2,
    backgroundColor: Colors.accent.cyan as string,
    borderRadius: 1,
    marginVertical: 4,
  },
  excerptBody: {
    flex: 1,
    paddingVertical: 6,
    gap: 4,
  },
  excerptLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted as string,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  excerptText: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 21,
  },
});

export default KeyDecisionsList;
