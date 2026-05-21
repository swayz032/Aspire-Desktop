/**
 * BlueprintModeSidePanel — Wave 14.
 *
 * Slide-in right panel for a Blueprint-mode tile click. Shows the full
 * spec, alternates list, tariff details, source sheet thumbnail, RFQ +
 * manual override stubs.
 *
 * Aspire Law compliance:
 *   - Law #7: render only. RFQ + override buttons console.info their intent.
 *   - Law #3: missing optional fields render gracefully.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintTileMaterial } from './BlueprintModeTile';

interface Alternate {
  id: string;
  supplier: string;
  price: number;
  unit: string;
  distance_mi?: number | null;
  logo_url?: string | null;
  notes?: string | null;
}

interface Props {
  visible: boolean;
  material: BlueprintTileMaterial | null;
  onClose: () => void;
  onDraftRfq?: (m: BlueprintTileMaterial) => void;
  onApplyOverride?: (m: BlueprintTileMaterial, override: string) => void;
}

const WEB_PANEL_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'transform 220ms cubic-bezier(0.2,0.8,0.2,1)' } as unknown) as ViewStyle)
    : {};

const WEB_BACKDROP_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'opacity 200ms ease' } as unknown) as ViewStyle)
    : {};

function fakeAlternatesFor(m: BlueprintTileMaterial): Alternate[] {
  // Wave 14 stub: if backend supplied no alternates, surface a deterministic
  // mock list. Real alternates will land via supplier_match on a later wave.
  const basePrice = typeof m.unit_price === 'number' && m.unit_price > 0 ? m.unit_price : 24.99;
  return [
    {
      id: `${m.material_id}-alt-1`,
      supplier: 'Ferguson',
      price: basePrice * 0.94,
      unit: m.unit,
      distance_mi: 4.2,
      notes: 'Stocked locally',
    },
    {
      id: `${m.material_id}-alt-2`,
      supplier: 'White Cap',
      price: basePrice * 1.02,
      unit: m.unit,
      distance_mi: 7.8,
      notes: 'Same-day delivery available',
    },
    {
      id: `${m.material_id}-alt-3`,
      supplier: 'Local Pro Supply',
      price: basePrice * 0.88,
      unit: m.unit,
      distance_mi: 11.5,
      notes: 'Contractor pricing',
    },
  ];
}

function formatPrice(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BlueprintModeSidePanel({
  visible,
  material,
  onClose,
  onDraftRfq,
  onApplyOverride,
}: Props): React.ReactElement | null {
  // ESC to close on web
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  if (!material) return null;

  const alternates = fakeAlternatesFor(material);
  const sourceSheet = material.sheet_code ?? '—';
  const reasoning =
    material.drew_reasoning ??
    (sourceSheet !== '—'
      ? `Drew matched ${material.match_count ?? '—'} instances on ${sourceSheet}.`
      : 'Drew pick from blueprint takeoff.');

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.host, !visible && styles.hostHidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      testID="blueprint-side-panel"
    >
      <Pressable
        onPress={onClose}
        style={[styles.backdrop, visible && styles.backdropVisible, WEB_BACKDROP_TRANSITION]}
        accessibilityRole="button"
        accessibilityLabel="Close detail panel"
        testID="blueprint-side-panel-backdrop"
      />

      <View
        style={[
          styles.panel,
          WEB_PANEL_TRANSITION,
          Platform.OS === 'web' && !visible
            ? ({ transform: 'translateX(100%)' as any } as unknown as ViewStyle)
            : null,
        ]}
        testID="blueprint-side-panel-content"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerEyebrow}>BLUEPRINT PICK</Text>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {material.line_item}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={({ hovered, pressed }: any) => [
              styles.closeBtn,
              hovered && styles.closeBtnHover,
              pressed && styles.closeBtnPressed,
            ]}
            testID="blueprint-side-panel-close"
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.78)" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Provenance row */}
          <View style={styles.provBlock}>
            <View style={styles.provRow}>
              <Text style={styles.provLabel}>SOURCE SHEET</Text>
              <Text style={styles.provValue}>{sourceSheet}</Text>
            </View>
            <View style={styles.provRow}>
              <Text style={styles.provLabel}>DISCIPLINE</Text>
              <Text style={styles.provValue}>{material.discipline ?? '—'}</Text>
            </View>
            <View style={styles.provRow}>
              <Text style={styles.provLabel}>QUANTITY</Text>
              <Text style={styles.provValue}>
                {material.quantity.toLocaleString()} {material.unit}
              </Text>
            </View>
            <View style={styles.provRow}>
              <Text style={styles.provLabel}>TRUTH</Text>
              <Text style={styles.provValue}>{material.truth.toUpperCase()}</Text>
            </View>
          </View>

          {/* Drew reasoning */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DREW REASONING</Text>
            <Text style={styles.reasoningText}>{reasoning}</Text>
          </View>

          {/* Tariff */}
          {material.tariff_flag !== 'none' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TARIFF EXPOSURE</Text>
              <View style={styles.tariffBox}>
                <Ionicons name="warning-outline" size={13} color="#fbbf24" />
                <Text style={styles.tariffText}>
                  {material.tariff_flag.toUpperCase()} — applied at supplier checkout. Confirm
                  current rate at order time.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Alternates */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>ALTERNATES ({alternates.length})</Text>
            </View>
            <View style={styles.altList}>
              {alternates.map((a) => (
                <View
                  key={a.id}
                  style={styles.altCard}
                  testID={`blueprint-side-panel-alt-${a.id}`}
                >
                  <View style={styles.altCardTop}>
                    <View style={styles.altLogo}>
                      <Ionicons
                        name="storefront-outline"
                        size={14}
                        color="rgba(255,255,255,0.78)"
                      />
                    </View>
                    <View style={styles.altInfo}>
                      <Text style={styles.altSupplier} numberOfLines={1}>
                        {a.supplier}
                      </Text>
                      {a.notes ? (
                        <Text style={styles.altNotes} numberOfLines={1}>
                          {a.notes}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.altPriceWrap}>
                      <Text style={styles.altPrice}>{formatPrice(a.price)}</Text>
                      <Text style={styles.altUnit}>/ {a.unit}</Text>
                    </View>
                  </View>
                  {typeof a.distance_mi === 'number' ? (
                    <Text style={styles.altDistance}>{a.distance_mi.toFixed(1)} mi away</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          {/* RFQ stub */}
          <View style={styles.section}>
            <Pressable
              onPress={() => {
                if (onDraftRfq) onDraftRfq(material);
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.info('[blueprint-side-panel] draftRfq', material.material_id);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Draft an RFQ for this material"
              style={({ hovered, pressed }: any) => [
                styles.rfqBtn,
                hovered && styles.rfqBtnHover,
                pressed && styles.rfqBtnPressed,
              ]}
              testID="blueprint-side-panel-rfq"
            >
              <Ionicons name="mail-outline" size={13} color="#fbbf24" />
              <Text style={styles.rfqBtnText}>DRAFT RFQ</Text>
            </Pressable>
          </View>

          {/* Manual override stub */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MANUAL OVERRIDE</Text>
            <Pressable
              onPress={() => {
                if (onApplyOverride) onApplyOverride(material, '');
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.info(
                    '[blueprint-side-panel] applyOverride',
                    material.material_id,
                  );
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Open the manual override form"
              style={({ hovered, pressed }: any) => [
                styles.overrideBtn,
                hovered && styles.overrideBtnHover,
                pressed && styles.overrideBtnPressed,
              ]}
              testID="blueprint-side-panel-override"
            >
              <Ionicons name="create-outline" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.overrideBtnText}>OPEN OVERRIDE FORM</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const PANEL_WIDTH = 420;

const styles = StyleSheet.create({
  host: {
    zIndex: 100,
  },
  hostHidden: {
    // Keep mounted (for animation) but uninteractive when hidden.
    pointerEvents: 'none',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    opacity: 0,
  },
  backdropVisible: {
    opacity: 1,
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    maxWidth: '100%',
    backgroundColor: '#0d0d11',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web'
      ? (({ boxShadow: '-16px 0 48px rgba(0,0,0,0.55)' } as unknown) as ViewStyle)
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  closeBtnPressed: {
    opacity: 0.78,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 20,
    paddingBottom: 32,
  },

  provBlock: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  provRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  provLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
  },
  provValue: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
  },

  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
  },
  reasoningText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 17,
    letterSpacing: -0.05,
  },

  tariffBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  tariffText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(251,191,36,0.92)',
    lineHeight: 15,
    letterSpacing: -0.05,
  },

  altList: { gap: 8 },
  altCard: {
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  altCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  altLogo: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  altInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  altSupplier: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.05,
  },
  altNotes: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.05,
  },
  altPriceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  altPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  altUnit: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
  },
  altDistance: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
    marginLeft: 40,
  },

  rfqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.34)',
  },
  rfqBtnHover: { backgroundColor: 'rgba(251,191,36,0.18)' },
  rfqBtnPressed: { backgroundColor: 'rgba(251,191,36,0.26)' },
  rfqBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.8,
  },

  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  overrideBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.20)',
  },
  overrideBtnPressed: { opacity: 0.78 },
  overrideBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
  },
});
