/**
 * BidSummaryCanvas — Wave 15.
 *
 * The end-of-the-arc proposal. A Stripe-grade, print-ready bid that the
 * contractor sends to the client. Full-canvas, A4/letter aspect ratio,
 * trade-grouped line items, money stack with the TOTAL set in big gold
 * tabular numerals.
 *
 * Design intent: the contractor walked in with a messy plan set 90 seconds
 * ago — they walk out with this. The card is intentionally restrained:
 * generous whitespace, hairline rules, one accent color (Aspire amber on
 * the total). No buttons live on the proposal surface itself — actions
 * route through Export & Send.
 *
 * Aspire Laws:
 *   - Law #7: pure render. Numbers come from bidMath.ts; the canvas does
 *     not invent any data.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
} from '@/lib/api/blueprintsApi';
import {
  buildLineItems,
  computeBidHealth,
  computeMoneyStack,
  formatUsd,
  formatUsdCents,
  TRADE_DISPLAY,
  type BidLineItem,
  type Trade,
} from '@/lib/estimate/bidMath';
import { useEstimateUi } from '@/lib/estimateUiStore';
import { TruthBadge } from '../scope/TruthBadge';

interface Props {
  /** Project address line. */
  address: string | null;
  /** Client display name (optional — defaults to "Prepared for client"). */
  clientName?: string | null;
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
  /** Bid number for the proposal header. */
  bidNumber?: string;
  /** ISO bid date. */
  bidDate?: string;
}

const SERIF = Platform.select({
  // Editorial pairing: Aspire's amber accents read like a magazine masthead
  // when carried by a serif. Falls back gracefully on iOS/Android.
  web: '"Cormorant Garamond", "Source Serif Pro", Georgia, "Times New Roman", serif',
  default: 'Georgia',
});

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
  default: 'Menlo',
});

const BODY_SANS = Platform.select({
  // A refined humanist sans for body text. Avoids the Inter/Roboto AI look.
  web: '"Söhne", "Inter Tight", "Helvetica Neue", system-ui, -apple-system, sans-serif',
  default: 'System',
});

export function BidSummaryCanvas({
  address,
  clientName,
  materials,
  assemblies,
  bidNumber,
  bidDate,
}: Props): React.ReactElement {
  const ui = useEstimateUi();

  const built = useMemo(
    () =>
      buildLineItems({
        materials,
        assemblies,
        baseScopeOnly: true,
        qtyOverrides: ui.qtyOverrides,
        priceOverrides: ui.priceOverrides,
        hiddenLineItemIds: ui.hiddenLineItemIds,
      }),
    [materials, assemblies, ui.qtyOverrides, ui.priceOverrides, ui.hiddenLineItemIds],
  );

  const money = useMemo(
    () =>
      computeMoneyStack({
        lines: built.all,
        markup: ui.markup,
        perMaterialAbsorb: ui.perMaterialAbsorb,
      }),
    [built.all, ui.markup, ui.perMaterialAbsorb],
  );

  const health = useMemo(() => computeBidHealth(built.all), [built.all]);

  const dateStr = useMemo(() => {
    const iso = bidDate ?? new Date().toISOString();
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  }, [bidDate]);

  const bidNo = useMemo(() => {
    if (bidNumber) return bidNumber;
    // Deterministic-feeling synthetic — uses today's date + a 4-char tail.
    const d = new Date();
    return `B-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
      d.getDate(),
    ).padStart(2, '0')}-${Math.abs((address ?? '').length * 31 + built.all.length * 7)
      .toString(36)
      .toUpperCase()
      .slice(0, 4)
      .padEnd(4, 'X')}`;
  }, [bidNumber, address, built.all.length]);

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="bid-summary-canvas"
    >
      {/* The "paper" — printable proposal at letter-ish aspect. */}
      <View style={styles.paper}>
        {/* ============== Draft watermark ============== */}
        <View style={styles.watermark} pointerEvents="none">
          <Text style={styles.watermarkText}>DRAFT</Text>
        </View>

        {/* ============== Header ============== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.brandRow}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>ASPIRE · PROPOSAL</Text>
            </View>
            <Text style={styles.title}>Construction Proposal</Text>
            <Text style={styles.subtitle}>
              Prepared for {clientName?.trim() || 'the property owner'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Bid no.</Text>
              <Text style={styles.metaValue}>{bidNo}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{dateStr}</Text>
            </View>
            <View style={[styles.metaRow, styles.healthRow]}>
              <Text style={styles.metaLabel}>Bid health</Text>
              <View style={styles.healthBadge}>
                <View
                  style={[
                    styles.healthDot,
                    health.level === 'green' && styles.healthDotGreen,
                    health.level === 'yellow' && styles.healthDotYellow,
                    health.level === 'red' && styles.healthDotRed,
                  ]}
                />
                <Text style={styles.healthText}>
                  {health.level === 'green'
                    ? 'Ship-ready'
                    : health.level === 'yellow'
                      ? 'Review'
                      : 'Blocked'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ============== Address ============== */}
        <View style={styles.addressBlock}>
          <Text style={styles.addressLabel}>JOB SITE</Text>
          <Text style={styles.addressValue}>
            {address?.trim() || 'Address pending — confirm in Visuals tab'}
          </Text>
        </View>

        {/* ============== Hairline ============== */}
        <View style={styles.hairline} />

        {/* ============== Body — trade sections ============== */}
        <View style={styles.tradesBlock}>
          {built.byTrade.length === 0 ? (
            <View style={styles.emptyHost}>
              <Ionicons
                name="document-text-outline"
                size={28}
                color="rgba(255,255,255,0.30)"
              />
              <Text style={styles.emptyTitle}>No scope yet</Text>
              <Text style={styles.emptyBody}>
                Once Drew finishes REASON and PROCURE, your bid lines populate
                here automatically.
              </Text>
            </View>
          ) : (
            built.byTrade.map((group) => (
              <TradeSection key={group.trade} trade={group.trade} lines={group.lines} />
            ))
          )}
        </View>

        {/* ============== Money stack ============== */}
        <View style={styles.hairlineStrong} />
        <View style={styles.moneyStack}>
          <MoneyRow label="Subtotal" value={formatUsd(money.subtotal)} />
          <MoneyRow
            label={`Labor markup · ${ui.markup.laborPct}%`}
            value={formatUsd(money.laborMarkup)}
            sublabel={`on ${formatUsd(money.laborSubtotal)} labor`}
          />
          <MoneyRow
            label={`Materials markup · ${ui.markup.materialsPct}%`}
            value={formatUsd(money.materialsMarkup)}
            sublabel={`on ${formatUsd(money.materialsSubtotal)} materials`}
          />
          {money.tariffPassThrough > 0 ? (
            <MoneyRow
              label="Tariff pass-through"
              value={formatUsd(money.tariffPassThrough)}
              sublabel="Section 232 / softwood lumber"
              accent
            />
          ) : null}
          <MoneyRow
            label={`Contingency · ${ui.markup.contingencyPct}%`}
            value={formatUsd(money.contingency)}
          />
          {money.rfqNeededCount > 0 ? (
            <View style={styles.rfqBanner}>
              <Ionicons name="alert-circle" size={13} color="#fb923c" />
              <Text style={styles.rfqBannerText}>
                {money.rfqNeededCount} line item{money.rfqNeededCount === 1 ? '' : 's'} pending
                supplier quote — excluded from subtotal
              </Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatUsd(money.total)}</Text>
          </View>
        </View>

        {/* ============== Footer ============== */}
        <View style={styles.hairline} />
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This proposal is valid for 30 days from the issue date. Final pricing
            subject to supplier confirmation on any line item marked{' '}
            <Text style={styles.footerEm}>RFQ needed</Text>. Tariff exposure
            reflects current Section 232 and softwood lumber duty schedules.
          </Text>
          <Text style={styles.footerSig}>
            — Prepared by Aspire on behalf of the contractor of record.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Trade section
// ---------------------------------------------------------------------------

interface TradeSectionProps {
  trade: Trade;
  lines: Array<BidLineItem & { hidden: boolean }>;
}

function TradeSection({ trade, lines }: TradeSectionProps): React.ReactElement {
  const subtotal = lines.reduce<number>((sum, l) => {
    if (l.hidden || l.lineTotal == null) return sum;
    return sum + l.lineTotal;
  }, 0);
  const display = TRADE_DISPLAY[trade];

  return (
    <View style={styles.tradeSection} testID={`trade-section-${trade}`}>
      <View style={styles.tradeHeader}>
        <View style={styles.tradeIndex}>
          <Text style={styles.tradeIndexText}>
            {String(display.order).padStart(2, '0')}
          </Text>
        </View>
        <Text style={styles.tradeLabel}>{display.label}</Text>
        <View style={styles.tradeRule} />
        <Text style={styles.tradeSubtotal}>{formatUsd(subtotal)}</Text>
      </View>

      {lines.map((line) => (
        <View
          key={line.id}
          style={[styles.lineRow, line.hidden && styles.lineRowHidden]}
        >
          <View style={styles.lineMain}>
            <Text
              style={[styles.lineDesc, line.hidden && styles.lineStrike]}
              numberOfLines={2}
            >
              {line.description}
            </Text>
            <View style={styles.lineMetaRow}>
              <Text style={styles.lineMeta}>
                {line.quantity.toLocaleString('en-US')} {line.unit}
              </Text>
              <Text style={styles.lineMetaDim}>·</Text>
              <Text style={styles.lineMeta}>
                {line.unitPrice != null ? formatUsdCents(line.unitPrice) : 'RFQ'}
                {line.unitPrice != null ? '/' + line.unit : ''}
              </Text>
              <TruthBadge truth={line.truth} confidence={undefined} size="sm" />
              {line.tariffFlagged ? (
                <View style={styles.tariffPill}>
                  <Ionicons name="pricetag" size={9} color="#fb923c" />
                  <Text style={styles.tariffPillText}>
                    {line.tariffNote ?? 'Tariff exposure'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={[styles.lineTotal, line.hidden && styles.lineStrike]}>
            {line.lineTotal != null ? formatUsd(line.lineTotal) : 'RFQ'}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Money row
// ---------------------------------------------------------------------------

interface MoneyRowProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}

function MoneyRow({ label, value, sublabel, accent }: MoneyRowProps): React.ReactElement {
  return (
    <View style={styles.moneyRow}>
      <View style={styles.moneyLabelCol}>
        <Text style={[styles.moneyLabel, accent && styles.moneyLabelAccent]}>{label}</Text>
        {sublabel ? <Text style={styles.moneySublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={[styles.moneyValue, accent && styles.moneyValueAccent]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    alignItems: 'center',
  },
  // The "paper" — letter-ish proportions, deeply-set on a dark stage so it
  // reads as a tangible object. NOT a card. The contractor should feel like
  // they're looking at the printed bid.
  paper: {
    width: '100%',
    maxWidth: 920,
    backgroundColor: '#0e1014',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    paddingHorizontal: 48,
    paddingVertical: 44,
    gap: 28,
    position: 'relative',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(255,255,255,0.04)',
        } as any)
      : {}),
  },
  // ============== Watermark ==============
  watermark: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.04,
    transform: [{ rotate: '-22deg' }],
  },
  watermarkText: {
    fontFamily: SERIF,
    fontSize: 180,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: 12,
  },
  // ============== Header ==============
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    flexWrap: 'wrap',
  },
  headerLeft: {
    flex: 1,
    minWidth: 280,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fbbf24',
  },
  brandText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: '#fbbf24',
  },
  title: {
    fontFamily: SERIF,
    fontSize: 38,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.97)',
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  subtitle: {
    fontFamily: BODY_SANS,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.1,
  },
  headerRight: {
    minWidth: 220,
    gap: 6,
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaLabel: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    fontVariant: ['tabular-nums'],
  },
  healthRow: {
    marginTop: 4,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  healthDotGreen: { backgroundColor: '#4ade80' },
  healthDotYellow: { backgroundColor: '#fbbf24' },
  healthDotRed: { backgroundColor: '#fb7185' },
  healthText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // ============== Address ==============
  addressBlock: {
    gap: 6,
  },
  addressLabel: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.6,
  },
  addressValue: {
    fontFamily: SERIF,
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.3,
    fontStyle: 'italic',
  },
  // ============== Hairlines ==============
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  hairlineStrong: {
    height: 1,
    backgroundColor: 'rgba(251,191,36,0.30)',
  },
  // ============== Trade sections ==============
  tradesBlock: {
    gap: 32,
  },
  tradeSection: {
    gap: 14,
  },
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  tradeIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeIndexText: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  tradeLabel: {
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.2,
  },
  tradeRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
  },
  tradeSubtotal: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 6,
  },
  lineRowHidden: {
    opacity: 0.4,
  },
  lineMain: {
    flex: 1,
    gap: 4,
  },
  lineDesc: {
    fontFamily: BODY_SANS,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.92)',
    lineHeight: 19,
    letterSpacing: -0.05,
  },
  lineStrike: {
    textDecorationLine: 'line-through',
  },
  lineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  lineMeta: {
    fontFamily: MONO,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },
  lineMetaDim: {
    fontFamily: MONO,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.30)',
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
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  lineTotal: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
    minWidth: 90,
    textAlign: 'right',
  },
  // ============== Empty state ==============
  emptyHost: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
  },
  emptyTitle: {
    fontFamily: SERIF,
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    color: 'rgba(255,255,255,0.50)',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 17,
  },
  // ============== Money stack ==============
  moneyStack: {
    gap: 10,
    paddingTop: 10,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  moneyLabelCol: {
    flex: 1,
    gap: 2,
  },
  moneyLabel: {
    fontFamily: BODY_SANS,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },
  moneyLabelAccent: {
    color: '#fb923c',
    fontWeight: '600',
  },
  moneySublabel: {
    fontFamily: MONO,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.3,
  },
  moneyValue: {
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
    minWidth: 110,
    textAlign: 'right',
  },
  moneyValueAccent: {
    color: '#fb923c',
  },
  rfqBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(251,146,60,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.22)',
    marginTop: 4,
  },
  rfqBannerText: {
    flex: 1,
    fontFamily: BODY_SANS,
    fontSize: 11,
    color: 'rgba(251,146,60,0.92)',
    letterSpacing: -0.05,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: 18,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(251,191,36,0.30)',
  },
  totalLabel: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 3,
  },
  totalValue: {
    fontFamily: SERIF,
    fontSize: 44,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  // ============== Footer ==============
  footer: {
    gap: 8,
  },
  footerText: {
    fontFamily: BODY_SANS,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.50)',
    lineHeight: 15,
    letterSpacing: 0.05,
  },
  footerEm: {
    fontStyle: 'italic',
    color: 'rgba(251,146,60,0.85)',
  },
  footerSig: {
    fontFamily: SERIF,
    fontSize: 11,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
});
