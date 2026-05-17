/**
 * SymbolActionModal — Wave 8.
 *
 * Compact action modal shown when the user clicks a symbol bbox in the
 * SheetViewer. Three actions:
 *   - Confirm (status → 'confirmed')
 *   - Reclassify (status → 'reclassified', surfaces a class picker)
 *   - Drop (status → 'dropped' — overlay hides it)
 *
 * Wave 8 reality: the actual mutation endpoint (PATCH symbol status) is
 * deferred to Wave 9; this modal currently delegates to a callback the
 * parent uses to update local symbol state optimistically. A "Wave 9 will
 * persist" hint is shown.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TakeoffSymbol } from '@/lib/api/blueprintsApi';
import { prettyClassName, styleForSymbolClass } from './symbolClasses';

interface Props {
  visible: boolean;
  symbol: TakeoffSymbol | null;
  onClose: () => void;
  onAction: (
    symbol: TakeoffSymbol,
    action: 'confirm' | 'reclassify' | 'drop',
    newClass?: string,
  ) => void;
}

export function SymbolActionModal({
  visible,
  symbol,
  onClose,
  onAction,
}: Props): React.ReactElement | null {
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [newClass, setNewClass] = useState('');

  if (!symbol) return null;

  const style = styleForSymbolClass(symbol.override_class ?? symbol.class);
  const confPct = Math.round(symbol.confidence * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="symbol-action-modal"
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={[styles.codeBadge, { backgroundColor: style.fg }]}>
              <Text style={styles.codeText}>{style.code}</Text>
            </View>
            <View style={styles.headerBody}>
              <Text style={styles.className}>
                {prettyClassName(symbol.override_class ?? symbol.class)}
              </Text>
              <Text style={styles.classKey}>{symbol.override_class ?? symbol.class}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID="symbol-action-close"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.65)" />
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Confidence</Text>
              <Text style={[styles.statValue, { color: style.fg }]}>{confPct}%</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={styles.statValue}>{symbol.status ?? 'detected'}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Discipline</Text>
              <Text style={styles.statValue}>{style.label}</Text>
            </View>
          </View>

          {reclassifyOpen ? (
            <View style={styles.reclassifyPanel}>
              <Text style={styles.reclassifyLabel}>Reclassify as:</Text>
              <View style={styles.reclassifyOptions}>
                {SUGGESTED_RECLASSES.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setNewClass(opt)}
                    accessibilityRole="button"
                    accessibilityLabel={`Reclassify to ${opt}`}
                    testID={`symbol-reclass-${opt}`}
                    style={({ hovered }: any) => [
                      styles.reclassChip,
                      newClass === opt && styles.reclassChipActive,
                      hovered && newClass !== opt && styles.reclassChipHover,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reclassText,
                        newClass === opt && styles.reclassTextActive,
                      ]}
                    >
                      {prettyClassName(opt)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => {
                    setReclassifyOpen(false);
                    setNewClass('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reclassify"
                  style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (newClass) {
                      onAction(symbol, 'reclassify', newClass);
                      setReclassifyOpen(false);
                      setNewClass('');
                    }
                  }}
                  disabled={!newClass}
                  accessibilityRole="button"
                  accessibilityLabel="Apply reclassify"
                  testID="symbol-action-reclassify-apply"
                  style={({ hovered }: any) => [
                    styles.primaryBtn,
                    !newClass && styles.primaryBtnDisabled,
                    hovered && newClass && styles.primaryBtnHover,
                  ]}
                >
                  <Text style={[styles.primaryText, !newClass && styles.primaryTextDisabled]}>
                    Apply
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => onAction(symbol, 'drop')}
                accessibilityRole="button"
                accessibilityLabel="Drop this symbol"
                testID="symbol-action-drop"
                style={({ hovered }: any) => [
                  styles.dropBtn,
                  hovered && styles.dropBtnHover,
                ]}
              >
                <Ionicons name="trash-outline" size={12} color="#f87171" />
                <Text style={styles.dropText}>Drop</Text>
              </Pressable>
              <Pressable
                onPress={() => setReclassifyOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Reclassify this symbol"
                testID="symbol-action-reclassify"
                style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}
              >
                <Ionicons name="swap-horizontal-outline" size={12} color="rgba(255,255,255,0.85)" />
                <Text style={styles.secondaryText}>Reclassify</Text>
              </Pressable>
              <Pressable
                onPress={() => onAction(symbol, 'confirm')}
                accessibilityRole="button"
                accessibilityLabel="Confirm this symbol"
                testID="symbol-action-confirm"
                style={({ hovered }: any) => [
                  styles.primaryBtn,
                  hovered && styles.primaryBtnHover,
                ]}
              >
                <Ionicons name="checkmark" size={12} color="#0b0b0b" />
                <Text style={styles.primaryText}>Confirm</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.hint}>Persistence ships in Wave 9 · changes apply locally now.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const SUGGESTED_RECLASSES = [
  'electrical.outlet.duplex',
  'electrical.outlet.gfci',
  'electrical.switch.single-pole',
  'plumbing.fixture.toilet',
  'plumbing.fixture.lavatory',
  'architectural.door.swing',
  'architectural.window.fixed',
];

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 480,
    padding: 18,
    gap: 14,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  codeBadge: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: 0.4,
  },
  headerBody: {
    flex: 1,
    gap: 2,
  },
  className: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.15,
  },
  classKey: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
  },
  reclassifyPanel: {
    gap: 10,
  },
  reclassifyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
  },
  reclassifyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reclassChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  reclassChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.45)',
  },
  reclassChipHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reclassText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  reclassTextActive: {
    color: '#fbbf24',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.40)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  dropBtnHover: {
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  dropText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#f87171',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  secondaryBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  primaryBtnHover: {
    backgroundColor: '#fcd34d',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b0b0b',
  },
  primaryTextDisabled: {
    color: 'rgba(11,11,11,0.55)',
  },
  hint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
