/**
 * PlansPhotosContextPayload — Tim Rail Context tab payload for the
 * Plans & Photos route (Canvas Cleanup, locked 2026-05-18).
 *
 * Composition (top → bottom):
 *   1. Drew · Live Pipeline   — cinematic 5-stage timeline (only while busy)
 *   2. Live Counters          — sheets · disciplines · revisions · materials
 *   3. Pipeline Status        — vertical 5-stage indicator (polled state)
 *   4. View                   — All Sheets / By Discipline / Revisions chips
 *                                (canvas-card switcher; drives the canvas)
 *   5. Filter                 — discipline chip strip (All · A · S · M · E ·
 *                                P · FP · C · L) — drives the grid filter
 *   6. Discipline Counts      — per-discipline breakdown (compact pills)
 *   7. Last Upload            — filename + relative time
 *
 * The View + Filter sections used to live in the canvas. Per the 2026-05-18
 * canvas-cleanup lock, the canvas now hosts ONLY the blueprint thumbnail
 * grid; all chrome moves here.
 *
 * Aspire Laws:
 *   - #1 Single Brain: render layer only. No autonomous decisions.
 *   - #7 Tools Are Hands: store mutations are direct setters.
 */
import React, { useMemo, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useBlueprintProjectPoll } from '@/hooks/useBlueprintProjectPoll';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import {
  plansPhotosUiActions,
  usePlansPhotosUi,
  type PlansPhotosCardKey,
} from '@/lib/plansPhotosUiStore';
import { ContextTabPayload, type ContextSection } from '../shell/ContextTabPayload';
import { UploadProgressInline } from '../plans-photos/UploadProgressInline';
import { DrewStageProgress } from '../plans-photos/DrewStageProgress';
import { getDisciplineStyle } from '../plans-photos/disciplines';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function _relativeTime(ts: number | null): string {
  if (ts == null) return '—';
  const delta = Date.now() - ts;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

// 200ms cross-fade animated count — locked premium-seamless spec.
function AnimatedCount({
  value,
  style,
  testID,
}: {
  value: number;
  style?: any;
  testID?: string;
}): React.ReactElement {
  const [displayed, setDisplayed] = useState(value);
  const opacity = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (value === displayed) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setDisplayed(value);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [value, displayed, opacity]);

  return (
    <Animated.Text style={[style, { opacity }]} testID={testID}>
      {displayed}
    </Animated.Text>
  );
}

// View Mode switcher — the user-facing replacement for the legacy
// BottomChipStrip that used to live on the canvas.
const VIEW_MODES: Array<{ key: PlansPhotosCardKey; icon: IoniconsName; label: string }> = [
  { key: 'sheets', icon: 'documents-outline', label: 'All Sheets' },
  { key: 'disciplines', icon: 'color-palette-outline', label: 'By Discipline' },
  { key: 'revisions', icon: 'time-outline', label: 'Revisions' },
];

// Discipline filter strip — "All" + 8 canonical AIA codes. Drives the
// canvas thumbnail grid's filter via the shared store.
const DISCIPLINE_FILTERS: Array<{ key: string | null; code: string; label: string }> = [
  { key: null, code: 'All', label: 'All disciplines' },
  { key: 'architectural', code: 'A', label: 'Architectural' },
  { key: 'structural', code: 'S', label: 'Structural' },
  { key: 'mechanical', code: 'M', label: 'Mechanical' },
  { key: 'electrical', code: 'E', label: 'Electrical' },
  { key: 'plumbing', code: 'P', label: 'Plumbing' },
  { key: 'fire_protection', code: 'FP', label: 'Fire Protection' },
  { key: 'civil', code: 'C', label: 'Civil' },
  { key: 'landscape', code: 'L', label: 'Landscape' },
];

function _normalizeDisc(disc: string | null | undefined): string | null {
  if (!disc) return null;
  return disc.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

export function PlansPhotosContextPayload(): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();
  const ui = usePlansPhotosUi();
  const { setActiveCard, setFilterKey } = plansPhotosUiActions();

  const projectId = snap.projectId;
  const poll = useBlueprintProjectPoll(projectId);

  const isBusy =
    snap.phase === 'reading' ||
    snap.phase === 'uploading' ||
    snap.phase === 'ingesting' ||
    snap.phase === 'classifying';

  const liveSheetCount =
    poll.status?.sheet_count ??
    poll.sheets.length ??
    snap.response?.ingest?.sheet_count ??
    0;

  const liveDisciplineCount = useMemo(() => {
    if (poll.sheets.length > 0) {
      const set = new Set<string>();
      for (const s of poll.sheets) {
        if (s.discipline) set.add(s.discipline.toLowerCase());
      }
      return set.size;
    }
    return Object.keys(snap.response?.classify?.discipline_counts ?? {}).length;
  }, [poll.sheets, snap.response]);

  const liveRevisionCount =
    poll.revisions.length > 0
      ? poll.revisions.length
      : snap.response?.classify?.revisions ?? 0;

  const materialsState = useTakeoffMaterials(projectId);
  const liveMaterialCount = materialsState.materials.length;

  // Per-discipline counts derived from polled sheets (current sheets only).
  const disciplineCounts = useMemo(() => {
    const successorIds = new Set<string>();
    for (const s of poll.sheets) if (s.supersedes_id) successorIds.add(s.supersedes_id);
    const m = new Map<string | null, number>();
    m.set(null, 0);
    let total = 0;
    for (const s of poll.sheets) {
      if (successorIds.has(s.id)) continue;
      total += 1;
      const k = _normalizeDisc(s.discipline);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    m.set(null, total);
    return m;
  }, [poll.sheets]);

  // Discipline pills (sorted) for the Discipline Counts section.
  const disciplineRows = useMemo(() => {
    if (poll.sheets.length > 0) {
      const m = new Map<string, number>();
      const successorIds = new Set<string>();
      for (const s of poll.sheets) if (s.supersedes_id) successorIds.add(s.supersedes_id);
      for (const s of poll.sheets) {
        if (successorIds.has(s.id)) continue;
        const k = s.discipline ? s.discipline.toLowerCase() : 'unclassified';
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    }
    return Object.entries(snap.response?.classify?.discipline_counts ?? {}).sort(
      (a, b) => b[1] - a[1],
    );
  }, [poll.sheets, snap.response]);

  const effectiveStageProgress = poll.project?.stage_progress ?? snap.stageProgress;
  const hasProject = projectId != null;

  const sections: ContextSection[] = [
    ...(isBusy
      ? [
          {
            key: 'drew-live',
            title: 'Drew · Live Pipeline',
            subtitle: 'Cinematic 5-stage timeline · narration · insights',
            render: () => (
              <DrewStageProgress
                filename={snap.filename}
                stageProgress={effectiveStageProgress}
                uploadRatio={snap.uploadRatio}
                startedAtMs={snap.startedAtMs ?? Date.now()}
                testID="context-drew-stage-progress"
              />
            ),
          } as ContextSection,
        ]
      : []),
    {
      key: 'counters',
      title: 'Live Counters',
      subtitle: poll.isPolling
        ? `Polling every ${poll.stageProgress.procure === 'ok' ? '10' : '2'}s`
        : projectId
          ? 'All stages complete'
          : 'Awaiting upload',
      render: () => (
        <View style={styles.counterRow} testID="context-live-counters">
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveSheetCount}
              style={styles.counterValue}
              testID="context-counter-sheets"
            />
            <Text style={styles.counterLabel}>sheets</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveDisciplineCount}
              style={styles.counterValue}
              testID="context-counter-disciplines"
            />
            <Text style={styles.counterLabel}>disciplines</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveRevisionCount}
              style={styles.counterValue}
              testID="context-counter-revisions"
            />
            <Text style={styles.counterLabel}>revisions</Text>
          </View>
          <View style={styles.counterDivider} />
          <View style={styles.counterCell}>
            <AnimatedCount
              value={liveMaterialCount}
              style={styles.counterValue}
              testID="context-counter-materials"
            />
            <Text style={styles.counterLabel}>materials</Text>
          </View>
        </View>
      ),
    },
    {
      key: 'pipeline',
      title: 'Pipeline Status',
      subtitle: poll.isPolling ? 'Live · auto-refreshing' : 'Idle',
      render: () => (
        <UploadProgressInline
          stages={effectiveStageProgress}
          layout="vertical"
          testID="context-pipeline-status"
        />
      ),
    },
    // ---------------- VIEW ----------------------------------------------
    // Replaces the old canvas-bottom chip strip. Tapping a view chip swaps
    // what the canvas renders (all sheets · by discipline · revisions).
    {
      key: 'view',
      title: 'View',
      subtitle: hasProject ? 'Choose what the canvas renders' : 'Upload to enable',
      render: () => (
        <View style={styles.viewRow} testID="context-view-switcher">
          {VIEW_MODES.map((mode) => {
            const isActive = ui.activeCard === mode.key;
            const isDisabled = !hasProject;
            return (
              <Pressable
                key={mode.key}
                onPress={() => setActiveCard(mode.key)}
                disabled={isDisabled}
                accessibilityRole="button"
                accessibilityLabel={`Switch canvas to ${mode.label}`}
                accessibilityState={{ selected: isActive, disabled: isDisabled }}
                testID={`context-view-${mode.key}`}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.viewChip,
                  isActive && styles.viewChipActive,
                  isDisabled && styles.viewChipDisabled,
                  hovered && !isActive && !isDisabled && styles.viewChipHover,
                  pressed && !isDisabled && styles.viewChipPressed,
                ]}
              >
                <Ionicons
                  name={mode.icon}
                  size={13}
                  color={
                    isDisabled
                      ? 'rgba(255,255,255,0.30)'
                      : isActive
                        ? '#fbbf24'
                        : 'rgba(255,255,255,0.72)'
                  }
                />
                <Text
                  style={[
                    styles.viewChipLabel,
                    isActive && styles.viewChipLabelActive,
                    isDisabled && styles.viewChipLabelDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ),
    },
    // ---------------- FILTER --------------------------------------------
    // Discipline chip row — drives the canvas thumbnail grid filter.
    {
      key: 'filter',
      title: 'Filter',
      subtitle: hasProject ? 'Limit the grid to one discipline' : 'Upload to enable',
      render: () => (
        <View style={styles.filterWrap} testID="context-filter-strip">
          {DISCIPLINE_FILTERS.map((f) => {
            const count = disciplineCounts.get(f.key) ?? 0;
            const isActive = ui.filterKey === f.key;
            const isEmpty = (count === 0 && f.key !== null) || !hasProject;
            return (
              <Pressable
                key={f.code}
                disabled={isEmpty}
                onPress={() => setFilterKey(f.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${f.label}`}
                accessibilityState={{ selected: isActive, disabled: isEmpty }}
                testID={`context-filter-${f.code}`}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  isEmpty && styles.filterChipDisabled,
                  hovered && !isActive && !isEmpty && styles.filterChipHover,
                  pressed && !isEmpty && styles.filterChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipCode,
                    isActive && styles.filterChipCodeActive,
                  ]}
                >
                  {f.code}
                </Text>
                <Text
                  style={[
                    styles.filterChipCount,
                    isActive && styles.filterChipCountActive,
                  ]}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ),
    },
    {
      key: 'disciplines',
      title: 'Discipline Counts',
      render: () => {
        if (disciplineRows.length === 0) {
          return <Text style={styles.empty}>No classification yet.</Text>;
        }
        return (
          <View style={styles.discWrap}>
            {disciplineRows.map(([disc, count]) => {
              const s = getDisciplineStyle(disc);
              return (
                <View
                  key={disc}
                  style={[styles.discRow, { borderColor: s.fg + '33' }]}
                  testID={`context-disc-${disc}`}
                >
                  <View style={[styles.discCodeWrap, { backgroundColor: s.fg + '22' }]}>
                    <Text style={[styles.discCode, { color: s.fg }]}>{s.code}</Text>
                  </View>
                  <Text style={styles.discLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={[styles.discCount, { color: s.fg }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        );
      },
    },
    {
      key: 'last-upload',
      title: 'Last Upload',
      render: () => (
        <View style={styles.lastRow} testID="context-last-upload">
          <Ionicons
            name="document-attach-outline"
            size={14}
            color="rgba(255,255,255,0.55)"
          />
          <View style={styles.lastBody}>
            <Text style={styles.lastFilename} numberOfLines={1}>
              {snap.filename ?? 'No upload yet'}
            </Text>
            <Text style={styles.lastMeta}>
              {snap.filename
                ? `${liveSheetCount} sheet${liveSheetCount === 1 ? '' : 's'} · ${_relativeTime(snap.uploadedAt)}`
                : 'Drop a plan set in the Controls tab.'}
            </Text>
          </View>
        </View>
      ),
    },
  ];

  return <ContextTabPayload sections={sections} testID="plans-photos-context-payload" />;
}

const styles = StyleSheet.create({
  empty: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: -0.05,
    paddingHorizontal: 4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  // ---- Counter strip ---------------------------------------------------
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    paddingHorizontal: 4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  counterCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  counterValue: {
    fontSize: 30,
    fontWeight: '600',
    color: '#fbbf24',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
    lineHeight: 34,
    textShadowColor: 'rgba(251,191,36,0.25)',
    textShadowRadius: 8,
  },
  counterLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  counterDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // ---- View switcher --------------------------------------------------
  viewRow: {
    flexDirection: 'column',
    gap: 6,
    paddingHorizontal: 2,
  },
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 38,
    ...(Platform.OS === 'web'
      ? (({
          transition: 'background-color 150ms ease, border-color 150ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  viewChipActive: {
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  viewChipHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  viewChipPressed: {
    opacity: 0.85,
  },
  viewChipDisabled: {
    opacity: 0.45,
  },
  viewChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
    flex: 1,
  },
  viewChipLabelActive: {
    color: '#fbbf24',
  },
  viewChipLabelDisabled: {
    color: 'rgba(255,255,255,0.45)',
  },
  // ---- Filter chip strip ---------------------------------------------
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    minHeight: 28,
    ...(Platform.OS === 'web'
      ? (({
          transition: 'background-color 150ms ease, border-color 150ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  filterChipActive: {
    backgroundColor: 'rgba(251,191,36,0.10)',
    borderColor: 'rgba(251,191,36,0.55)',
  },
  filterChipHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  filterChipPressed: {
    opacity: 0.85,
  },
  filterChipDisabled: {
    opacity: 0.35,
  },
  filterChipCode: {
    fontSize: 10.5,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  filterChipCodeActive: {
    color: '#fbbf24',
  },
  filterChipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.42)',
    fontVariant: ['tabular-nums'],
  },
  filterChipCountActive: {
    color: 'rgba(251,191,36,0.88)',
  },
  // ---- Discipline counts (premium per-row breakdown) -----------------
  discWrap: {
    flexDirection: 'column',
    gap: 5,
    paddingHorizontal: 2,
  },
  discRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  discCodeWrap: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discCode: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  discLabel: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.86)',
    letterSpacing: -0.05,
  },
  discCount: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  // ---- Last upload ---------------------------------------------------
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  lastBody: {
    flex: 1,
    gap: 4,
  },
  lastFilename: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  lastMeta: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.3,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
});
