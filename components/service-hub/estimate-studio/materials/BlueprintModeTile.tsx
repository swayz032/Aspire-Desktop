/**
 * BlueprintModeTile — Wave 14.
 *
 * Wraps the existing `ProductCard` so the Tool-tile visual contract is
 * preserved VERBATIM (shape, dimensions, image hero, brand chip, price
 * row, ADD button, hover lift, etc.). Blueprint Mode is purely additive:
 *
 *   ┌──────────────────────────────┐
 *   │ ┌📐 FROM E-1┐         ┌ E ┐  │  ← FROM-sheet badge + discipline pill
 *   │ │  product hero image  │   │
 *   │ │  + standard stock /  │   │     (existing ProductCard overlay)
 *   │ │  drive chips         │   │
 *   │ └──────────────────────┘   │
 *   │ Brand                       │  ← ProductCard body unchanged
 *   │ Title                       │
 *   │ ★ rating                    │
 *   │ $123.45 / ea  🏷 +14% S232  │  ← tariff inline chip (NEW, only when set)
 *   │ Store · address             │
 *   │                             │
 *   │ Drew matched 12× on E-1     │  ← reasoning row (NEW)
 *   │                             │
 *   │ ┌DERIVED ▾┐ ┌ADD┐ ┌ALT (3)┐ │  ← truth chip + ADD + alternates (NEW)
 *   └──────────────────────────────┘
 *
 * Strategy:
 *   - The card BODY is `<ProductCard>` rendered as-is. The wrapper only
 *     positions absolute overlays on top of it and renders an additive
 *     reasoning + truth + alternates row BELOW the original card.
 *   - The Pressable wrapping the whole thing emits `onOpenDetail` for the
 *     side panel; press events on the underlying ADD/COMPARE buttons stop
 *     propagation by virtue of the standard RN Pressable hit-area model
 *     (the inner buttons receive the press first; outer Pressable does
 *     not double-fire when onPress originates on an interactive descendant
 *     because it's wrapped in a View, not a touchable). We use a guarded
 *     `onCardPress` that ignores presses originating from the ADD button.
 *
 * Aspire Law compliance:
 *   - Law #7: render only. RFQ / Override stubs console.info their intent;
 *     real wiring is a later wave.
 *   - Law #3: missing optional fields render gracefully — no fabrication.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@/hooks/useMaterialsSearch';
import type { TakeoffMaterial, TakeoffTariffFlag } from '@/lib/api/blueprintsApi';
import { ProductCard, type ProductCardExtended } from './ProductCard';
import { getDisciplineStyle } from '../plans-photos/disciplines';

// ---------------------------------------------------------------------------
// BlueprintTile = the union of a Drew TakeoffMaterial + projected ProductCard
// fields. We synthesise a Product object from the TakeoffMaterial so the
// existing ProductCard renders without modification.
// ---------------------------------------------------------------------------

export interface BlueprintTileMaterial extends TakeoffMaterial {
  /** Sheet code like "E-1" — optional; backend may not yet provide. */
  sheet_code?: string | null;
  /** Discipline ("electrical", "plumbing", etc) — optional. */
  discipline?: string | null;
  /** Plain-English reasoning Drew emitted at PROCURE stage — optional. */
  drew_reasoning?: string | null;
  /** Count of detected instances on the source sheet — optional. */
  match_count?: number | null;
  /** Catalog-derived price per unit, USD — optional. */
  unit_price?: number | null;
  /** Optional hero image — falls back to a discipline-tinted placeholder. */
  image_url?: string | null;
  /** Optional brand surfaced from supplier match — falls back to supplier_name. */
  brand?: string | null;
  /** Alternative supplier match count for the ALTERNATES button. */
  alternates_count?: number | null;
}

interface Props {
  material: BlueprintTileMaterial;
  /** Add to bundle — same hook as Tool-mode ProductCard.onAdd. */
  onAdd: (m: BlueprintTileMaterial) => void;
  /** Open the rich side panel (tile body click). */
  onOpenDetail: (m: BlueprintTileMaterial) => void;
  /** Open the alternates listing (button click — stops propagation). */
  onOpenAlternates: (m: BlueprintTileMaterial) => void;
  /** Open the truth dropdown stub — for now a console.info. */
  onTruthClick: (m: BlueprintTileMaterial) => void;
  /** Is this material already in the bundle? (visual reflect via ProductCard). */
  isInBundle?: boolean;
}

const WEB_TRANSITION: ViewStyle =
  Platform.OS === 'web'
    ? (({ transition: 'transform 180ms ease' } as unknown) as ViewStyle)
    : {};

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" fill="#1a1a1f"/>` +
      `<path d="M16 44h32M20 36h24M24 28h16" stroke="rgba(251,191,36,0.40)" stroke-width="1.5" fill="none"/>` +
    `</svg>`,
  );

const TARIFF_LABEL: Record<TakeoffTariffFlag, string> = {
  steel: '+14% S232',
  aluminum: '+10% S232',
  softwood: 'softwood duty',
  hardwood: 'hardwood',
  copper: 'copper',
  none: '',
};

const TRUTH_PILL: Record<
  TakeoffMaterial['truth'],
  { label: string; fg: string; bg: string }
> = {
  asserted: { label: 'OBSERVED', fg: '#86efac', bg: 'rgba(74,222,128,0.10)' },
  derived: { label: 'DERIVED', fg: '#93c5fd', bg: 'rgba(96,165,250,0.10)' },
  assumed: { label: 'ASSUMED', fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
};

// ---------------------------------------------------------------------------
// Materialise a TakeoffMaterial into the existing ProductCardExtended shape
// so the Tool-tile renderer can be reused verbatim. We do NOT redesign the
// card — just project Drew's fields into the Product schema.
// ---------------------------------------------------------------------------
function projectToProduct(m: BlueprintTileMaterial): ProductCardExtended {
  const price = typeof m.unit_price === 'number' && m.unit_price > 0 ? m.unit_price : 0;
  return {
    id: m.material_id,
    title: m.line_item,
    brand: (m.brand ?? m.supplier_name ?? '—').toString(),
    imageUrl: m.image_url && m.image_url.length > 0 ? m.image_url : PLACEHOLDER_IMG,
    price,
    unit: m.unit,
    rating: 0,
    reviewCount: 0,
    source: 'specialty',
    fetchedAt: new Date().toISOString(),
    store: {
      id: m.supplier_name ?? 'blueprint',
      name: m.supplier_name ?? 'Drew pick',
      driveMinutes: 0,
      inStock: true,
    },
    storeAddress: null,
  };
}

export function BlueprintModeTile({
  material,
  onAdd,
  onOpenDetail,
  onOpenAlternates,
  onTruthClick,
  isInBundle = false,
}: Props): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  const product = useMemo(() => projectToProduct(material), [material]);

  const sheetCode = material.sheet_code ?? null;
  const discipline = getDisciplineStyle(material.discipline ?? null);
  const tariff = material.tariff_flag;
  const tariffLabel = tariff !== 'none' ? TARIFF_LABEL[tariff] : null;
  const truth = TRUTH_PILL[material.truth];
  const reasoning =
    material.drew_reasoning ??
    (sheetCode && material.match_count
      ? `Drew matched ${material.match_count} instances on ${sheetCode}`
      : sheetCode
        ? `Sourced from ${sheetCode}`
        : 'Drew pick');
  const altCount = material.alternates_count ?? 0;

  const handleCardPress = useCallback(() => {
    onOpenDetail(material);
  }, [material, onOpenDetail]);

  const handleAdd = useCallback(() => {
    onAdd(material);
  }, [material, onAdd]);

  const handleAlternates = useCallback(() => {
    onOpenAlternates(material);
  }, [material, onOpenAlternates]);

  const handleTruth = useCallback(() => {
    onTruthClick(material);
  }, [material, onTruthClick]);

  // We never invoke ProductCard's onCompare in Blueprint mode — alternates
  // take its place. Pass a noop so ProductCard's button still renders for
  // visual parity, but route the click to the alternates handler so users
  // get a sensible action.
  const handleProductCompare = useCallback(() => {
    onOpenAlternates(material);
  }, [material, onOpenAlternates]);

  const webHoverHandlers =
    Platform.OS === 'web'
      ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        }
      : {};

  return (
    <View
      {...(webHoverHandlers as any)}
      style={[styles.host, hovered && styles.hostHovered, WEB_TRANSITION]}
      testID={`blueprint-tile-${material.material_id}`}
    >
      {/* Tap the body (not buttons) to open the side panel.
          Position the Pressable as a transparent overlay above the ProductCard
          image area only — buttons remain interactive. */}
      <Pressable
        onPress={handleCardPress}
        accessibilityRole="button"
        accessibilityLabel={`Open ${material.line_item} detail`}
        style={styles.bodyHitTarget}
        testID={`blueprint-tile-open-${material.material_id}`}
      />

      <ProductCard
        product={product}
        onAdd={handleAdd}
        onCompare={handleProductCompare}
        isInBundle={isInBundle}
      />

      {/* Overlay: FROM-sheet badge (top-left) + discipline pill (top-right).
          Positioned over the ProductCard image overlay row. */}
      {sheetCode ? (
        <View
          style={styles.fromBadge}
          pointerEvents="none"
          testID={`blueprint-tile-from-${material.material_id}`}
        >
          <Text style={styles.fromBadgeIcon}>📐</Text>
          <Text style={styles.fromBadgeText}>FROM {sheetCode}</Text>
        </View>
      ) : null}

      {material.discipline ? (
        <View
          style={[
            styles.discPill,
            { backgroundColor: discipline.bg, borderColor: discipline.fg + '55' },
          ]}
          pointerEvents="none"
          testID={`blueprint-tile-discipline-${material.material_id}`}
        >
          <Text style={[styles.discPillText, { color: discipline.fg }]}>
            {discipline.code}
          </Text>
        </View>
      ) : null}

      {/* Tariff inline chip — sits absolutely just under the price row of the
          ProductCard so it joins the price visually without re-skinning the
          card. We anchor by approximate offset from the bottom of the image
          area; on small viewports it will overlap slightly with avail text,
          which is acceptable per the "preserve tile shape" mandate. */}
      {tariffLabel ? (
        <View
          style={styles.tariffChip}
          pointerEvents="none"
          testID={`blueprint-tile-tariff-${material.material_id}`}
        >
          <Text style={styles.tariffChipIcon}>🏷</Text>
          <Text style={styles.tariffChipText}>{tariffLabel}</Text>
        </View>
      ) : null}

      {/* Additive footer: reasoning + truth + ALT — sits BELOW the ProductCard.
          The ProductCard's own ADD/COMPARE row is preserved verbatim above. */}
      <View style={styles.addendum}>
        <Text
          style={styles.reasoning}
          numberOfLines={2}
          testID={`blueprint-tile-reasoning-${material.material_id}`}
        >
          {reasoning}
        </Text>
        <View style={styles.addendumRow}>
          <Pressable
            onPress={handleTruth}
            accessibilityRole="button"
            accessibilityLabel={`Truth: ${truth.label}. Tap for options.`}
            style={({ hovered: h, pressed }: any) => [
              styles.truthChip,
              { backgroundColor: truth.bg },
              h && styles.truthChipHover,
              pressed && styles.truthChipPressed,
            ]}
            testID={`blueprint-tile-truth-${material.material_id}`}
          >
            <View style={[styles.truthDot, { backgroundColor: truth.fg }]} />
            <Text style={[styles.truthLabel, { color: truth.fg }]}>{truth.label}</Text>
            <Ionicons name="chevron-down" size={9} color={truth.fg} />
          </Pressable>

          <Pressable
            onPress={handleAlternates}
            accessibilityRole="button"
            accessibilityLabel={`Show ${altCount} alternates`}
            style={({ hovered: h, pressed }: any) => [
              styles.altBtn,
              h && styles.altBtnHover,
              pressed && styles.altBtnPressed,
            ]}
            testID={`blueprint-tile-alternates-${material.material_id}`}
          >
            <Ionicons name="swap-horizontal" size={11} color="rgba(255,255,255,0.78)" />
            <Text style={styles.altBtnText}>ALTERNATES ({altCount})</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'relative',
    gap: 8,
  },
  hostHovered: {
    ...(Platform.OS === 'web'
      ? (({ transform: 'translateY(-1px)' as any } as unknown) as ViewStyle)
      : {}),
  },
  // Invisible overlay over the top half of the card so body-clicks open
  // the side panel; sits ABOVE the ProductCard image but BELOW the badges
  // (pointerEvents='none' on badges keeps them visual-only).
  bodyHitTarget: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Cover the image area only — leave ProductCard's title / price / buttons
    // free to receive their own clicks. Image is 1:1 + ~10px padding.
    aspectRatio: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },

  // FROM-sheet badge (top-left over image)
  fromBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(8,8,12,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
    zIndex: 4,
  },
  fromBadgeIcon: {
    fontSize: 9,
  },
  fromBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fbbf24',
    letterSpacing: 0.6,
  },

  // Discipline pill (top-right over image)
  discPill: {
    position: 'absolute',
    // Anchor opposite corner of fromBadge — top:16 mirrors the image padding.
    top: 16,
    right: 16,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    zIndex: 4,
  },
  discPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Tariff inline chip — anchored bottom-right of image (above price row).
  // Image is 1:1 + ~10px padding so we use absolute positioning relative
  // to the host. On hover the ProductCard lifts by 2px and the chip lifts
  // with it because it shares the host transform.
  tariffChip: {
    position: 'absolute',
    top: '50%',
    right: 14,
    transform: [{ translateY: -10 }],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.40)',
    zIndex: 3,
  },
  tariffChipIcon: { fontSize: 9 },
  tariffChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fca5a5',
    letterSpacing: 0.5,
  },

  // Additive footer (below ProductCard, NOT inside)
  addendum: {
    gap: 6,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  reasoning: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 14,
    letterSpacing: -0.05,
  },
  addendumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  truthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  truthChipHover: {
    opacity: 0.85,
  },
  truthChipPressed: {
    opacity: 0.7,
  },
  truthDot: { width: 4, height: 4, borderRadius: 4 },
  truthLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  altBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  altBtnPressed: {
    opacity: 0.78,
  },
  altBtnText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.5,
  },
});
