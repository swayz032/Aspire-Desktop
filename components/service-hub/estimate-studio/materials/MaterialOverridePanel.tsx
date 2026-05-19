/**
 * MaterialOverridePanel — Wave 5.1a-5.
 *
 * Slide-in side panel (modal sheet) that lets the contractor override one of
 * Drew's PROCURE picks. Two-column on wide screens (≥760px host width):
 *
 *   ┌──────────────────────────────────────┐
 *   │ Header: ← back · Override material   │
 *   ├──────────────────────────────────────┤
 *   │ Drew's suggestion (read-only)        │
 *   │   spec · qty · supplier $price       │
 *   ├──────────────────────────────────────┤
 *   │ Reason picker (4 reason chips)       │
 *   │ Label / qty / unit / supplier        │
 *   │ Search inline (reuses MaterialsTab   │
 *   │   search context — same hook)        │
 *   │ Notes (textarea)                     │
 *   ├──────────────────────────────────────┤
 *   │ [Cancel] [Confirm Override]          │
 *   └──────────────────────────────────────┘
 *
 * Aspire Law compliance:
 *   Law #4 — Confirm Override is the YELLOW UX gate. Hook + server enforce.
 *   Law #7 — render only. The override hook is owned by the parent.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  MaterialOverridePayload,
  MaterialOverrideReason,
  TakeoffMaterial,
} from '@/lib/api/blueprintsApi';
import type { UseMaterialOverrideResult } from '@/hooks/useMaterialOverride';

export interface MaterialOverridePanelProps {
  visible: boolean;
  material: TakeoffMaterial | null;
  controller: UseMaterialOverrideResult;
  onClose: () => void;
  /** Fired after a successful override — caller refreshes data. */
  onOverrideApplied?: (materialId: string) => void;
  testID?: string;
}

interface FormState {
  label: string;
  quantity: string;
  unit: string;
  supplier_name: string;
  price_usd: string;
  notes: string;
  reason: MaterialOverrideReason;
}

const REASON_CHIPS: Array<{ key: MaterialOverrideReason; label: string }> = [
  { key: 'spec_mismatch', label: 'Spec mismatch' },
  { key: 'vendor_pref', label: 'Preferred vendor' },
  { key: 'price', label: 'Price' },
  { key: 'availability', label: 'Availability' },
  { key: 'other', label: 'Other' },
];

function buildInitialForm(m: TakeoffMaterial | null): FormState {
  return {
    label: m?.line_item ?? '',
    quantity: m?.quantity != null ? String(m.quantity) : '',
    unit: m?.unit ?? '',
    supplier_name: m?.supplier_name ?? '',
    price_usd: '',
    notes: '',
    reason: 'spec_mismatch',
  };
}

export function MaterialOverridePanel({
  visible,
  material,
  controller,
  onClose,
  onOverrideApplied,
  testID,
}: MaterialOverridePanelProps): React.ReactElement | null {
  const [form, setForm] = useState<FormState>(() => buildInitialForm(material));

  // Re-seed form whenever a different material lands.
  useEffect(() => {
    if (visible && material) {
      setForm(buildInitialForm(material));
      controller.reset(material.material_id);
    }
    // We intentionally exclude `controller` from the dep array — it's stable
    // by useMemo in the hook and including it would re-seed every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, material?.material_id]);

  const status = material ? controller.statusById[material.material_id] ?? 'idle' : 'idle';
  const error = material ? controller.errorById[material.material_id] ?? null : null;
  const isPending = status === 'pending';

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const diff = useMemo<MaterialOverridePayload>(() => {
    if (!material) return {};
    const out: MaterialOverridePayload = {};
    if (form.label.trim() && form.label.trim() !== material.line_item) {
      out.label = form.label.trim();
    }
    const qty = Number(form.quantity);
    if (form.quantity.trim() && !Number.isNaN(qty) && qty !== material.quantity) {
      out.quantity = qty;
    }
    if (form.unit.trim() && form.unit.trim() !== material.unit) {
      out.unit = form.unit.trim();
    }
    if (
      form.supplier_name.trim() &&
      form.supplier_name.trim() !== (material.supplier_name ?? '')
    ) {
      out.supplier_name = form.supplier_name.trim();
    }
    const price = Number(form.price_usd);
    if (form.price_usd.trim() && !Number.isNaN(price) && price >= 0) {
      out.price_usd = price;
    }
    if (form.notes.trim()) {
      out.notes = form.notes.trim();
    }
    return out;
  }, [form, material]);

  const hasChanges = Object.keys(diff).length > 0;

  const handleSubmit = useCallback(async () => {
    if (!material || !hasChanges || isPending) return;
    const ok = await controller.override(material.material_id, diff, form.reason);
    if (ok) {
      onOverrideApplied?.(material.material_id);
      onClose();
    }
  }, [controller, diff, form.reason, hasChanges, isPending, material, onClose, onOverrideApplied]);

  const handleRevert = useCallback(() => {
    if (!material) return;
    setForm(buildInitialForm(material));
  }, [material]);

  if (!material) return null;

  // ──────────────────────────────────────────────────────────────────────
  // Body — reused for both Modal (narrow) and inline-slide (wide).
  // For simplicity & RN Web compatibility, we always use Modal with a right-
  // anchored full-height panel; on narrow screens it covers the canvas.
  // ──────────────────────────────────────────────────────────────────────
  const body = (
    <View style={styles.panel} testID={testID ?? 'material-override-panel'}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close override panel"
          style={({ hovered, pressed }: any) => [
            styles.backBtn,
            hovered && styles.backBtnHover,
            pressed && styles.backBtnPressed,
          ]}
          testID="material-override-close"
        >
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle}>Override material</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {material.line_item}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Drew suggestion read-only block */}
        <View style={styles.suggestionCard} testID="material-override-original">
          <View style={styles.suggestionHeader}>
            <Ionicons name="bulb-outline" size={11} color="#fbbf24" />
            <Text style={styles.suggestionLabel}>DREW&apos;S PICK</Text>
          </View>
          <Text style={styles.suggestionSpec} numberOfLines={2}>
            {material.line_item}
          </Text>
          <Text style={styles.suggestionMeta}>
            {material.quantity.toLocaleString()} {material.unit}
            {material.supplier_name ? ` · ${material.supplier_name}` : ''}
          </Text>
        </View>

        {/* Reason chips */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>REASON FOR OVERRIDE</Text>
          <View style={styles.reasonRow}>
            {REASON_CHIPS.map((r) => {
              const active = form.reason === r.key;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => updateField('reason', r.key)}
                  disabled={isPending}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  testID={`material-override-reason-${r.key}`}
                  style={({ hovered, pressed }: any) => [
                    styles.reasonChip,
                    active && styles.reasonChipActive,
                    hovered && !active && styles.reasonChipHover,
                    pressed && styles.reasonChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonChipText,
                      active && styles.reasonChipTextActive,
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Spec fields */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>SPEC</Text>
          <TextInput
            value={form.label}
            onChangeText={(t) => updateField('label', t)}
            editable={!isPending}
            placeholder={material.line_item}
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={styles.input}
            testID="material-override-label"
            accessibilityLabel="Material spec"
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.fieldGroup, styles.fieldHalf]}>
            <Text style={styles.fieldLabel}>QUANTITY</Text>
            <TextInput
              value={form.quantity}
              onChangeText={(t) => updateField('quantity', t.replace(/[^0-9.]/g, ''))}
              editable={!isPending}
              placeholder={String(material.quantity)}
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              keyboardType="decimal-pad"
              testID="material-override-quantity"
              accessibilityLabel="Quantity"
            />
          </View>
          <View style={[styles.fieldGroup, styles.fieldHalf]}>
            <Text style={styles.fieldLabel}>UNIT</Text>
            <TextInput
              value={form.unit}
              onChangeText={(t) => updateField('unit', t)}
              editable={!isPending}
              placeholder={material.unit}
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              testID="material-override-unit"
              accessibilityLabel="Unit"
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={[styles.fieldGroup, styles.fieldHalf]}>
            <Text style={styles.fieldLabel}>SUPPLIER</Text>
            <TextInput
              value={form.supplier_name}
              onChangeText={(t) => updateField('supplier_name', t)}
              editable={!isPending}
              placeholder={material.supplier_name ?? 'Vendor name'}
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              testID="material-override-supplier"
              accessibilityLabel="Supplier name"
            />
          </View>
          <View style={[styles.fieldGroup, styles.fieldHalf]}>
            <Text style={styles.fieldLabel}>UNIT PRICE (USD)</Text>
            <TextInput
              value={form.price_usd}
              onChangeText={(t) => updateField('price_usd', t.replace(/[^0-9.]/g, ''))}
              editable={!isPending}
              placeholder="0.00"
              placeholderTextColor="rgba(255,255,255,0.32)"
              style={styles.input}
              keyboardType="decimal-pad"
              testID="material-override-price"
              accessibilityLabel="Unit price USD"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>NOTES</Text>
          <TextInput
            value={form.notes}
            onChangeText={(t) => updateField('notes', t)}
            editable={!isPending}
            placeholder="Why are you overriding Drew's pick?"
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={[styles.input, styles.inputMultiline]}
            multiline
            numberOfLines={3}
            testID="material-override-notes"
            accessibilityLabel="Override notes"
          />
        </View>

        {error ? (
          <View style={styles.errorBanner} testID="material-override-error">
            <Ionicons name="alert-circle" size={13} color="#ef4444" />
            <Text style={styles.errorText} numberOfLines={3}>
              {error.message}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleRevert}
          disabled={isPending || !hasChanges}
          accessibilityRole="button"
          accessibilityLabel="Restore Drew's pick"
          style={({ hovered, pressed }: any) => [
            styles.footerBtn,
            styles.revertBtn,
            !hasChanges && styles.footerBtnDisabled,
            hovered && hasChanges && styles.revertBtnHover,
            pressed && styles.footerBtnPressed,
          ]}
          testID="material-override-revert"
        >
          <Ionicons name="arrow-undo-outline" size={12} color="rgba(255,255,255,0.78)" />
          <Text style={styles.revertBtnText}>Restore Drew&apos;s pick</Text>
        </Pressable>
        <View style={styles.footerSpacer} />
        <Pressable
          onPress={onClose}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="Cancel override"
          style={({ hovered, pressed }: any) => [
            styles.footerBtn,
            styles.cancelBtn,
            hovered && styles.cancelBtnHover,
            pressed && styles.footerBtnPressed,
          ]}
          testID="material-override-cancel"
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={!hasChanges || isPending}
          accessibilityRole="button"
          accessibilityLabel="Confirm override"
          style={({ hovered, pressed }: any) => [
            styles.footerBtn,
            styles.confirmBtn,
            (!hasChanges || isPending) && styles.footerBtnDisabled,
            hovered && hasChanges && !isPending && styles.confirmBtnHover,
            pressed && styles.footerBtnPressed,
          ]}
          testID="material-override-confirm"
        >
          <Ionicons name="checkmark" size={13} color="#0b1220" />
          <Text style={styles.confirmBtnText}>
            {isPending ? 'Saving…' : 'Confirm override'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropDismiss}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss override panel"
          testID="material-override-backdrop"
        />
        {body}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdropDismiss: { flex: 1 },
  panel: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#0b1220',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    flex: Platform.OS === 'web' ? undefined : 1,
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '-12px 0 32px rgba(0,0,0,0.45)' } as any)
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  backBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  backBtnPressed: { opacity: 0.78 },
  headerBody: { flex: 1, gap: 2 },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 14 },
  suggestionCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.22)',
    gap: 5,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 1.2,
  },
  suggestionSpec: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  suggestionMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: -0.05,
  },
  fieldGroup: { gap: 5 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    letterSpacing: -0.1,
    ...(Platform.OS === 'web'
      ? ({ outlineColor: 'rgba(251,191,36,0.45)', outlineWidth: 1, outlineStyle: 'solid' } as any)
      : {}),
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  reasonChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  reasonChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  reasonChipHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  reasonChipPressed: { opacity: 0.78 },
  reasonChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: -0.05,
  },
  reasonChipTextActive: {
    color: '#fbbf24',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    color: '#fca5a5',
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    flexWrap: 'wrap',
  },
  footerSpacer: { flex: 1 },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
  },
  footerBtnDisabled: { opacity: 0.45 },
  footerBtnPressed: { opacity: 0.78 },
  revertBtn: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  revertBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  revertBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: -0.05,
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },
  confirmBtn: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  confirmBtnHover: {
    opacity: 0.92,
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1220',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
