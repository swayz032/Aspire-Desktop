/**
 * QuantityTableEditable â€” Wave 13.
 *
 * Spreadsheet-style verification table for contractors. Each material row's
 * Quantity cell is inline-editable; saving an edit promotes truth from
 * `derived` / `assumed` â†’ `field_confirmed`.
 *
 * Aspire Law #7: pure UI. Real backend writes happen via the orchestrator
 * Yellow-tier flow (Wave 14). For Wave 13 we:
 *   - keep optimistic local edits in component state
 *   - console.info on every commit so dev can observe the contract
 *   - surface a "Save all" button that, in v1, just console.infos every
 *     pending edit at once
 *
 * Truth chip is clickable: shows a small dropdown letting the contractor
 * manually promote/demote truth (also a console.info stub).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
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
  TakeoffMaterial,
  TakeoffSymbolTruth,
  TakeoffTariffFlag,
} from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Extended truth â€” adds the field-confirmed promotion local-only.
// ---------------------------------------------------------------------------

export type LocalTruth = TakeoffSymbolTruth | 'field_confirmed';

const TRUTH_OPTIONS: ReadonlyArray<{
  key: LocalTruth;
  label: string;
  fg: string;
  bg: string;
  border: string;
}> = [
  { key: 'asserted', label: 'Asserted', fg: '#34d399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.45)' },
  {
    key: 'field_confirmed',
    label: 'Field confirmed',
    fg: '#34d399',
    bg: 'rgba(52,211,153,0.16)',
    border: 'rgba(52,211,153,0.55)',
  },
  { key: 'derived', label: 'Derived', fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.45)' },
  { key: 'assumed', label: 'Assumed', fg: '#fbbf24', bg: 'transparent', border: 'rgba(251,191,36,0.45)' },
];

const TARIFF_STYLES: Record<TakeoffTariffFlag, { fg: string; bg: string; label: string }> = {
  steel: { fg: '#f87171', bg: 'rgba(248,113,113,0.10)', label: 'Steel' },
  aluminum: { fg: '#fb923c', bg: 'rgba(251,146,60,0.10)', label: 'Aluminum' },
  softwood: { fg: '#b08968', bg: 'rgba(176,137,104,0.10)', label: 'Softwood' },
  hardwood: { fg: '#92400e', bg: 'rgba(146,64,14,0.18)', label: 'Hardwood' },
  copper: { fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)', label: 'Copper' },
  none: { fg: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.03)', label: 'â€”' },
};

interface PendingEdit {
  materialId: string;
  /** New quantity value (string while editing, parsed on commit). */
  rawValue: string;
  /** New truth class (defaults to field_confirmed when quantity changes). */
  truth: LocalTruth;
}

interface Props {
  materials: TakeoffMaterial[];
  isLoading?: boolean;
  endpointMissing?: boolean;
}

export function QuantityTableEditable({
  materials,
  isLoading,
  endpointMissing,
}: Props): React.ReactElement {
  // Local edit map â€” keyed by material_id. Includes both pending and
  // committed edits so the UI shows them in field_confirmed state until
  // backend wires up.
  const [edits, setEdits] = useState<Record<string, PendingEdit>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [truthMenuFor, setTruthMenuFor] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...materials].sort((a, b) => b.quantity - a.quantity),
    [materials],
  );

  const commitEdit = useCallback(
    (materialId: string, rawValue: string) => {
      const parsed = parseFloat(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) {
        // eslint-disable-next-line no-console
        console.info('[takeoff] quantity-edit-rejected', materialId, rawValue);
        setEditingId(null);
        return;
      }
      setEdits((prev) => ({
        ...prev,
        [materialId]: {
          materialId,
          rawValue: String(parsed),
          truth: 'field_confirmed',
        },
      }));
      // eslint-disable-next-line no-console
      console.info('[takeoff] quantity-edit-commit', {
        materialId,
        newQuantity: parsed,
        truth: 'field_confirmed',
      });
      setEditingId(null);
    },
    [],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const setTruth = useCallback((materialId: string, truth: LocalTruth) => {
    setEdits((prev) => {
      const existing = prev[materialId];
      return {
        ...prev,
        [materialId]: {
          materialId,
          rawValue: existing?.rawValue ?? '',
          truth,
        },
      };
    });
    // eslint-disable-next-line no-console
    console.info('[takeoff] truth-set', { materialId, truth });
    setTruthMenuFor(null);
  }, []);

  const saveAll = useCallback(() => {
    const pending = Object.values(edits);
    if (pending.length === 0) return;
    // eslint-disable-next-line no-console
    console.info('[takeoff] save-all', pending);
  }, [edits]);

  const pendingCount = Object.keys(edits).length;

  return (
    <View style={styles.host} testID="quantity-table-editable">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quantities â€” verification</Text>
          <Text style={styles.subtitle}>
            {sorted.length} line item{sorted.length === 1 ? '' : 's'}
            {pendingCount > 0
              ? ` Â· ${pendingCount} pending edit${pendingCount === 1 ? '' : 's'}`
              : ''}
          </Text>
        </View>
        <Pressable
          onPress={saveAll}
          disabled={pendingCount === 0}
          accessibilityRole="button"
          accessibilityLabel={`Save all (${pendingCount} edits)`}
          accessibilityState={{ disabled: pendingCount === 0 }}
          testID="quantity-table-save-all"
          style={({ hovered }: any) => [
            styles.saveBtn,
            pendingCount === 0 ? styles.saveBtnDisabled : null,
            hovered && pendingCount > 0 ? styles.saveBtnHover : null,
          ]}
        >
          <Ionicons
            name="cloud-upload-outline"
            size={13}
            color={pendingCount === 0 ? 'rgba(255,255,255,0.35)' : '#0b0b0b'}
          />
          <Text
            style={[
              styles.saveBtnText,
              pendingCount === 0 ? styles.saveBtnTextDisabled : null,
            ]}
          >
            {pendingCount === 0 ? 'Save all' : `Save all (${pendingCount})`}
          </Text>
        </Pressable>
      </View>

      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={[styles.col, { flex: 2.6 }]}>
          <Text style={styles.headerText}>Line Item</Text>
        </View>
        <View style={[styles.col, { flex: 1, alignItems: 'flex-end' }]}>
          <Text style={styles.headerText}>Qty</Text>
        </View>
        <View style={[styles.col, { flex: 0.6 }]}>
          <Text style={styles.headerText}>Unit</Text>
        </View>
        <View style={[styles.col, { flex: 1.1 }]}>
          <Text style={styles.headerText}>Truth</Text>
        </View>
        <View style={[styles.col, { flex: 1 }]}>
          <Text style={styles.headerText}>Tariff</Text>
        </View>
      </View>

      <ScrollView style={styles.body} testID="quantity-table-editable-body">
        {isLoading ? (
          <EmptyMessage icon="hourglass-outline" title="Loading materialsâ€¦" />
        ) : endpointMissing ? (
          <EmptyMessage
            icon="warning-outline"
            title="Quantities require Wave 2.7"
            body="The backend endpoint for derived materials has not landed yet. UI is wired; data flows once Wave 2.7 PR merges."
            tone="warning"
          />
        ) : sorted.length === 0 ? (
          <EmptyMessage
            icon="calculator-outline"
            title="No quantities yet"
            body="Drew's PROCURE pass derives per-material quantities once the plan set classifies."
          />
        ) : (
          sorted.map((m) => {
            const edit = edits[m.material_id];
            const effectiveTruth: LocalTruth = edit?.truth ?? m.truth;
            const effectiveQty = edit ? parseFloat(edit.rawValue) : m.quantity;
            const tariff = TARIFF_STYLES[m.tariff_flag];
            const truthStyle =
              TRUTH_OPTIONS.find((o) => o.key === effectiveTruth) ?? TRUTH_OPTIONS[2];
            const isEditing = editingId === m.material_id;
            const isMenuOpen = truthMenuFor === m.material_id;
            const isEdited = !!edit;

            return (
              <View
                key={m.material_id}
                style={[styles.row, isEdited ? styles.rowEdited : null]}
                testID={`material-row-edit-${m.material_id}`}
              >
                <View style={[styles.col, { flex: 2.6 }]}>
                  <Text style={styles.cellLineItem} numberOfLines={2}>
                    {m.line_item}
                  </Text>
                  {m.supplier_name ? (
                    <Text style={styles.cellSupplier} numberOfLines={1}>
                      {m.supplier_name}
                    </Text>
                  ) : null}
                </View>

                {/* Editable quantity cell */}
                <View style={[styles.col, { flex: 1, alignItems: 'flex-end' }]}>
                  {isEditing ? (
                    <QuantityEditor
                      initial={String(effectiveQty)}
                      onCommit={(v) => commitEdit(m.material_id, v)}
                      onCancel={cancelEdit}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setEditingId(m.material_id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit quantity for ${m.line_item}`}
                      testID={`material-qty-${m.material_id}`}
                      style={({ hovered }: any) => [
                        styles.qtyCell,
                        hovered ? styles.qtyCellHover : null,
                        isEdited ? styles.qtyCellEdited : null,
                      ]}
                    >
                      <Text style={styles.qtyText}>
                        {Number.isFinite(effectiveQty)
                          ? effectiveQty.toLocaleString()
                          : 'â€”'}
                      </Text>
                      <Ionicons
                        name="pencil-outline"
                        size={10}
                        color="rgba(255,255,255,0.35)"
                      />
                    </Pressable>
                  )}
                </View>

                <View style={[styles.col, { flex: 0.6 }]}>
                  <Text style={styles.cellUnit}>{m.unit}</Text>
                </View>

                {/* Clickable truth chip with dropdown */}
                <View style={[styles.col, { flex: 1.1 }]}>
                  <Pressable
                    onPress={() =>
                      setTruthMenuFor((prev) =>
                        prev === m.material_id ? null : m.material_id,
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Truth: ${truthStyle.label}. Tap to change.`}
                    testID={`material-truth-${m.material_id}`}
                    style={({ hovered }: any) => [
                      styles.truthChip,
                      {
                        backgroundColor: truthStyle.bg,
                        borderColor: truthStyle.border,
                      },
                      hovered ? styles.truthChipHover : null,
                    ]}
                  >
                    <Text style={[styles.truthChipText, { color: truthStyle.fg }]}>
                      {truthStyle.label}
                    </Text>
                    <Ionicons
                      name={isMenuOpen ? 'chevron-up' : 'chevron-down'}
                      size={9}
                      color={truthStyle.fg}
                    />
                  </Pressable>
                  {isMenuOpen ? (
                    <View
                      style={styles.truthMenu}
                      testID={`material-truth-menu-${m.material_id}`}
                    >
                      {TRUTH_OPTIONS.map((opt) => (
                        <Pressable
                          key={opt.key}
                          onPress={() => setTruth(m.material_id, opt.key)}
                          accessibilityRole="menuitem"
                          accessibilityLabel={`Set truth to ${opt.label}`}
                          testID={`material-truth-menu-${m.material_id}-${opt.key}`}
                          style={({ hovered }: any) => [
                            styles.truthMenuItem,
                            hovered ? styles.truthMenuItemHover : null,
                          ]}
                        >
                          <View
                            style={[
                              styles.truthMenuDot,
                              { backgroundColor: opt.fg },
                            ]}
                          />
                          <Text style={styles.truthMenuText}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={[styles.col, { flex: 1 }]}>
                  <View
                    style={[
                      styles.tariffChip,
                      { backgroundColor: tariff.bg, borderColor: tariff.fg + '55' },
                    ]}
                  >
                    <Text style={[styles.tariffText, { color: tariff.fg }]}>
                      {tariff.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// QuantityEditor â€” small inline TextInput used while editing
// ---------------------------------------------------------------------------

function QuantityEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [value, setValue] = useState(initial);

  return (
    <View style={styles.editorHost}>
      <TextInput
        value={value}
        onChangeText={setValue}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
        onSubmitEditing={() => onCommit(value)}
        onBlur={() => onCommit(value)}
        accessibilityLabel="Edit quantity"
        testID="quantity-editor-input"
        style={styles.editorInput}
      />
      <Pressable
        onPress={() => onCommit(value)}
        accessibilityRole="button"
        accessibilityLabel="Commit edit"
        testID="quantity-editor-commit"
        style={({ hovered }: any) => [
          styles.editorBtn,
          styles.editorBtnPrimary,
          hovered ? styles.editorBtnHover : null,
        ]}
      >
        <Ionicons name="checkmark" size={11} color="#0b0b0b" />
      </Pressable>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel edit"
        testID="quantity-editor-cancel"
        style={({ hovered }: any) => [
          styles.editorBtn,
          hovered ? styles.editorBtnHover : null,
        ]}
      >
        <Ionicons name="close" size={11} color="rgba(255,255,255,0.85)" />
      </Pressable>
    </View>
  );
}

function EmptyMessage({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  tone?: 'warning';
}): React.ReactElement {
  return (
    <View style={styles.empty}>
      <Ionicons
        name={icon}
        size={28}
        color={tone === 'warning' ? '#fbbf24' : 'rgba(255,255,255,0.40)'}
      />
      <Text style={[styles.emptyTitle, tone === 'warning' && { color: '#fbbf24' }]}>
        {title}
      </Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    padding: 16,
    gap: 10,
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.10)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
    ...(Platform.OS === 'web'
      ? ({
          transition: 'filter 120ms ease, opacity 120ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  saveBtnHover: {
    ...(Platform.OS === 'web' ? ({ filter: 'brightness(1.12)' } as any) : {}),
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : {}),
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0b0b0b',
    letterSpacing: -0.05,
  },
  saveBtnTextDisabled: {
    color: 'rgba(255,255,255,0.40)',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  col: {
    paddingHorizontal: 6,
  },
  body: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    alignItems: 'flex-start',
  },
  rowEdited: {
    backgroundColor: 'rgba(52,211,153,0.04)',
  },
  cellLineItem: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  cellSupplier: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
    letterSpacing: -0.05,
  },
  qtyCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'text' } as any) : {}),
  },
  qtyCellHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  qtyCellEdited: {
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderColor: 'rgba(52,211,153,0.45)',
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
  },
  cellUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.05,
  },
  truthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 120ms ease, border-color 120ms ease',
          cursor: 'pointer',
        } as any)
      : {}),
  },
  truthChipHover: {
    ...(Platform.OS === 'web' ? ({ filter: 'brightness(1.18)' } as any) : {}),
  },
  truthChipText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  truthMenu: {
    marginTop: 4,
    backgroundColor: 'rgba(14,16,22,0.98)',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 4,
    gap: 1,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        } as any)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 12,
        }),
  },
  truthMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  truthMenuItemHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  truthMenuDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  truthMenuText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
  },
  tariffChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  tariffText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Inline editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  editorHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editorInput: {
    width: 70,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  editorBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  editorBtnPrimary: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  editorBtnHover: {
    ...(Platform.OS === 'web' ? ({ filter: 'brightness(1.18)' } as any) : {}),
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  emptyBody: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 16,
  },
});

export default QuantityTableEditable;
