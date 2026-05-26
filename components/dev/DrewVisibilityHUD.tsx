/**
 * DrewVisibilityHUD — DV Pass 5.
 *
 * Floating dev-only overlay for the canary rollout on Pop's tenant. Surfaces
 * Drew Visibility (DV) signals: story freshness, confidence-tier distribution,
 * routing rollup, material counts, and receipt-fetch latency p50/p95.
 *
 * Gating
 *   - Web-only. Returns null on iOS/Android (no `window.location` there).
 *   - Query-param gate: only renders when `?dv=1` is in `window.location.search`.
 *   - Dismissable. Once dismissed, sessionStorage suppresses re-render until a
 *     fresh page load (with `?dv=1`) re-enables it.
 *
 * Not production UI. Visual hierarchy is intentionally raw — fixed bottom-right
 * card, amber border, monospace text. If it ever leaks into prod the gate
 * prevents any contractor from seeing it.
 *
 * Law #7: pure render layer. Reads story props + calls `useMaterialStory`
 * (which is itself a pure data hook); no decisions, no side effects beyond
 * sessionStorage dismissal.
 * Law #9: never logs receipt bodies or IDs.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BlueprintStoryV2 } from '@/lib/api/blueprintsStoryV2';
import type { MaterialInstance } from '@/lib/api/blueprintsStoryV2';

const DISMISS_KEY = 'drew-visibility-hud-dismissed';

export interface DrewVisibilityHUDProps {
  story: BlueprintStoryV2 | null;
  materialsBySheet?: Map<string, MaterialInstance[]>;
  receiptFetchLatenciesMs?: number[];
}

// ---------------------------------------------------------------------------
// Gate helpers — exported for tests so they can exercise the gate logic
// independently of window globals.
// ---------------------------------------------------------------------------

function isWebGateOpen(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined' || !window.location) return false;
  const search = window.location.search ?? '';
  return /[?&]dv=1(?:&|$)/.test(search);
}

function isDismissed(): boolean {
  if (Platform.OS !== 'web') return false;
  try {
    return window.sessionStorage?.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismiss(): void {
  try {
    window.sessionStorage?.setItem(DISMISS_KEY, '1');
  } catch {
    // Private-browsing / quota errors are fine to swallow — the HUD will
    // simply remain visible until the page is reloaded.
  }
}

// ---------------------------------------------------------------------------
// Pure compute helpers — exported so tests can hit them directly without
// rendering the whole HUD.
// ---------------------------------------------------------------------------

export function computeTierDistribution(
  story: BlueprintStoryV2 | null,
): { GREEN: number; YELLOW: number; RED: number; UNKNOWN: number } {
  const out = { GREEN: 0, YELLOW: 0, RED: 0, UNKNOWN: 0 };
  if (!story) return out;
  for (const ch of story.chapters) {
    const t = ch.confidence_tier;
    if (t === 'GREEN' || t === 'YELLOW' || t === 'RED') out[t] += 1;
    else out.UNKNOWN += 1;
  }
  return out;
}

export function computeRoutingRollup(
  story: BlueprintStoryV2 | null,
): { auto: number; review: number; open: number } {
  const out = { auto: 0, review: 0, open: 0 };
  if (!story) return out;
  for (const ch of story.chapters) {
    const r = ch.routing_summary;
    if (!r) continue;
    out.auto += r.auto ?? 0;
    out.review += r.review ?? 0;
    out.open += r.open ?? 0;
  }
  return out;
}

export function computeMaterialCounts(
  materialsBySheet: Map<string, MaterialInstance[]> | undefined,
): { total: number; bound: number; unknown: number } {
  const out = { total: 0, bound: 0, unknown: 0 };
  if (!materialsBySheet) return out;
  for (const arr of materialsBySheet.values()) {
    for (const m of arr) {
      out.total += 1;
      if (m.tier === 'GREEN') out.bound += 1;
      if (m.resolution_source === 'unknown') out.unknown += 1;
    }
  }
  return out;
}

export function computePercentiles(
  samples: number[] | undefined,
): { p50: number | null; p95: number | null; n: number } {
  if (!samples || samples.length === 0) return { p50: null, p95: null, n: 0 };
  const sorted = samples.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const p50 = sorted[Math.floor(n * 0.5)] ?? null;
  // p95: floor(n * 0.95), but for small n that can collide with the last
  // index. Clamp to the last index to stay safe.
  const idx95 = Math.min(Math.floor(n * 0.95), n - 1);
  const p95 = sorted[idx95] ?? null;
  return { p50, p95, n };
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '—';
    const delta = Date.now() - t;
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return `${Math.floor(delta / 86_400_000)}d ago`;
  } catch {
    return '—';
  }
}

function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrewVisibilityHUD(
  props: DrewVisibilityHUDProps,
): React.ReactElement | null {
  // Gate first — bail synchronously on native and when the query param /
  // dismiss key say no.
  const open = isWebGateOpen();
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissed());

  const { story, materialsBySheet, receiptFetchLatenciesMs } = props;

  const tiers = useMemo(() => computeTierDistribution(story), [story]);
  const routing = useMemo(() => computeRoutingRollup(story), [story]);
  const mats = useMemo(
    () => computeMaterialCounts(materialsBySheet),
    [materialsBySheet],
  );
  const lat = useMemo(
    () => computePercentiles(receiptFetchLatenciesMs),
    [receiptFetchLatenciesMs],
  );

  if (!open || dismissed) return null;

  const chapters = story?.chapters.length ?? 0;
  const sheets = story?.coverage?.sheets_total ?? 0;
  const updatedAt = formatRelative(story?.updated_at);

  const onDismiss = (): void => {
    persistDismiss();
    setDismissed(true);
  };

  return (
    <View
      style={styles.card}
      testID="drew-visibility-hud"
      accessibilityRole="summary"
      accessibilityLabel="Drew Visibility HUD"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>DREW VISIBILITY HUD</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss Drew Visibility HUD"
          testID="drew-visibility-hud-dismiss"
          style={({ pressed }: { pressed: boolean }) => [
            styles.dismissBtn,
            pressed && styles.dismissBtnPressed,
          ]}
          hitSlop={6}
        >
          <Text style={styles.dismissText}>×</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.section}>Story:</Text>
        <Text style={styles.line} testID="drew-visibility-hud-story">
          {`  chapters: ${chapters} · sheets: ${sheets} · updated ${updatedAt}`}
        </Text>

        <Text style={styles.section}>Tier distribution:</Text>
        <Text style={styles.line} testID="drew-visibility-hud-tiers">
          {`  GREEN ${tiers.GREEN} · YELLOW ${tiers.YELLOW} · RED ${tiers.RED} · — ${tiers.UNKNOWN}`}
        </Text>

        <Text style={styles.section}>Routing rollup:</Text>
        <Text style={styles.line} testID="drew-visibility-hud-routing">
          {`  AUTO ${routing.auto} · AVA ${routing.review} · BLOCK ${routing.open}`}
        </Text>

        <Text style={styles.section}>Materials:</Text>
        <Text style={styles.line} testID="drew-visibility-hud-materials">
          {`  ${formatInt(mats.total)} instances · ${formatInt(mats.bound)} BOUND · ${formatInt(mats.unknown)} UNKNOWN`}
        </Text>

        <Text style={styles.section}>Receipt fetch p50/p95:</Text>
        <Text style={styles.line} testID="drew-visibility-hud-latency">
          {lat.n === 0
            ? '  — (no samples)'
            : `  ${lat.p50}ms / ${lat.p95}ms (n=${lat.n})`}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 280,
    maxHeight: 240,
    backgroundColor: 'rgba(11,13,18,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.65)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    zIndex: 9999,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } as object)
      : null),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Menlo' }),
  },
  dismissBtn: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dismissBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  dismissText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 14,
    fontWeight: '700',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 4,
  },
  section: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Menlo' }),
    marginTop: 4,
  },
  line: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
    fontFamily: Platform.select({ web: 'ui-monospace, Menlo, monospace', default: 'Menlo' }),
    lineHeight: 15,
  },
});
