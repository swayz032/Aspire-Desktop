/**
 * ExportSendCanvas — Wave 15.
 *
 * Final dispatch surface. Lives at the very end of the contractor's arc:
 * the bid is composed, markups are dialed, tariffs reviewed, and now it
 * needs to leave the building. Four send paths (PandaDoc / Stripe Bill /
 * PDF download / email), a recipient picker, a cover note textarea, and a
 * 5-item pre-send review checklist that doubles as the final ship gate.
 *
 * Aspire Laws:
 *   - Law #2: every real send produces a receipt. v1 stubs the actions with
 *     console.info; the receipt write lands when the dispatcher is wired.
 *   - Law #4: PandaDoc / Stripe Bill / Email are YELLOW tier. v1 is stub
 *     only — the real handlers must route through the orchestrator.
 *   - Law #7: pure render layer.
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
  computeBidHealth,
  computeMoneyStack,
  formatUsd,
} from '@/lib/estimate/bidMath';
import { useEstimateUi } from '@/lib/estimateUiStore';

interface Props {
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
  address: string | null;
  clientName?: string | null;
}

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
  default: 'Menlo',
});
const SERIF = Platform.select({
  web: '"Cormorant Garamond", "Source Serif Pro", Georgia, serif',
  default: 'Georgia',
});
const BODY_SANS = Platform.select({
  web: '"Söhne", "Inter Tight", "Helvetica Neue", system-ui, sans-serif',
  default: 'System',
});

interface SendOption {
  key: 'pandadoc' | 'stripe' | 'pdf' | 'email';
  label: string;
  hint: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tier: 'GREEN' | 'YELLOW';
}

const SEND_OPTIONS: SendOption[] = [
  {
    key: 'pandadoc',
    label: 'Send via PandaDoc',
    hint: 'E-sign workflow, audit trail',
    icon: 'document-text-outline',
    tier: 'YELLOW',
  },
  {
    key: 'stripe',
    label: 'Create Stripe Bill',
    hint: 'Draft invoice, no charge',
    icon: 'card-outline',
    tier: 'YELLOW',
  },
  {
    key: 'pdf',
    label: 'Download PDF',
    hint: 'HTML preview · printable',
    icon: 'download-outline',
    tier: 'GREEN',
  },
  {
    key: 'email',
    label: 'Email to client',
    hint: 'Plain attachment',
    icon: 'mail-outline',
    tier: 'YELLOW',
  },
];

export function ExportSendCanvas({
  materials,
  assemblies,
  address,
  clientName,
}: Props): React.ReactElement {
  const ui = useEstimateUi();
  const [recipient, setRecipient] = useState<string>('');
  const [coverNote, setCoverNote] = useState<string>('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});

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

  // Five-item pre-send checklist.
  const checklistItems: Array<{ key: string; label: string; auto: boolean }> = [
    {
      key: 'all_lines_truth',
      label: 'Every active line item has a truth chip',
      auto: built.all.every((l) => l.hidden || !!l.truth),
    },
    {
      key: 'no_missing',
      label: 'No ship-blocker (missing) line items',
      auto: health.missingCount === 0,
    },
    {
      key: 'no_rfq',
      label: 'No "RFQ needed" lines without a supplier quote',
      auto: money.rfqNeededCount === 0,
    },
    {
      key: 'address',
      label: 'Job site address is set',
      auto: !!address && address.trim().length > 5,
    },
    {
      key: 'reviewed',
      label: 'I reviewed the markups and tariff handling',
      auto: false,
    },
  ];

  const allChecked = checklistItems.every((item) => item.auto || checks[item.key]);

  const doSend = (option: SendOption): void => {
    if (!allChecked && option.tier === 'YELLOW') {
      console.info('[estimate] send blocked — review checklist incomplete', option.key);
      return;
    }
    console.info('[estimate] dispatch (stub)', {
      action: option.key,
      tier: option.tier,
      total: money.total,
      recipient,
      coverNoteLength: coverNote.length,
    });
  };

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="export-send-canvas"
    >
      {/* ============== Headline ============== */}
      <View style={styles.headline}>
        <View style={styles.headlineLeft}>
          <Text style={styles.headlineLabel}>Ready to send</Text>
          <Text style={styles.headlineTotal}>{formatUsd(money.total)}</Text>
          <Text style={styles.headlineNote}>
            {clientName?.trim() || 'Client TBD'} ·{' '}
            {address?.trim() || 'address pending'}
          </Text>
        </View>
        <View
          style={[
            styles.healthBadge,
            health.level === 'green' && styles.healthBadgeGreen,
            health.level === 'yellow' && styles.healthBadgeYellow,
            health.level === 'red' && styles.healthBadgeRed,
          ]}
        >
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
                ? 'Review recommended'
                : 'Blocked'}
          </Text>
        </View>
      </View>

      {/* ============== Two-column layout ============== */}
      <View style={styles.row}>
        {/* ============== Recipient + cover note ============== */}
        <View style={styles.col}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recipient</Text>
            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              placeholder="client@example.com"
              placeholderTextColor="rgba(255,255,255,0.30)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              testID="export-recipient"
            />
            <Text style={styles.inputHint}>
              The primary contact who will receive the proposal.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cover note</Text>
            <TextInput
              value={coverNote}
              onChangeText={setCoverNote}
              placeholder="Optional — a short personal note that goes above the proposal."
              placeholderTextColor="rgba(255,255,255,0.30)"
              multiline
              numberOfLines={4}
              style={[styles.input, styles.textArea]}
              testID="export-cover-note"
            />
          </View>
        </View>

        {/* ============== Pre-send checklist ============== */}
        <View style={styles.col}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pre-send review</Text>
            <View style={styles.checklist}>
              {checklistItems.map((item) => {
                const isChecked = item.auto || !!checks[item.key];
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => {
                      if (item.auto) return;
                      setChecks((p) => ({ ...p, [item.key]: !p[item.key] }));
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked, disabled: item.auto }}
                    accessibilityLabel={item.label}
                    style={({ hovered, pressed }: any) => [
                      styles.checkRow,
                      hovered && !item.auto && styles.checkRowHover,
                      pressed && styles.checkRowPressed,
                    ]}
                    disabled={item.auto && isChecked}
                    testID={`export-check-${item.key}`}
                  >
                    <View
                      style={[
                        styles.checkBox,
                        isChecked && styles.checkBoxOn,
                        item.auto && styles.checkBoxAuto,
                      ]}
                    >
                      {isChecked ? (
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={item.auto ? '#4ade80' : '#0b1220'}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.checkLabel,
                        isChecked && styles.checkLabelOn,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.auto ? (
                      <Text style={styles.checkAuto}>auto</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {!allChecked ? (
              <View style={styles.checkWarn}>
                <Ionicons
                  name="alert-circle-outline"
                  size={13}
                  color="#fb923c"
                />
                <Text style={styles.checkWarnText}>
                  Complete the checklist before sending via PandaDoc, Stripe, or
                  email. PDF preview is always available.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* ============== Action grid ============== */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Send</Text>
        <View style={styles.actionGrid}>
          {SEND_OPTIONS.map((option) => {
            const blocked = !allChecked && option.tier === 'YELLOW';
            return (
              <Pressable
                key={option.key}
                onPress={() => doSend(option)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ disabled: blocked }}
                style={({ hovered, pressed }: any) => [
                  styles.actionCard,
                  blocked && styles.actionCardBlocked,
                  hovered && !blocked && styles.actionCardHover,
                  pressed && !blocked && styles.actionCardPressed,
                ]}
                testID={`export-action-${option.key}`}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={option.icon} size={20} color="#fbbf24" />
                </View>
                <View style={styles.actionBody}>
                  <View style={styles.actionTitleRow}>
                    <Text style={styles.actionLabel}>{option.label}</Text>
                    <View
                      style={[
                        styles.tierPill,
                        option.tier === 'GREEN' && styles.tierPillGreen,
                        option.tier === 'YELLOW' && styles.tierPillYellow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tierPillText,
                          option.tier === 'GREEN' && styles.tierPillTextGreen,
                          option.tier === 'YELLOW' && styles.tierPillTextYellow,
                        ]}
                      >
                        {option.tier}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.actionHint}>{option.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  scroll: { padding: 20, gap: 18 },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    gap: 18,
    flexWrap: 'wrap',
  },
  headlineLeft: { flex: 1, minWidth: 240, gap: 4 },
  headlineLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  headlineTotal: {
    fontFamily: SERIF,
    fontSize: 36,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  headlineNote: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  healthBadgeGreen: {
    backgroundColor: 'rgba(74,222,128,0.06)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  healthBadgeYellow: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderColor: 'rgba(251,191,36,0.35)',
  },
  healthBadgeRed: {
    backgroundColor: 'rgba(251,113,133,0.06)',
    borderColor: 'rgba(251,113,133,0.35)',
  },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthDotGreen: { backgroundColor: '#4ade80' },
  healthDotYellow: { backgroundColor: '#fbbf24' },
  healthDotRed: { backgroundColor: '#fb7185' },
  healthText: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  col: { flex: 1, minWidth: 280, gap: 14 },
  section: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  sectionTitle: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: BODY_SANS,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  textArea: { minHeight: 90, paddingTop: 10 },
  inputHint: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.2,
  },
  checklist: { gap: 6 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 5,
  },
  checkRowHover: { backgroundColor: 'rgba(255,255,255,0.04)' },
  checkRowPressed: { opacity: 0.85 },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: '#fbbf24', borderColor: '#fbbf24' },
  checkBoxAuto: { backgroundColor: 'rgba(74,222,128,0.10)', borderColor: 'rgba(74,222,128,0.55)' },
  checkLabel: {
    flex: 1,
    fontFamily: BODY_SANS,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 16,
  },
  checkLabelOn: { color: 'rgba(255,255,255,0.92)' },
  checkAuto: {
    fontFamily: MONO,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(74,222,128,0.85)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  checkWarn: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    backgroundColor: 'rgba(251,146,60,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.30)',
    marginTop: 4,
  },
  checkWarnText: {
    flex: 1,
    fontFamily: BODY_SANS,
    fontSize: 10.5,
    color: 'rgba(251,146,60,0.92)',
    lineHeight: 14,
    letterSpacing: -0.05,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexBasis: 240,
    flexGrow: 1,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 160ms ease, border-color 160ms ease' } as any)
      : {}),
  },
  actionCardHover: {
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  actionCardPressed: { opacity: 0.85 },
  actionCardBlocked: { opacity: 0.45 },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, gap: 3 },
  actionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionLabel: {
    flex: 1,
    fontFamily: BODY_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  actionHint: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
  },
  tierPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
  },
  tierPillGreen: {
    backgroundColor: 'rgba(74,222,128,0.10)',
    borderColor: 'rgba(74,222,128,0.40)',
  },
  tierPillYellow: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.40)',
  },
  tierPillText: {
    fontFamily: MONO,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  tierPillTextGreen: { color: '#4ade80' },
  tierPillTextYellow: { color: '#fbbf24' },
});
