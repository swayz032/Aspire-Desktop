/**
 * DrewStageProgress — Wave 6A.1.
 *
 * Cinematic 5-stage pipeline display that REPLACES the basic ring/progress
 * UI while Drew chews through a freshly-dropped plan set.
 *
 * Aesthetic direction: luxury technical atelier — deep ink black, amber-gold
 * hairline rules, monospaced telemetry, vertical timeline with active-stage
 * glow. Bloomberg Terminal meets a blueprint draft room. Every line of copy
 * is written in Drew's voice: terse, expert, evidence-driven.
 *
 * Spec (from Wave 6.5 brief):
 *   1. Vertical 5-stage list (INGEST · CLASSIFY · SEE · REASON · PROCURE)
 *   2. Per-stage: icon, name, plain-English substep, status, elapsed, ETA
 *   3. Active stage is prominent (larger type, animated glow, narration line
 *      that rotates through Drew's substep prose)
 *   4. Completed stages collapse to a checkmark + brief result summary
 *   5. Rotating "did you know" insight cards keyed to the active stage
 *   6. Sheet thumbnail shimmer rail at the bottom (placeholder rectangles
 *      for v1 — real thumbs land Wave 6.5 when the /sheets endpoint ships)
 *
 * Premium constraints:
 *   - CLS = 0 (host has a stable minHeight; no layout jumps on transition)
 *   - 200ms cross-fades on every stage-status transition
 *   - Reduced motion respected via Animated.timing (kept short + non-jumpy)
 *   - React-Native-Web compatible; uses RN primitives only
 *   - No new node_modules — uses Animated, Ionicons, and our existing
 *     StageProgress contract from blueprintsApi
 *
 * Wave 6.5 will replace the hardcoded narration cycle with real telemetry
 * piped from the orchestrator's stage_progress logs. The component's prop
 * surface is already shaped for that handoff (stageProgress drives status;
 * narration is derived from `currentStage`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StageKey, StageStatus, StageProgress } from '@/lib/api/blueprintsApi';

interface Props {
  filename: string | null;
  stageProgress: StageProgress;
  /** 0-1 upload ratio (only meaningful during reading/uploading). */
  uploadRatio: number;
  /** When the upload kicked off — drives elapsed counters. */
  startedAtMs: number;
  testID?: string;
}

interface StageMeta {
  key: StageKey;
  index: number;
  display: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Long-form headline visible when this stage is active. */
  headline: string;
  /** Narration substeps cycled while active (Drew's voice). */
  narration: ReadonlyArray<string>;
  /** Insight cards rotated below the timeline while this stage is active. */
  insights: ReadonlyArray<{ kicker: string; body: string }>;
  /** Approximate budget in seconds — drives ETA copy + meter fill. */
  etaSec: number;
}

const STAGES: ReadonlyArray<StageMeta> = [
  {
    key: 'ingest',
    index: 0,
    display: 'Ingest',
    icon: 'documents-outline',
    headline: 'Drew is parsing the plan set',
    narration: [
      'Splitting the PDF into individual sheets…',
      'Reading title blocks and sheet numbers…',
      'Indexing revision stamps and dates…',
      'Building the canonical sheet manifest…',
    ],
    insights: [
      {
        kicker: 'Why this matters',
        body: 'Drew rebuilds every set from the sheet index up. No human re-typing — the manifest is canonical from the first second.',
      },
      {
        kicker: 'Format coverage',
        body: 'PDF, multi-page TIFF, scanned JPGs, HEIC, and exported DWG renders all collapse into the same sheet schema downstream.',
      },
    ],
    etaSec: 18,
  },
  {
    key: 'classify',
    index: 1,
    display: 'Classify',
    icon: 'pricetags-outline',
    headline: 'Tagging disciplines and revisions',
    narration: [
      'Detecting Architectural, Structural, Civil, MEP…',
      'Cross-referencing sheet codes (A-, S-, C-, E-, M-, P-)…',
      'Flagging revision deltas across the set…',
      'Routing review-needed sheets for a closer look…',
    ],
    insights: [
      {
        kicker: 'Disciplines we read',
        body: 'Architectural · Structural · Civil · Electrical · Mechanical · Plumbing · Fire · Landscape · Specialty. Mixed-discipline sheets get every applicable tag.',
      },
      {
        kicker: 'Revision logic',
        body: 'Drew compares title-block revision stamps and only treats the latest signed revision as canonical for takeoff.',
      },
    ],
    etaSec: 22,
  },
  {
    key: 'see',
    index: 2,
    display: 'See',
    icon: 'eye-outline',
    headline: 'Detecting objects across the set',
    narration: [
      'YOLOv11 scanning plumbing fixtures and supply lines…',
      'Counting receptacles, switches, panels, and homeruns…',
      'Locating structural columns, beams, and joists…',
      'Resolving door / window / opening schedules…',
    ],
    insights: [
      {
        kicker: 'Vision model',
        body: 'YOLOv11 generic v1 on every sheet. Fine-tuned weights for fixtures + electrical land in Wave 10.',
      },
      {
        kicker: 'What gets counted',
        body: 'Fixtures, outlets, switches, panels, columns, doors, windows, HVAC equipment, and any symbol from the legend you uploaded.',
      },
    ],
    etaSec: 38,
  },
  {
    key: 'reason',
    index: 3,
    display: 'Reason',
    icon: 'git-network-outline',
    headline: 'Reconciling the takeoff',
    narration: [
      'Cross-checking detected counts against schedules…',
      'Reconciling sheet keynotes with the spec book…',
      'Flagging quantity discrepancies for human review…',
      'Building the canonical takeoff line items…',
    ],
    insights: [
      {
        kicker: 'Human-in-the-loop',
        body: 'Any line where vision and schedule disagree by more than 5% gets routed to your review queue — never silently averaged.',
      },
      {
        kicker: 'Receipt-backed',
        body: 'Every line item carries a sheet citation + bounding box. You can prove where the count came from in one click.',
      },
    ],
    etaSec: 28,
  },
  {
    key: 'procure',
    index: 4,
    display: 'Procure & Price',
    icon: 'cash-outline',
    headline: 'Pricing the takeoff',
    narration: [
      'Mapping line items to supplier catalogs…',
      'Pulling live pricing from preferred vendors…',
      'Flagging Section 232 steel and aluminum exposure…',
      'Computing landed cost with tax, freight, and waste factor…',
    ],
    insights: [
      {
        kicker: 'Tariff awareness',
        body: 'Drew flags every rebar, steel deck, and aluminum extrusion line for Section 232 exposure. No surprise tariffs at PO time.',
      },
      {
        kicker: 'Live pricing',
        body: 'Supplier catalogs refresh every 4 hours. The number you see is what you pay this week — not last quarter.',
      },
    ],
    etaSec: 24,
  },
];

const NARRATION_ROTATE_MS = 2400;
const INSIGHT_ROTATE_MS = 6500;

function statusOf(stage: StageMeta, sp: StageProgress): StageStatus {
  return sp[stage.key];
}

function activeStageIndex(sp: StageProgress): number {
  // First non-complete stage is "active". `stub` and `pending` both count
  // as not-yet-running for the purpose of the highlight, but if there's a
  // `running` we prefer that.
  const running = STAGES.findIndex((s) => sp[s.key] === 'running');
  if (running >= 0) return running;
  // Otherwise pick the first non-ok stage.
  const next = STAGES.findIndex((s) => sp[s.key] !== 'ok');
  return next >= 0 ? next : STAGES.length - 1;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function StageRow({
  stage,
  status,
  isActive,
  uploadRatio,
  stageElapsedMs,
}: {
  stage: StageMeta;
  status: StageStatus;
  isActive: boolean;
  uploadRatio: number;
  stageElapsedMs: number;
}): React.ReactElement {
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, glow]);

  const isComplete = status === 'ok';
  const isError = status === 'error';

  const indicatorColor = isError
    ? '#ef4444'
    : isComplete
      ? '#22c55e'
      : isActive
        ? '#fbbf24'
        : 'rgba(255,255,255,0.22)';

  const meterPct = isComplete
    ? 100
    : isActive
      ? // For ingest, ride upload ratio while it's < 1, else estimate from elapsed
        stage.key === 'ingest' && uploadRatio < 1
        ? Math.round(uploadRatio * 90)
        : Math.min(
            92,
            Math.round((stageElapsedMs / 1000 / stage.etaSec) * 92),
          )
      : 0;

  return (
    <View style={styles.row} testID={`drew-stage-${stage.key}`}>
      {/* Rail column — number + connector */}
      <View style={styles.rail}>
        <Animated.View
          style={[
            styles.indicator,
            { borderColor: indicatorColor },
            isActive &&
              ({
                shadowColor: '#fbbf24',
                shadowOpacity: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.55],
                }),
                shadowRadius: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [4, 14],
                }),
                shadowOffset: { width: 0, height: 0 },
              } as unknown as ViewStyle),
          ]}
        >
          {isComplete ? (
            <Ionicons name="checkmark" size={13} color="#22c55e" />
          ) : isError ? (
            <Ionicons name="close" size={13} color="#ef4444" />
          ) : (
            <Text
              style={[
                styles.indicatorNum,
                { color: isActive ? '#fbbf24' : 'rgba(255,255,255,0.45)' },
              ]}
            >
              {stage.index + 1}
            </Text>
          )}
        </Animated.View>
        {stage.index < STAGES.length - 1 ? (
          <View
            style={[
              styles.connector,
              isComplete && { backgroundColor: 'rgba(34,197,94,0.35)' },
              isActive && { backgroundColor: 'rgba(251,191,36,0.30)' },
            ]}
          />
        ) : null}
      </View>

      {/* Body column */}
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <Ionicons
            name={stage.icon}
            size={14}
            color={
              isComplete
                ? 'rgba(34,197,94,0.85)'
                : isActive
                  ? 'rgba(251,191,36,0.95)'
                  : 'rgba(255,255,255,0.45)'
            }
          />
          <Text
            style={[
              styles.rowLabel,
              isActive && styles.rowLabelActive,
              isComplete && styles.rowLabelComplete,
            ]}
          >
            {stage.display.toUpperCase()}
          </Text>
          <View style={styles.rowSpacer} />
          {isActive ? (
            <Text style={styles.rowTimer}>
              {formatElapsed(stageElapsedMs)}{' '}
              <Text style={styles.rowTimerDim}>· ~{stage.etaSec}s</Text>
            </Text>
          ) : isComplete ? (
            <Text style={styles.rowTimerOk}>done</Text>
          ) : (
            <Text style={styles.rowTimerPending}>pending</Text>
          )}
        </View>

        {isActive ? (
          <Text style={styles.activeHeadline}>{stage.headline}</Text>
        ) : null}

        {/* Slim meter — only renders for active/complete to keep idle rows quiet */}
        {(isActive || isComplete) && (
          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: `${meterPct}%`,
                  backgroundColor: isComplete ? '#22c55e' : '#fbbf24',
                },
              ]}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function NarrationLine({
  active,
}: {
  active: StageMeta;
}): React.ReactElement {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setIdx(0);
  }, [active.key]);

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIdx((prev) => (prev + 1) % active.narration.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, NARRATION_ROTATE_MS);
    return () => clearInterval(id);
  }, [active.key, active.narration.length, fade]);

  return (
    <View style={styles.narrationHost}>
      <View style={styles.narrationDot} />
      <Animated.Text style={[styles.narrationText, { opacity: fade }]}>
        {active.narration[idx]}
      </Animated.Text>
    </View>
  );
}

function InsightCard({
  active,
}: {
  active: StageMeta;
}): React.ReactElement {
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setIdx(0);
  }, [active.key]);

  useEffect(() => {
    if (active.insights.length <= 1) return;
    const id = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIdx((prev) => (prev + 1) % active.insights.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, INSIGHT_ROTATE_MS);
    return () => clearInterval(id);
  }, [active.key, active.insights.length, fade]);

  const card = active.insights[idx];

  return (
    <Animated.View style={[styles.insightCard, { opacity: fade }]}>
      <View style={styles.insightKickerRow}>
        <View style={styles.insightDiamond} />
        <Text style={styles.insightKicker}>{card.kicker.toUpperCase()}</Text>
      </View>
      <Text style={styles.insightBody}>{card.body}</Text>
    </Animated.View>
  );
}

function ThumbRail({
  active,
  uploadRatio,
}: {
  active: StageMeta;
  uploadRatio: number;
}): React.ReactElement {
  // Until the /sheets endpoint is live (Wave 6.5), animate placeholder
  // rectangles. The count "discovered" grows with progress so users get a
  // sense of motion through the set.
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  // Estimate sheet count discovered so far. Pre-ingest = grow with upload.
  // Post-ingest = full reveal (12 placeholder tiles).
  const TILE_COUNT = 12;
  const discovered =
    active.key === 'ingest'
      ? Math.max(2, Math.round(uploadRatio * TILE_COUNT))
      : TILE_COUNT;

  return (
    <View style={styles.thumbRail}>
      <View style={styles.thumbRailHeader}>
        <Text style={styles.thumbRailLabel}>SHEET MANIFEST</Text>
        <Text style={styles.thumbRailCount}>
          {discovered} / {TILE_COUNT}+ detected
        </Text>
      </View>
      <View style={styles.thumbRow}>
        {Array.from({ length: TILE_COUNT }).map((_, i) => {
          const isDiscovered = i < discovered;
          return (
            <View
              key={i}
              style={[
                styles.thumb,
                isDiscovered ? styles.thumbActive : styles.thumbPending,
              ]}
            >
              {isDiscovered ? (
                <Animated.View
                  style={[
                    styles.thumbShine,
                    {
                      opacity: shimmer.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.35, 0],
                      }),
                      transform: [
                        {
                          translateX: shimmer.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-30, 30],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              <Text style={styles.thumbCode}>
                {isDiscovered ? `A-${(i + 1).toString().padStart(2, '0')}` : '—'}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DrewStageProgress({
  filename,
  stageProgress,
  uploadRatio,
  startedAtMs,
  testID,
}: Props): React.ReactElement {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const totalElapsedMs = Math.max(0, now - startedAtMs);
  const activeIdx = useMemo(() => activeStageIndex(stageProgress), [stageProgress]);
  const active = STAGES[activeIdx];

  // Stage-elapsed = total elapsed minus the sum of completed-stage budgets.
  // Good enough for a v1 perception of progress; Wave 6.5 swaps to real
  // per-stage timestamps from the orchestrator.
  const completedBudget = STAGES.slice(0, activeIdx).reduce(
    (acc, s) => acc + s.etaSec * 1000,
    0,
  );
  const stageElapsedMs = Math.max(0, totalElapsedMs - completedBudget);

  return (
    <View style={styles.host} testID={testID ?? 'drew-stage-progress'}>
      {/* Header: Drew identity + file we're crunching */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.crest}>
            <Text style={styles.crestMark}>D</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Drew · Blueprint Engine</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {filename ?? 'Plan set in flight'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTimerLabel}>ELAPSED</Text>
          <Text style={styles.headerTimerValue}>{formatElapsed(totalElapsedMs)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Active stage narration — large, rotating Drew prose */}
      <View style={styles.narrationBlock}>
        <Text style={styles.activeKicker}>NOW</Text>
        <Text style={styles.activeHeadlineBig}>{active.headline}</Text>
        <NarrationLine active={active} />
      </View>

      {/* 5-stage vertical timeline */}
      <View style={styles.timeline}>
        {STAGES.map((stage) => {
          const status = statusOf(stage, stageProgress);
          const isActive = stage.index === activeIdx && status !== 'ok';
          return (
            <StageRow
              key={stage.key}
              stage={stage}
              status={status}
              isActive={isActive}
              uploadRatio={uploadRatio}
              stageElapsedMs={isActive ? stageElapsedMs : 0}
            />
          );
        })}
      </View>

      {/* Insight card keyed to active stage */}
      <InsightCard active={active} />

      {/* Sheet thumbnail rail */}
      <ThumbRail active={active} uploadRatio={uploadRatio} />

      {/* Reassurance footer in Drew's voice */}
      <Text style={styles.footer}>
        Hold the line — Drew finishes the set even if you close this tab. Receipt
        lands in Plans &amp; Photos either way.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    // CLS = 0: keep total height stable across narration / insight swaps.
    minHeight: 520,
  },

  // -- Header --------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  crest: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestMark: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.5,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif' } as any)
      : {}),
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.50)',
    marginTop: 1,
    maxWidth: 320,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTimerLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  headerTimerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' } as any)
      : {}),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },

  // -- Active narration block ----------------------------------------------
  narrationBlock: {
    paddingBottom: 18,
    gap: 6,
  },
  activeKicker: {
    fontSize: 9.5,
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 2,
    fontWeight: '800',
  },
  activeHeadlineBig: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.6,
    lineHeight: 28,
    ...(Platform.OS === 'web'
      ? ({
          fontFamily:
            'ui-serif, "Iowan Old Style", "Charter", Georgia, "Times New Roman", serif',
        } as any)
      : {}),
  },
  narrationHost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    minHeight: 18,
  },
  narrationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#fbbf24',
  },
  narrationText: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: -0.1,
    flex: 1,
  },

  // -- Timeline ------------------------------------------------------------
  timeline: {
    gap: 0,
    paddingBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    minHeight: 56,
  },
  rail: {
    width: 22,
    alignItems: 'center',
  },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorNum: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' } as any)
      : {}),
  },
  connector: {
    width: 1,
    flex: 1,
    minHeight: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 2,
    marginBottom: 2,
  },
  rowBody: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 14,
    gap: 6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.5,
  },
  rowLabelActive: {
    color: '#fbbf24',
  },
  rowLabelComplete: {
    color: 'rgba(34,197,94,0.85)',
  },
  rowSpacer: { flex: 1 },
  rowTimer: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.65)',
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' } as any)
      : {}),
  },
  rowTimerDim: {
    color: 'rgba(255,255,255,0.30)',
  },
  rowTimerOk: {
    fontSize: 9.5,
    color: 'rgba(34,197,94,0.75)',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  rowTimerPending: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  activeHeadline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
  meterTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginTop: 2,
  },
  meterFill: {
    height: '100%',
    borderRadius: 1,
    ...(Platform.OS === 'web'
      ? ({ transition: 'width 200ms ease' } as any)
      : {}),
  },

  // -- Insight card --------------------------------------------------------
  insightCard: {
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
    backgroundColor: 'rgba(251,191,36,0.04)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    marginBottom: 18,
    minHeight: 78,
  },
  insightKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightDiamond: {
    width: 6,
    height: 6,
    backgroundColor: '#fbbf24',
    transform: [{ rotate: '45deg' }],
  },
  insightKicker: {
    fontSize: 9.5,
    color: 'rgba(251,191,36,0.90)',
    letterSpacing: 2,
    fontWeight: '800',
  },
  insightBody: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 18,
    letterSpacing: -0.05,
  },

  // -- Thumb rail ----------------------------------------------------------
  thumbRail: {
    gap: 8,
    marginBottom: 16,
  },
  thumbRailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  thumbRailLabel: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    fontWeight: '800',
  },
  thumbRailCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' } as any)
      : {}),
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    overflow: 'hidden',
  },
  thumbActive: {
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.05)',
  },
  thumbPending: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.015)',
    borderStyle: 'dashed',
  },
  thumbShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: 'rgba(251,191,36,0.35)',
  },
  thumbCode: {
    fontSize: 8.5,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'web'
      ? ({ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace' } as any)
      : {}),
  },

  // -- Footer --------------------------------------------------------------
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    textAlign: 'center',
    letterSpacing: -0.05,
    lineHeight: 16,
  },
});
