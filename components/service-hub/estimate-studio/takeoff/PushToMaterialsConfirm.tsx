/**
 * PushToMaterialsConfirm — Wave 8.
 *
 * YELLOW tier confirmation modal for push-to-materials. Shows the count
 * + first N line items, then asks the user to confirm. Server-side scope
 * enforcement is the real gate (Law #5); this modal is the UX gate (Law #4).
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TakeoffMaterial } from '@/lib/api/blueprintsApi';
import type { UsePushToMaterialsResult } from '@/hooks/usePushToMaterials';

interface Props {
  push: UsePushToMaterialsResult;
  /** Full materials list so we can resolve labels for `pendingMaterialIds`. */
  materials: TakeoffMaterial[];
}

export function PushToMaterialsConfirm({ push, materials }: Props): React.ReactElement | null {
  const open =
    push.phase === 'confirming' ||
    push.phase === 'pushing' ||
    push.phase === 'success' ||
    push.phase === 'error';

  if (!open) return null;

  const pending = push.pendingMaterialIds;
  const materialMap = new Map(materials.map((m) => [m.material_id, m]));
  const items = pending
    .map((id) => materialMap.get(id))
    .filter((m): m is TakeoffMaterial => m != null);

  const visibleItems = items.slice(0, 6);
  const overflow = items.length - visibleItems.length;

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={push.cancel}
      testID="push-to-materials-confirm"
    >
      <Pressable
        style={styles.scrim}
        onPress={push.phase === 'pushing' ? undefined : push.cancel}
      >
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.header}>
            <View style={styles.yellowBadge}>
              <Ionicons name="warning" size={13} color="#0b0b0b" />
              <Text style={styles.yellowBadgeText}>YELLOW</Text>
            </View>
            <Text style={styles.title}>Push to materials bundle</Text>
          </View>

          {push.phase === 'success' ? (
            <View style={styles.successBody}>
              <Ionicons name="checkmark-circle" size={36} color="#34d399" />
              <Text style={styles.successTitle}>
                {push.result?.added_count ?? 0} item{push.result?.added_count === 1 ? '' : 's'} added
              </Text>
              {push.result && push.result.rejected.length > 0 ? (
                <Text style={styles.successDetail}>
                  {push.result.rejected.length} rejected — see Materials bundle.
                </Text>
              ) : null}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={push.reset}
                  accessibilityRole="button"
                  accessibilityLabel="Close confirmation"
                  testID="push-confirm-done"
                  style={({ hovered }: any) => [styles.primaryBtn, hovered && styles.primaryBtnHover]}
                >
                  <Text style={styles.primaryText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : push.phase === 'error' ? (
            <View style={styles.errorBody}>
              <Ionicons name="alert-circle" size={32} color="#f87171" />
              <Text style={styles.errorTitle}>Push failed</Text>
              <Text style={styles.errorDetail}>{push.error?.message ?? 'Unknown error'}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={push.reset}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  testID="push-confirm-dismiss"
                  style={({ hovered }: any) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}
                >
                  <Text style={styles.secondaryText}>Dismiss</Text>
                </Pressable>
                <Pressable
                  onPress={push.commit}
                  accessibilityRole="button"
                  accessibilityLabel="Retry"
                  testID="push-confirm-retry"
                  style={({ hovered }: any) => [styles.primaryBtn, hovered && styles.primaryBtnHover]}
                >
                  <Text style={styles.primaryText}>Retry</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.lead}>
                You're about to add{' '}
                <Text style={styles.leadStrong}>
                  {items.length} item{items.length === 1 ? '' : 's'}
                </Text>{' '}
                to this project's materials bundle. This action is YELLOW tier — it
                modifies project state. Continue?
              </Text>

              <ScrollView style={styles.itemList} testID="push-confirm-items">
                {visibleItems.map((m) => (
                  <View key={m.material_id} style={styles.item}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {m.line_item}
                    </Text>
                    <Text style={styles.itemQty}>
                      {m.quantity.toLocaleString()} {m.unit}
                    </Text>
                  </View>
                ))}
                {overflow > 0 ? (
                  <Text style={styles.overflow}>+ {overflow} more</Text>
                ) : null}
              </ScrollView>

              <View style={styles.actionRow}>
                <Pressable
                  onPress={push.cancel}
                  disabled={push.phase === 'pushing'}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel push"
                  testID="push-confirm-cancel"
                  style={({ hovered }: any) => [
                    styles.secondaryBtn,
                    hovered && push.phase !== 'pushing' && styles.secondaryBtnHover,
                    push.phase === 'pushing' && styles.btnDisabled,
                  ]}
                >
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={push.commit}
                  disabled={push.phase === 'pushing'}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm push to materials"
                  testID="push-confirm-commit"
                  style={({ hovered }: any) => [
                    styles.primaryBtn,
                    hovered && push.phase !== 'pushing' && styles.primaryBtnHover,
                    push.phase === 'pushing' && styles.btnDisabled,
                  ]}
                >
                  {push.phase === 'pushing' ? (
                    <ActivityIndicator size="small" color="#0b0b0b" />
                  ) : (
                    <Ionicons name="arrow-forward" size={12} color="#0b0b0b" />
                  )}
                  <Text style={styles.primaryText}>
                    {push.phase === 'pushing' ? 'Pushing…' : 'Add to bundle'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
    maxWidth: 520,
    padding: 18,
    gap: 14,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  yellowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
  yellowBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.15,
  },
  lead: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
  },
  leadStrong: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  itemList: {
    maxHeight: 200,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  itemQty: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
  },
  overflow: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.50)',
    fontStyle: 'italic',
    paddingVertical: 4,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  primaryBtnHover: {
    backgroundColor: '#fcd34d',
  },
  primaryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: -0.05,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  successBody: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34d399',
  },
  successDetail: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  errorBody: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f87171',
  },
  errorDetail: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 16,
  },
});
