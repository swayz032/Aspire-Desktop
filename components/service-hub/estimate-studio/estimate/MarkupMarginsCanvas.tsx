/**
 * MarkupMarginsCanvas — Wave 15.
 *
 * Live slider studio for the three knobs that decide whether a bid wins or
 * loses money: labor markup %, materials markup %, contingency %. Plus a
 * tariff absorb/pass-through toggle. The total recalcs on every input so
 * the contractor can feel each dollar move.
 *
 * On web we render real <input type="range"> elements via a thin React
 * Native View shim — RN doesn't ship a Slider that works on web without an
 * extra dep, and the native HTML range gives us free GPU-accelerated drag
 * + native keyboard accessibility for free.
 *
 * Aspire Laws:
 *   - Law #2: the "Save markup rules to office memory" button is a stub.
 *     A real receipt fires when the office_memory write lands.
 *   - Law #7: pure render layer.
 */
import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintAssembly,
  BlueprintMaterial,
} from '@/lib/api/blueprintsApi';
import {
  buildLineItems,
  computeMoneyStack,
  formatUsd,
} from '@/lib/estimate/bidMath';
import { estimateUiActions, useEstimateUi } from '@/lib/estimateUiStore';

interface Props {
  materials: BlueprintMaterial[];
  assemblies: BlueprintAssembly[];
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

export function MarkupMarginsCanvas({
  materials,
  assemblies,
}: Props): React.ReactElement {
  const ui = useEstimateUi();
  const {
    setLaborPct,
    setMaterialsPct,
    setContingencyPct,
    setTariffAbsorb,
    resetMarkup,
  } = estimateUiActions();

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

  return (
    <ScrollView
      style={styles.host}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      testID="markup-margins-canvas"
    >
      {/* ============== Live total ============== */}
      <View style={styles.totalCard}>
        <View style={styles.totalLeft}>
          <Text style={styles.totalLabel}>Live total</Text>
          <Text style={styles.totalNote}>
            Updates as you move sliders · {built.all.filter((l) => !l.hidden).length} lines
          </Text>
        </View>
        <Text style={styles.totalValue} testID="markup-live-total">
          {formatUsd(money.total)}
        </Text>
      </View>

      {/* ============== Sliders ============== */}
      <View style={styles.slidersGrid}>
        <SliderCard
          label="Labor markup"
          sublabel={`on ${formatUsd(money.laborSubtotal)} labor`}
          value={ui.markup.laborPct}
          min={0}
          max={100}
          step={1}
          suffix="%"
          delta={formatUsd(money.laborMarkup)}
          onChange={setLaborPct}
          testID="markup-slider-labor"
        />
        <SliderCard
          label="Materials markup"
          sublabel={`on ${formatUsd(money.materialsSubtotal)} materials`}
          value={ui.markup.materialsPct}
          min={0}
          max={100}
          step={1}
          suffix="%"
          delta={formatUsd(money.materialsMarkup)}
          onChange={setMaterialsPct}
          testID="markup-slider-materials"
        />
        <SliderCard
          label="Contingency"
          sublabel="applied after markups"
          value={ui.markup.contingencyPct}
          min={0}
          max={20}
          step={0.5}
          suffix="%"
          delta={formatUsd(money.contingency)}
          onChange={setContingencyPct}
          testID="markup-slider-contingency"
        />
      </View>

      {/* ============== Tariff toggle ============== */}
      <View style={styles.tariffCard}>
        <View style={styles.tariffLeft}>
          <Text style={styles.tariffLabel}>Tariff handling</Text>
          <Text style={styles.tariffSublabel}>
            Currently exposed: {formatUsd(money.tariffPassThrough)} pass-through
          </Text>
        </View>
        <View style={styles.tariffSwitch}>
          <Pressable
            onPress={() => setTariffAbsorb(true)}
            accessibilityRole="button"
            accessibilityLabel="Absorb tariff into margin"
            style={({ hovered, pressed }: any) => [
              styles.tariffOpt,
              ui.markup.tariffAbsorb && styles.tariffOptActive,
              hovered && !ui.markup.tariffAbsorb && styles.tariffOptHover,
              pressed && styles.tariffOptPressed,
            ]}
            testID="tariff-absorb-on"
          >
            <Text
              style={[
                styles.tariffOptText,
                ui.markup.tariffAbsorb && styles.tariffOptTextActive,
              ]}
            >
              Absorb
            </Text>
            <Text style={styles.tariffOptHint}>Hidden from client</Text>
          </Pressable>
          <Pressable
            onPress={() => setTariffAbsorb(false)}
            accessibilityRole="button"
            accessibilityLabel="Pass tariff through to client"
            style={({ hovered, pressed }: any) => [
              styles.tariffOpt,
              !ui.markup.tariffAbsorb && styles.tariffOptActive,
              hovered && ui.markup.tariffAbsorb && styles.tariffOptHover,
              pressed && styles.tariffOptPressed,
            ]}
            testID="tariff-absorb-off"
          >
            <Text
              style={[
                styles.tariffOptText,
                !ui.markup.tariffAbsorb && styles.tariffOptTextActive,
              ]}
            >
              Pass-through
            </Text>
            <Text style={styles.tariffOptHint}>Shown on bid</Text>
          </Pressable>
        </View>
      </View>

      {/* ============== Actions ============== */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            console.info('[estimate] save markup rules to office memory (stub)', ui.markup);
          }}
          accessibilityRole="button"
          accessibilityLabel="Save markup rules to office memory"
          style={({ hovered, pressed }: any) => [
            styles.saveBtn,
            hovered && styles.saveBtnHover,
            pressed && styles.saveBtnPressed,
          ]}
          testID="markup-save"
        >
          <Ionicons name="bookmark-outline" size={13} color="#0b1220" />
          <Text style={styles.saveBtnText}>Save to office memory</Text>
        </Pressable>
        <Pressable
          onPress={resetMarkup}
          accessibilityRole="button"
          accessibilityLabel="Reset to defaults"
          style={({ hovered, pressed }: any) => [
            styles.resetBtn,
            hovered && styles.resetBtnHover,
            pressed && styles.resetBtnPressed,
          ]}
          testID="markup-reset"
        >
          <Text style={styles.resetBtnText}>Reset defaults</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Slider card
// ---------------------------------------------------------------------------

interface SliderCardProps {
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  delta: string;
  onChange: (n: number) => void;
  testID: string;
}

function SliderCard({
  label,
  sublabel,
  value,
  min,
  max,
  step,
  suffix,
  delta,
  onChange,
  testID,
}: SliderCardProps): React.ReactElement {
  return (
    <View style={styles.sliderCard} testID={testID}>
      <View style={styles.sliderHeader}>
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>{label}</Text>
          <Text style={styles.sliderSublabel}>{sublabel}</Text>
        </View>
        <View style={styles.sliderValueCol}>
          <Text style={styles.sliderValue}>
            {value.toFixed(step < 1 ? 1 : 0)}
            <Text style={styles.sliderSuffix}>{suffix}</Text>
          </Text>
          <Text style={styles.sliderDelta}>{delta}</Text>
        </View>
      </View>
      <SliderInput
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        testID={`${testID}-input`}
      />
      <View style={styles.sliderTicks}>
        <Text style={styles.sliderTick}>
          {min}
          {suffix}
        </Text>
        <Text style={styles.sliderTick}>
          {((min + max) / 2).toFixed(0)}
          {suffix}
        </Text>
        <Text style={styles.sliderTick}>
          {max}
          {suffix}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cross-platform slider input
// ---------------------------------------------------------------------------

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  testID: string;
}

function SliderInput({
  value,
  min,
  max,
  step,
  onChange,
  testID,
}: SliderInputProps): React.ReactElement {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.rangeWrap} testID={testID}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number.parseFloat(e.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
          aria-label={testID}
          style={
            {
              width: '100%',
              accentColor: '#fbbf24',
              cursor: 'pointer',
              background: 'transparent',
            } as React.CSSProperties
          }
        />
      </View>
    );
  }

  // Native fallback — two stepper buttons so the slider isn't silent on iOS.
  return (
    <View style={styles.nativeStepper} testID={testID}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        style={styles.stepperBtn}
      >
        <Ionicons name="remove" size={16} color="#fbbf24" />
      </Pressable>
      <View style={styles.stepperTrack}>
        <View
          style={[
            styles.stepperFill,
            {
              width: `${((value - min) / (max - min)) * 100}%`,
            },
          ]}
        />
      </View>
      <Pressable
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityRole="button"
        accessibilityLabel="Increase"
        style={styles.stepperBtn}
      >
        <Ionicons name="add" size={16} color="#fbbf24" />
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: { flex: 1 },
  scroll: {
    padding: 20,
    gap: 20,
  },
  // ============== Live total ==============
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    gap: 18,
    flexWrap: 'wrap',
  },
  totalLeft: { gap: 4 },
  totalLabel: {
    fontFamily: MONO,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  totalNote: {
    fontFamily: BODY_SANS,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  totalValue: {
    fontFamily: SERIF,
    fontSize: 38,
    fontWeight: '700',
    color: '#fbbf24',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  // ============== Sliders ==============
  slidersGrid: {
    gap: 12,
  },
  sliderCard: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sliderLabels: { flex: 1, gap: 3 },
  sliderLabel: {
    fontFamily: BODY_SANS,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.15,
  },
  sliderSublabel: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.2,
  },
  sliderValueCol: { alignItems: 'flex-end', gap: 2 },
  sliderValue: {
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  sliderSuffix: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.50)',
  },
  sliderDelta: {
    fontFamily: MONO,
    fontSize: 11,
    color: '#fbbf24',
    fontVariant: ['tabular-nums'],
  },
  rangeWrap: { paddingVertical: 4 },
  sliderTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderTick: {
    fontFamily: MONO,
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
  },
  nativeStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  stepperFill: { height: '100%', backgroundColor: '#fbbf24' },
  // ============== Tariff toggle ==============
  tariffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 18,
    flexWrap: 'wrap',
  },
  tariffLeft: { flex: 1, gap: 3, minWidth: 220 },
  tariffLabel: {
    fontFamily: BODY_SANS,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  tariffSublabel: {
    fontFamily: MONO,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.50)',
  },
  tariffSwitch: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tariffOpt: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 5,
    gap: 2,
    alignItems: 'center',
    minWidth: 110,
  },
  tariffOptActive: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.55)',
  },
  tariffOptHover: { backgroundColor: 'rgba(255,255,255,0.04)' },
  tariffOptPressed: { opacity: 0.85 },
  tariffOptText: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.70)',
    letterSpacing: -0.05,
  },
  tariffOptTextActive: { color: '#fbbf24' },
  tariffOptHint: {
    fontFamily: MONO,
    fontSize: 9,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // ============== Actions ==============
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
  },
  saveBtnHover: { opacity: 0.92 },
  saveBtnPressed: { opacity: 0.78 },
  saveBtnText: {
    fontFamily: BODY_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1220',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  resetBtnHover: {
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  resetBtnPressed: { opacity: 0.82 },
  resetBtnText: {
    fontFamily: BODY_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
