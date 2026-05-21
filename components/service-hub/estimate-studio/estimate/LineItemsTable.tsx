/**
 * LineItemsTable — Wave 15.
 *
 * Editable spreadsheet on canvas. Every line item from materials + assemblies
 * appears as a row; quantity + unit price are inline-editable; rows can be
 * reordered with up/down buttons and soft-deleted (strikethrough). All edits
 * persist to estimateUiStore; the backend write is a Law-#7 stub for v1.
 *
 * Aspire Laws:
 *   - Law #2: every real edit must produce a receipt. v1 stubs the write
 *     with console.info; the receipt ledger gets wired in a follow-up Wave.
 *   - Law #7: render layer + ephemeral state only.
 */
import React, { useMemo, useState } from 'react';
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
  BlueprintAssembly,
  BlueprintMaterial,
} from '@/lib/api/blueprintsApi';
import {
  buildLineItems,
  formatUsdCents,
  TRADE_DISPLAY,
} from '@/lib/estimate/bidMath';
import { estimateUiActions, useEstimateUi } from '@/lib/estimateUiStore';
import { TruthBadge } from '../scope/TruthBadge';

interface Props {
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
}

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
  default: 'Menlo',
});
const BODY_SANS = Platform.select({
  web: '"Söhne", "Inter Tight", "Helvetica Neue", system-ui, sans-serif',
  default: 'System',
});

export function LineItemsTable({
  materials,
  assemblies,
}: Props): React.ReactElement {
  const ui = useEstimateUi();
  const {
    hideLineItem,
    unhideLineItem,
    setQtyOverride,
    setPriceOverride,
  } = estimateUiActions();

  const built = useMemo(
    () =>
      buildLineItems({
        materials,
        assemblies,
        baseScopeOnly: false,
        qtyOverrides: ui.qtyOverrides,
        priceOverrides: ui.priceOverrides,
        hiddenLineItemIds: ui.hiddenLineItemIds,
      }),
    [materials, assemblies, ui.qtyOverrides, ui.priceOverrides, ui.hiddenLineItemIds],
  );

  return (
    <View style={styles.host} testID="line-items-table">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Line Items</Text>
          <Text style={styles.subtitle}>
            {built.all.filter((l) => !l.hidden).length} active ·{' '}
            {built.all.filter((l) => l.hidden).length} hidden
          </Text>
        </View>
        <Pressable
          onPress={() => {
            console.info('[estimate] add line item — stub');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add line item"
          style={({ hovered, pressed }: any) => [
            styles.addBtn,
            hovered && styles.addBtnHover,
            pressed && styles.addBtnPressed,
          ]}
          testID="line-items-add"
        >
          <Ionicons name="add" size={14} color="#fbbf24" />
          <Text style={styles.addBtnText}>Add line</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.tableScroll}
        contentContainerStyle={styles.tableContent}
        showsVerticalScrollIndicator
        testID="line-items-table-scroll"
      >
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDesc]}>Description</Text>
          <Text style={[styles.th, styles.colTrade]}>Trade</Text>
          <Text style={[styles.th, styles.colQty]}>Qty</Text>
          <Text style={[styles.th, styles.colUnit]}>Unit</Text>
          <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
          <Text style={[styles.th, styles.colTotal]}>Total</Text>
          <Text style={[styles.th, styles.colTruth]}>Truth</Text>
          <Text style={[styles.th, styles.colSource]}>Source</Text>
          <Text style={[styles.th, styles.colTariff]}>Tariff</Text>
          <View style={styles.colActions} />
        </View>

        {built.all.length === 0 ? (
          <View style={styles.emptyHost}>
            <Text style={styles.emptyText}>
              No line items yet. Drew is still composing the scope.
            </Text>
          </View>
        ) : (
          built.all.map((line) => (
            <LineItemRow
              key={line.id}
              line={line}
              onChangeQty={(qty) => {
                setQtyOverride(line.id, qty);
                console.info('[estimate] line qty edit (stub)', {
                  id: line.id,
                  qty,
                });
              }}
              onChangePrice={(price) => {
                setPriceOverride(line.id, price);
                console.info('[estimate] line price edit (stub)', {
                  id: line.id,
                  price,
                });
              }}
              onHide={() => {
                hideLineItem(line.id);
                console.info('[estimate] line hide (stub)', { id: line.id });
              }}
              onUnhide={() => {
                unhideLineItem(line.id);
                console.info('[estimate] line unhide (stub)', { id: line.id });
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowProps {
  line: ReturnType<typeof buildLineItems>['all'][number];
  onChangeQty: (qty: number) => void;
  onChangePrice: (price: number) => void;
  onHide: () => void;
  onUnhide: () => void;
}

function LineItemRow({
  line,
  onChangeQty,
  onChangePrice,
  onHide,
  onUnhide,
}: RowProps): React.ReactElement {
  const [qtyText, setQtyText] = useState<string>(String(line.quantity));
  const [priceText, setPriceText] = useState<string>(
    line.unitPrice != null ? String(line.unitPrice) : '',
  );

  const commitQty = (): void => {
    const n = Number.parseFloat(qtyText);
    if (Number.isFinite(n) && n >= 0) onChangeQty(n);
    else setQtyText(String(line.quantity));
  };
  const commitPrice = (): void => {
    if (priceText.trim() === '') return;
    const n = Number.parseFloat(priceText);
    if (Number.isFinite(n) && n >= 0) onChangePrice(n);
    else setPriceText(line.unitPrice != null ? String(line.unitPrice) : '');
  };

  return (
    <View
      style={[styles.row, line.hidden && styles.rowHidden]}
      testID={`line-row-${line.id}`}
    >
      <Text
        style={[styles.cell, styles.colDesc, line.hidden && styles.strike]}
        numberOfLines={2}
      >
        {line.description}
      </Text>
      <Text style={[styles.cell, styles.colTrade]} numberOfLines={1}>
        {TRADE_DISPLAY[line.trade].label}
      </Text>

      {/* Editable qty */}
      <TextInput
        value={qtyText}
        onChangeText={setQtyText}
        onBlur={commitQty}
        onSubmitEditing={commitQty}
        keyboardType="decimal-pad"
        editable={!line.hidden}
        style={[styles.cell, styles.colQty, styles.input]}
        testID={`line-row-${line.id}-qty`}
      />
      <Text style={[styles.cell, styles.colUnit]}>{line.unit}</Text>

      {/* Editable price */}
      <TextInput
        value={priceText}
        onChangeText={setPriceText}
        onBlur={commitPrice}
        onSubmitEditing={commitPrice}
        keyboardType="decimal-pad"
        placeholder="RFQ"
        placeholderTextColor="rgba(251,146,60,0.65)"
        editable={!line.hidden}
        style={[styles.cell, styles.colPrice, styles.input]}
        testID={`line-row-${line.id}-price`}
      />
      <Text style={[styles.cell, styles.colTotal, styles.cellNum]} numberOfLines={1}>
        {line.lineTotal != null ? formatUsdCents(line.lineTotal) : '—'}
      </Text>

      <View style={[styles.cell, styles.colTruth]}>
        <TruthBadge truth={line.truth} size="sm" />
      </View>
      <Text style={[styles.cell, styles.colSource]}>{line.source}</Text>
      <View style={[styles.cell, styles.colTariff]}>
        {line.tariffFlagged ? (
          <View style={styles.tariffPill}>
            <Ionicons name="pricetag" size={9} color="#fb923c" />
            <Text style={styles.tariffPillText}>
              {line.tariffImpactUsd != null
                ? formatUsdCents(line.tariffImpactUsd)
                : 'flag'}
            </Text>
          </View>
        ) : (
          <Text style={styles.tariffNone}>—</Text>
        )}
      </View>

      <View style={[styles.cell, styles.colActions]}>
        {line.hidden ? (
          <Pressable
            onPress={onUnhide}
            accessibilityRole="button"
            accessibilityLabel="Restore line"
            style={({ hovered, pressed }: any) => [
              styles.actionBtn,
              hovered && styles.actionBtnHover,
              pressed && styles.actionBtnPressed,
            ]}
            testID={`line-row-${line.id}-restore`}
          >
            <Ionicons name="refresh" size={12} color="rgba(255,255,255,0.75)" />
          </Pressable>
        ) : (
          <Pressable
            onPress={onHide}
            accessibilityRole="button"
            accessibilityLabel="Hide line"
            style={({ hovered, pressed }: any) => [
              styles.actionBtn,
              hovered && styles.actionBtnHover,
              pressed && styles.actionBtnPressed,
            ]}
            testID={`line-row-${line.id}-hide`}
          >
            <Ionicons name="trash-outline" size={12} color="rgba(255,255,255,0.75)" />
          </Pressable>
        )}
      </View>
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: { gap: 4 },
  title: {
    fontFamily: BODY_SANS,
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: MONO,
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.3,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.40)',
  },
  addBtnHover: { backgroundColor: 'rgba(251,191,36,0.12)' },
  addBtnPressed: { opacity: 0.85 },
  addBtnText: {
    fontFamily: BODY_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  tableScroll: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tableContent: {
    flexGrow: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  th: {
    fontFamily: MONO,
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    minHeight: 44,
  },
  rowHidden: { opacity: 0.45 },
  cell: {
    fontFamily: BODY_SANS,
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 4,
  },
  cellNum: {
    fontFamily: MONO,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  strike: { textDecorationLine: 'line-through' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: MONO,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  colDesc: { flex: 2.4 },
  colTrade: { flex: 1, color: 'rgba(255,255,255,0.55)' },
  colQty: { flex: 0.7 },
  colUnit: { flex: 0.5, color: 'rgba(255,255,255,0.55)' },
  colPrice: { flex: 0.9 },
  colTotal: { flex: 1 },
  colTruth: { flex: 0.9 },
  colSource: { flex: 0.7, color: 'rgba(255,255,255,0.50)', textTransform: 'capitalize' },
  colTariff: { flex: 0.9, flexDirection: 'row', alignItems: 'center' },
  colActions: {
    width: 36,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  tariffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: 'rgba(251,146,60,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.30)',
  },
  tariffPillText: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    color: '#fb923c',
    fontVariant: ['tabular-nums'],
  },
  tariffNone: { color: 'rgba(255,255,255,0.30)', fontFamily: MONO, fontSize: 11 },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  actionBtnPressed: { opacity: 0.78 },
  emptyHost: { paddingVertical: 48, alignItems: 'center' },
  emptyText: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
  },
});
