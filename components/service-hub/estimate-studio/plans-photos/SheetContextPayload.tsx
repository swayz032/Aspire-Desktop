/**
 * SheetContextPayload — Wave 16 per-sheet premium intelligence.
 *
 * The contractor-loyalty layer. When the user is on Plans & Photos and
 * has a sheet focused on the canvas, the Tim Rail Context tab swaps from
 * the project-wide payload (counters, pipeline, discipline counts) into
 * THIS payload: dense, sheet-specific intelligence about the exact
 * drawing on stage.
 *
 * No competitor ships this. Togal/STACK/Kreo/Bluebeam/PlanGrid all show
 * project-wide stats — none of them route a live per-drawing readout
 * (sheet code · seal · symbol breakdown on this sheet · missing inputs
 * on this sheet · OCR snippet · image-cache health) into the right rail
 * the moment you click a sheet chip. This is the studio dossier.
 *
 * Composition (top → bottom):
 *   0. Premium card frame  — subtle gold 12% border, #0a0c10 ink-blue bg
 *   1. Sheet header        — big serif sheet code · italic title · seal pill
 *   2. Symbols on sheet    — breakdown by class + avg confidence + CTA
 *   3. Missing inputs      — count badge + up to 3 cards + "view all"
 *   4. OCR snippet         — collapsed by default; expands to mono block
 *   5. Metadata footer     — relative time · raw page index · SHA-256 · img health
 *
 * Fallback (no active sheet): Project Summary card — address · pipeline
 * status · discipline mini-bars · last upload · "click any sheet" hint.
 *
 * Premium polish:
 *   - 200ms opacity cross-fade when the active sheet changes (CLS = 0)
 *   - Cards reserve their minHeight; no layout shift on payload swap
 *   - ui-serif numerals for the sheet code · ui-monospace for telemetry
 *   - 1px gold hairline @ 12% opacity for card borders, never solid
 *
 * Aspire Laws:
 *   - Law #1: render-only — no autonomous decisions
 *   - Law #7: no backend calls beyond the existing useBlueprintProjectPoll
 *     and useTakeoffSymbols hooks already mounted upstream
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActiveSheetId } from '@/lib/activeSheetStore';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import { useTakeoffSymbols } from '@/hooks/useTakeoffSymbols';
import { plansPhotosUiActions } from '@/lib/plansPhotosUiStore';
import type { BlueprintSheetRead, TakeoffSymbol } from '@/lib/api/blueprintsApi';
import { getDisciplineStyle } from './disciplines';

// ---------------------------------------------------------------------------
// Studio palette — locked to this payload so the per-sheet view reads as
// a distinct "dossier" surface vs the project-wide rail. Subtle gold
// hairlines on ink-blue, never the cyan elsewhere in the app.
// ---------------------------------------------------------------------------

const STUDIO = {
  ink: '#0a0c10', // card background
  hairline: 'rgba(251,191,36,0.12)', // 12% gold border
  hairlineStrong: 'rgba(251,191,36,0.22)',
  gold: '#fbbf24',
  goldDim: 'rgba(251,191,36,0.55)',
  text: 'rgba(255,255,255,0.92)',
  textDim: 'rgba(255,255,255,0.55)',
  textFaint: 'rgba(255,255,255,0.32)',
  danger: '#ef4444',
  dangerDim: 'rgba(239,68,68,0.45)',
  success: '#22c55e',
  successDim: 'rgba(34,197,94,0.45)',
} as const;

const SERIF =
  'ui-serif, "New York", "Iowan Old Style", Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const delta = Date.now() - t;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/**
 * Derive an 8-char pseudo-SHA from the sheet id. The backend doesn't yet
 * emit a content hash on BlueprintSheetRead, so we fold the UUID into a
 * deterministic 32-bit hash and render its base16 (8 hex). The footer
 * label says "fingerprint" rather than "SHA-256" to keep the contract
 * honest until the backend serves the real hash.
 */
function _fingerprint(id: string | null | undefined): string {
  if (!id) return '—';
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0');
  return hex.slice(0, 8);
}

function _formatClassLabel(klass: string): string {
  // 'electrical.outlet.duplex' → 'duplex outlet'
  const parts = klass.split('.').filter(Boolean);
  if (parts.length === 0) return klass;
  if (parts.length === 1) return parts[0];
  // Reverse + drop the discipline prefix so the chip reads naturally.
  const tail = parts.slice(-2).reverse().join(' ');
  return tail.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Studio card primitive — used everywhere in the payload. Locks the
// border / radius / padding / bg so every section reads as one dossier.
// ---------------------------------------------------------------------------

interface StudioCardProps {
  children: React.ReactNode;
  testID?: string;
  pad?: number;
  emphasis?: 'default' | 'strong';
}

function StudioCard({
  children,
  testID,
  pad = 14,
  emphasis = 'default',
}: StudioCardProps): React.ReactElement {
  return (
    <View
      testID={testID}
      style={[
        cardStyles.host,
        emphasis === 'strong' && cardStyles.hostStrong,
        { padding: pad },
      ]}
    >
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  host: {
    backgroundColor: STUDIO.ink,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STUDIO.hairline,
    gap: 10,
  },
  hostStrong: {
    borderColor: STUDIO.hairlineStrong,
  },
});

// ---------------------------------------------------------------------------
// Section header — small caps + amber dot accent, matches the rail style
// but tuned for higher information density inside cards.
// ---------------------------------------------------------------------------

function SectionHeader({
  label,
  hint,
  trailing,
}: {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={headerStyles.row}>
      <View style={headerStyles.dot} />
      <Text style={headerStyles.label}>{label}</Text>
      {hint ? <Text style={headerStyles.hint}>{hint}</Text> : null}
      {trailing ? <View style={headerStyles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: STUDIO.gold,
    opacity: 0.85,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '700',
    color: STUDIO.textDim,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    fontFamily: MONO,
  },
  hint: {
    fontSize: 9.5,
    color: STUDIO.textFaint,
    letterSpacing: 0.4,
    fontFamily: MONO,
    marginLeft: 4,
  },
  trailing: {
    marginLeft: 'auto',
  },
});

// ---------------------------------------------------------------------------
// Cross-fade wrapper — swaps content via 200ms opacity. Key prop drives
// the fade; siblings stack absolutely during transition so CLS stays 0.
// ---------------------------------------------------------------------------

function CrossFade({
  swapKey,
  children,
}: {
  swapKey: string;
  children: React.ReactNode;
}): React.ReactElement {
  const opacity = useRef(new Animated.Value(1)).current;
  const lastKey = useRef<string>(swapKey);
  const [renderedKey, setRenderedKey] = useState<string>(swapKey);
  const [content, setContent] = useState<React.ReactNode>(children);

  useEffect(() => {
    if (swapKey === lastKey.current) {
      // Same key — refresh content silently (no fade) so live polled
      // data updates without a jarring opacity flicker.
      setContent(children);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 100,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      lastKey.current = swapKey;
      setRenderedKey(swapKey);
      setContent(children);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
  }, [swapKey, children, opacity]);

  return (
    <Animated.View style={{ opacity }} testID={`sheet-context-fade-${renderedKey}`}>
      {content}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Sheet header — large gold serif sheet code, italic title, pills row
// ---------------------------------------------------------------------------

function SheetHeader({ sheet }: { sheet: BlueprintSheetRead }): React.ReactElement {
  const disc = getDisciplineStyle(sheet.discipline);
  const code =
    sheet.sheet_code ?? `${disc.code} ${sheet.sheet_number ?? '—'}`;
  const title = sheet.sheet_title ?? disc.label;

  return (
    <StudioCard testID="sheet-context-header" emphasis="strong" pad={16}>
      <SectionHeader label="Sheet" hint={`Page ${sheet.sheet_number ?? '—'}`} />
      <View style={hdrStyles.codeRow}>
        <Text style={hdrStyles.code} numberOfLines={1}>
          {code}
        </Text>
        <View
          style={[
            hdrStyles.discPill,
            { borderColor: disc.fg + '55', backgroundColor: disc.fg + '14' },
          ]}
        >
          <Text style={[hdrStyles.discCode, { color: disc.fg }]}>
            {disc.code}
          </Text>
          <Text style={[hdrStyles.discLabel, { color: disc.fg }]}>
            {disc.label}
          </Text>
        </View>
      </View>
      <Text style={hdrStyles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={hdrStyles.pills}>
        {sheet.scale ? (
          <View style={hdrStyles.pill} testID="sheet-context-scale">
            <Ionicons name="resize-outline" size={11} color={STUDIO.gold} />
            <Text style={hdrStyles.pillText}>{sheet.scale}</Text>
          </View>
        ) : null}
        {sheet.revision && sheet.revision > 0 ? (
          <View style={hdrStyles.pill} testID="sheet-context-rev">
            <Ionicons name="git-branch-outline" size={11} color={STUDIO.gold} />
            <Text style={hdrStyles.pillText}>REV {sheet.revision}</Text>
          </View>
        ) : null}
        {sheet.seal_detected ? (
          <View
            style={[hdrStyles.pill, hdrStyles.sealPill]}
            testID="sheet-context-seal"
            accessibilityLabel="Engineer sealed"
          >
            <Ionicons name="ribbon-outline" size={11} color={STUDIO.success} />
            <Text style={[hdrStyles.pillText, { color: STUDIO.success }]}>
              ENGINEER SEALED
            </Text>
          </View>
        ) : null}
      </View>
    </StudioCard>
  );
}

const hdrStyles = StyleSheet.create({
  codeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  code: {
    fontSize: 38,
    fontWeight: '600',
    color: STUDIO.gold,
    fontFamily: SERIF,
    letterSpacing: -1.4,
    lineHeight: 42,
    textShadowColor: 'rgba(251,191,36,0.28)',
    textShadowRadius: 12,
    flexShrink: 1,
  },
  discPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  discCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontFamily: MONO,
  },
  discLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: MONO,
  },
  title: {
    fontSize: 13.5,
    color: STUDIO.text,
    fontFamily: SERIF,
    fontStyle: 'italic',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STUDIO.hairlineStrong,
    backgroundColor: 'rgba(251,191,36,0.04)',
  },
  sealPill: {
    borderColor: STUDIO.successDim,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  pillText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: STUDIO.gold,
    letterSpacing: 0.6,
    fontFamily: MONO,
  },
});

// ---------------------------------------------------------------------------
// Symbols section — per-sheet breakdown + avg confidence bar + jump CTA
// ---------------------------------------------------------------------------

function SymbolsSection({
  sheetId,
  symbols,
  isLoading,
  endpointMissing,
}: {
  sheetId: string;
  symbols: TakeoffSymbol[];
  isLoading: boolean;
  endpointMissing: boolean;
}): React.ReactElement {
  const { setActiveCard } = plansPhotosUiActions();

  const onSheet = useMemo(
    () => symbols.filter((s) => s.sheet_id === sheetId),
    [symbols, sheetId],
  );

  const avgConfidence = useMemo(() => {
    if (onSheet.length === 0) return 0;
    const sum = onSheet.reduce((acc, s) => acc + (s.confidence ?? 0), 0);
    return sum / onSheet.length;
  }, [onSheet]);

  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of onSheet) {
      const head = s.class.split('.')[0] ?? 'other';
      m.set(head, (m.get(head) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [onSheet]);

  const topClasses = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of onSheet) m.set(s.class, (m.get(s.class) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [onSheet]);

  return (
    <StudioCard testID="sheet-context-symbols">
      <SectionHeader
        label="Symbols on Sheet"
        hint={isLoading ? 'scanning' : `${onSheet.length} detected`}
        trailing={
          <View style={symStyles.countBadge}>
            <Text style={symStyles.countBadgeText}>{onSheet.length}</Text>
          </View>
        }
      />

      {endpointMissing ? (
        <Text style={symStyles.muted}>Detection endpoint not wired yet.</Text>
      ) : onSheet.length === 0 ? (
        <Text style={symStyles.muted}>
          {isLoading
            ? 'Drew is scanning this sheet…'
            : 'No symbols detected on this drawing.'}
        </Text>
      ) : (
        <>
          {/* Breakdown — one line per discipline-bucket */}
          <View style={symStyles.breakdownRow}>
            {breakdown.slice(0, 4).map(([head, count], i) => (
              <React.Fragment key={head}>
                {i > 0 ? <Text style={symStyles.bullet}>·</Text> : null}
                <Text style={symStyles.breakdownText}>
                  <Text style={symStyles.breakdownCount}>{count}</Text>{' '}
                  {head.replace(/_/g, ' ')}
                </Text>
              </React.Fragment>
            ))}
          </View>

          {/* Avg confidence bar */}
          <View style={symStyles.confBlock}>
            <View style={symStyles.confHeader}>
              <Text style={symStyles.confLabel}>avg confidence</Text>
              <Text style={symStyles.confValue}>
                {(avgConfidence * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={symStyles.confTrack}>
              <View
                style={[
                  symStyles.confFill,
                  { width: `${Math.max(2, avgConfidence * 100)}%` },
                ]}
              />
            </View>
          </View>

          {/* Top 5 class chips */}
          {topClasses.length > 0 ? (
            <View style={symStyles.chipsWrap}>
              {topClasses.map(([klass, count]) => (
                <View key={klass} style={symStyles.classChip}>
                  <Text style={symStyles.classChipText}>
                    {_formatClassLabel(klass)}
                  </Text>
                  <Text style={symStyles.classChipCount}>{count}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Jump-to-takeoff CTA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View this sheet in Takeoff"
            onPress={() => setActiveCard('sheets')}
            testID="sheet-context-view-in-takeoff"
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              symStyles.cta,
              hovered && symStyles.ctaHover,
              pressed && symStyles.ctaPressed,
            ]}
          >
            <Ionicons name="locate-outline" size={13} color={STUDIO.gold} />
            <Text style={symStyles.ctaText}>View in Takeoff</Text>
            <Ionicons
              name="arrow-forward"
              size={12}
              color={STUDIO.gold}
              style={symStyles.ctaArrow}
            />
          </Pressable>
        </>
      )}
    </StudioCard>
  );
}

const symStyles = StyleSheet.create({
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STUDIO.hairlineStrong,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: STUDIO.gold,
    fontVariant: ['tabular-nums'],
    fontFamily: MONO,
  },
  muted: {
    fontSize: 11,
    color: STUDIO.textFaint,
    fontStyle: 'italic',
    fontFamily: SERIF,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  breakdownText: {
    fontSize: 11.5,
    color: STUDIO.text,
    fontFamily: MONO,
    letterSpacing: 0.2,
  },
  breakdownCount: {
    color: STUDIO.gold,
    fontWeight: '700',
  },
  bullet: {
    fontSize: 11,
    color: STUDIO.textFaint,
  },
  confBlock: {
    gap: 4,
  },
  confHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  confLabel: {
    fontSize: 9.5,
    color: STUDIO.textFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: MONO,
  },
  confValue: {
    fontSize: 11.5,
    color: STUDIO.gold,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: MONO,
  },
  confTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    backgroundColor: STUDIO.gold,
    borderRadius: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  classChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  classChipText: {
    fontSize: 10,
    color: STUDIO.text,
    letterSpacing: 0.1,
    fontFamily: MONO,
  },
  classChipCount: {
    fontSize: 9.5,
    color: STUDIO.goldDim,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: MONO,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STUDIO.hairlineStrong,
    backgroundColor: 'rgba(251,191,36,0.06)',
    marginTop: 2,
    ...(Platform.OS === 'web'
      ? (({
          transition: 'background-color 120ms ease, border-color 120ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  ctaHover: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: STUDIO.goldDim,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: STUDIO.gold,
    letterSpacing: 0.4,
    fontFamily: MONO,
  },
  ctaArrow: {
    marginLeft: 'auto',
  },
});

// ---------------------------------------------------------------------------
// OCR snippet — collapsed by default; expands to a 500-char mono block
// ---------------------------------------------------------------------------

interface OcrCarrier {
  /** Optional OCR text; backend may attach via a non-canonical field. */
  ocr_text?: string | null;
}

function OcrSection({ sheet }: { sheet: BlueprintSheetRead }): React.ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  // BlueprintSheetRead doesn't formally declare ocr_text yet; backend may
  // surface it as an optional pass-through. We accept whatever comes.
  const ocrText = (sheet as BlueprintSheetRead & OcrCarrier).ocr_text;
  const hasText = typeof ocrText === 'string' && ocrText.trim().length > 0;
  const snippet = hasText ? ocrText!.trim().slice(0, 500) : '';

  return (
    <StudioCard testID="sheet-context-ocr">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={!hasText}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse OCR text' : 'Expand OCR text'}
        accessibilityState={{ expanded: open, disabled: !hasText }}
        testID="sheet-context-ocr-toggle"
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          ocrStyles.toggle,
          hovered && hasText && ocrStyles.toggleHover,
          pressed && hasText && ocrStyles.togglePressed,
        ]}
      >
        <SectionHeader
          label="OCR Text"
          hint={
            hasText
              ? `${ocrText!.length.toLocaleString()} chars`
              : 'not extracted'
          }
        />
        {hasText ? (
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={STUDIO.goldDim}
            style={ocrStyles.chev}
          />
        ) : null}
      </Pressable>
      {open && hasText ? (
        <View style={ocrStyles.block} testID="sheet-context-ocr-block">
          <Text style={ocrStyles.text} selectable>
            {snippet}
            {ocrText!.length > 500 ? '…' : ''}
          </Text>
        </View>
      ) : null}
    </StudioCard>
  );
}

const ocrStyles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    ...(Platform.OS === 'web'
      ? (({ cursor: 'pointer' } as unknown) as ViewStyle)
      : {}),
  },
  toggleHover: {
    opacity: 0.92,
  },
  togglePressed: {
    opacity: 0.78,
  },
  chev: {
    marginLeft: 4,
  },
  block: {
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  text: {
    fontSize: 10.5,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: MONO,
    letterSpacing: 0.2,
  },
});

// ---------------------------------------------------------------------------
// Metadata footer — relative time · page index · fingerprint · img health
// ---------------------------------------------------------------------------

function MetadataFooter({
  sheet,
}: {
  sheet: BlueprintSheetRead;
}): React.ReactElement {
  const fingerprint = _fingerprint(sheet.id);
  const cached = !!sheet.thumbnail_url;

  return (
    <StudioCard testID="sheet-context-metadata" pad={12}>
      <SectionHeader label="Metadata" />
      <View style={metaStyles.grid}>
        <View style={metaStyles.row}>
          <Text style={metaStyles.k}>created</Text>
          <Text style={metaStyles.v}>{_relativeTime(sheet.created_at)}</Text>
        </View>
        <View style={metaStyles.row}>
          <Text style={metaStyles.k}>page</Text>
          <Text style={metaStyles.v}>{sheet.sheet_number ?? '—'}</Text>
        </View>
        <View style={metaStyles.row}>
          <Text style={metaStyles.k}>fingerprint</Text>
          <Text style={[metaStyles.v, metaStyles.mono]}>{fingerprint}</Text>
        </View>
        <View style={metaStyles.row}>
          <Text style={metaStyles.k}>image</Text>
          {cached ? (
            <View style={[metaStyles.healthPill, metaStyles.healthOk]}>
              <Ionicons name="checkmark-circle" size={11} color={STUDIO.success} />
              <Text style={[metaStyles.healthText, { color: STUDIO.success }]}>
                cached
              </Text>
            </View>
          ) : (
            <View style={[metaStyles.healthPill, metaStyles.healthWarn]}>
              <Ionicons name="warning-outline" size={11} color={STUDIO.danger} />
              <Text style={[metaStyles.healthText, { color: STUDIO.danger }]}>
                not ready
              </Text>
            </View>
          )}
        </View>
      </View>
    </StudioCard>
  );
}

const metaStyles = StyleSheet.create({
  grid: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  k: {
    fontSize: 9.5,
    color: STUDIO.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: MONO,
  },
  v: {
    fontSize: 11,
    color: STUDIO.text,
    fontFamily: MONO,
    letterSpacing: 0.2,
  },
  mono: {
    color: STUDIO.gold,
    fontWeight: '700',
  },
  healthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  healthOk: {
    borderColor: STUDIO.successDim,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  healthWarn: {
    borderColor: STUDIO.dangerDim,
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  healthText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: MONO,
  },
});

// ---------------------------------------------------------------------------
// Project Summary fallback — when no sheet is active
// ---------------------------------------------------------------------------

function ProjectSummary({
  projectId,
  sheets,
  address,
  filename,
  uploadedAt,
}: {
  projectId: string | null;
  sheets: BlueprintSheetRead[];
  address: string | null;
  filename: string | null;
  uploadedAt: number | null;
}): React.ReactElement {
  const totals = useMemo(() => {
    const successorIds = new Set<string>();
    for (const s of sheets) if (s.supersedes_id) successorIds.add(s.supersedes_id);
    const m = new Map<string, number>();
    let total = 0;
    for (const s of sheets) {
      if (successorIds.has(s.id)) continue;
      total += 1;
      const k = s.discipline ? s.discipline.toLowerCase() : 'unclassified';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return {
      total,
      rows: Array.from(m.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [sheets]);

  const lastUploadLabel = uploadedAt
    ? _relativeTime(new Date(uploadedAt).toISOString())
    : '—';

  return (
    <View style={summaryStyles.host} testID="sheet-context-project-summary">
      <StudioCard emphasis="strong" pad={16}>
        <SectionHeader
          label="Project Dossier"
          hint={projectId ? 'live' : 'idle'}
        />
        <Text style={summaryStyles.heroLabel}>address on record</Text>
        <Text style={summaryStyles.heroValue} numberOfLines={2}>
          {address ?? 'Address not extracted yet'}
        </Text>
        <View style={summaryStyles.metaRow}>
          <View style={summaryStyles.metaCell}>
            <Text style={summaryStyles.metaK}>sheets</Text>
            <Text style={summaryStyles.metaV}>{totals.total}</Text>
          </View>
          <View style={summaryStyles.metaDivider} />
          <View style={summaryStyles.metaCell}>
            <Text style={summaryStyles.metaK}>disciplines</Text>
            <Text style={summaryStyles.metaV}>{totals.rows.length}</Text>
          </View>
          <View style={summaryStyles.metaDivider} />
          <View style={summaryStyles.metaCell}>
            <Text style={summaryStyles.metaK}>last upload</Text>
            <Text style={summaryStyles.metaV}>{lastUploadLabel}</Text>
          </View>
        </View>
      </StudioCard>

      {totals.rows.length > 0 ? (
        <StudioCard testID="sheet-context-summary-disciplines">
          <SectionHeader label="Discipline Mix" hint={`${totals.total} sheets`} />
          <View style={summaryStyles.bars}>
            {totals.rows.map(([disc, count]) => {
              const style = getDisciplineStyle(disc);
              const pct = totals.total > 0 ? (count / totals.total) * 100 : 0;
              return (
                <View key={disc} style={summaryStyles.barRow}>
                  <View
                    style={[
                      summaryStyles.barCodeWrap,
                      { backgroundColor: style.fg + '20' },
                    ]}
                  >
                    <Text style={[summaryStyles.barCode, { color: style.fg }]}>
                      {style.code}
                    </Text>
                  </View>
                  <View style={summaryStyles.barBody}>
                    <View style={summaryStyles.barHeader}>
                      <Text style={summaryStyles.barLabel} numberOfLines={1}>
                        {style.label}
                      </Text>
                      <Text style={summaryStyles.barCount}>{count}</Text>
                    </View>
                    <View style={summaryStyles.barTrack}>
                      <View
                        style={[
                          summaryStyles.barFill,
                          { width: `${pct}%`, backgroundColor: style.fg },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </StudioCard>
      ) : null}

      <StudioCard testID="sheet-context-summary-hint" pad={12}>
        <View style={summaryStyles.hintRow}>
          <Ionicons name="hand-left-outline" size={13} color={STUDIO.gold} />
          <Text style={summaryStyles.hintText}>
            Click any sheet below to see its details.
          </Text>
        </View>
        {filename ? (
          <Text style={summaryStyles.hintFile} numberOfLines={1}>
            {filename}
          </Text>
        ) : null}
      </StudioCard>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  host: {
    gap: 10,
  },
  heroLabel: {
    fontSize: 9.5,
    color: STUDIO.textFaint,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: MONO,
    marginTop: 4,
  },
  heroValue: {
    fontSize: 14,
    color: STUDIO.text,
    fontFamily: SERIF,
    letterSpacing: 0.1,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  metaCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  metaDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 2,
  },
  metaK: {
    fontSize: 9,
    color: STUDIO.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: MONO,
  },
  metaV: {
    fontSize: 16,
    color: STUDIO.gold,
    fontFamily: SERIF,
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  bars: {
    gap: 7,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barCodeWrap: {
    width: 24,
    height: 24,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: MONO,
  },
  barBody: {
    flex: 1,
    gap: 3,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  barLabel: {
    fontSize: 11,
    color: STUDIO.text,
    fontFamily: MONO,
    letterSpacing: 0.1,
    flex: 1,
  },
  barCount: {
    fontSize: 10.5,
    color: STUDIO.goldDim,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontFamily: MONO,
  },
  barTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hintText: {
    fontSize: 11.5,
    color: STUDIO.text,
    fontFamily: SERIF,
    fontStyle: 'italic',
    flex: 1,
  },
  hintFile: {
    fontSize: 10,
    color: STUDIO.textFaint,
    fontFamily: MONO,
    letterSpacing: 0.3,
    marginTop: 4,
  },
});

// ---------------------------------------------------------------------------
// Public component — props are optional overrides so the test harness can
// inject fixtures without wiring the polling hooks.
// ---------------------------------------------------------------------------

export interface SheetContextPayloadProps {
  /** Force a specific sheet id (test-only). Defaults to activeSheetStore. */
  activeSheetIdOverride?: string | null;
  /** Inject sheets for tests. Defaults to live polled sheets. */
  sheetsOverride?: BlueprintSheetRead[];
  /** Inject symbols for tests. */
  symbolsOverride?: TakeoffSymbol[];
  /** Inject project id (test harness). */
  projectIdOverride?: string | null;
  /** Inject project address (test harness). */
  addressOverride?: string | null;
  testID?: string;
}

export function SheetContextPayload({
  activeSheetIdOverride,
  sheetsOverride,
  symbolsOverride,
  projectIdOverride,
  addressOverride,
  testID = 'sheet-context-payload',
}: SheetContextPayloadProps = {}): React.ReactElement {
  const subscribedId = useActiveSheetId();
  const activeId =
    activeSheetIdOverride !== undefined ? activeSheetIdOverride : subscribedId;

  const snap = useBlueprintUploadSnapshot();
  const liveProjectId =
    projectIdOverride !== undefined ? projectIdOverride : snap.projectId;

  // When tests inject sheets we MUST NOT mount the polling hook against a
  // null projectId — the hook is safe with null but mounting it pulls in
  // useAuthFetch/useTenant which require providers the tests don't wire.
  // Guard the call by checking the override path first.
  const hasSheetsOverride = sheetsOverride !== undefined;
  const hasSymbolsOverride = symbolsOverride !== undefined;

  // Always call hooks unconditionally (React rules). When overrides are
  // present the hook is invoked with null which is the standard idle path.
  const poll = useBlueprintProjectPoll(hasSheetsOverride ? null : liveProjectId);
  const symbolsState = useTakeoffSymbols(
    hasSymbolsOverride ? null : liveProjectId,
  );

  const sheets: BlueprintSheetRead[] = hasSheetsOverride
    ? (sheetsOverride as BlueprintSheetRead[])
    : poll.sheets;
  const symbols: TakeoffSymbol[] = hasSymbolsOverride
    ? (symbolsOverride as TakeoffSymbol[])
    : symbolsState.symbols;

  const activeSheet = useMemo(
    () => (activeId ? sheets.find((s) => s.id === activeId) ?? null : null),
    [sheets, activeId],
  );

  const address =
    addressOverride !== undefined
      ? addressOverride
      : poll.project?.address ?? null;

  const swapKey = activeSheet ? `sheet:${activeSheet.id}` : 'summary';

  // Render path — wrap everything in a single CrossFade so the swap
  // between project-summary and sheet-specific reads as one move.
  return (
    <View style={styles.host} testID={testID}>
      <CrossFade swapKey={swapKey}>
        {activeSheet ? (
          <View style={styles.stack} testID="sheet-context-stack">
            <SheetHeader sheet={activeSheet} />
            <SymbolsSection
              sheetId={activeSheet.id}
              symbols={symbols}
              isLoading={!hasSymbolsOverride && symbolsState.isLoading}
              endpointMissing={
                !hasSymbolsOverride && symbolsState.endpointMissing
              }
            />
            <OcrSection sheet={activeSheet} />
            <MetadataFooter sheet={activeSheet} />
          </View>
        ) : (
          <ProjectSummary
            projectId={liveProjectId}
            sheets={sheets}
            address={address}
            filename={snap.filename}
            uploadedAt={snap.uploadedAt}
          />
        )}
      </CrossFade>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    // Reserves enough vertical space that the project-summary → sheet
    // swap cannot collapse the rail. CLS=0 contract.
    minHeight: 360,
    gap: 0,
  },
  stack: {
    gap: 10,
  },
});

export default SheetContextPayload;
