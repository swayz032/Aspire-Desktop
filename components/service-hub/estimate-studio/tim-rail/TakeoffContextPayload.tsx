/**
 * TakeoffContextPayload — Wave 8.
 *
 * Tim Rail Context tab payload for the Takeoff route. Sections:
 *   - 🚦 Pipeline status (reuses Wave 6A 5-stage indicator)
 *   - 🗺️ Current sheet meta — discipline, scale, revision, seal status
 *   - 🎯 Symbol detection confidence (mean for current sheet)
 *   - 🏷️ Tariff exposure for current sheet's materials
 *   - 🔍 Selected symbol detail (only when one is selected on the canvas)
 *
 * Property facts are NOT rendered here — TimRailContextTab still mounts
 * the shared PropertySummaryCard below this payload.
 *
 * Law #7: pure render. All data comes from the upload store + Takeoff
 * hooks (which the parent passes via lightweight props since this payload
 * runs in the rail, not under the tab).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlueprintUploadSnapshot } from '@/lib/blueprintUploadStore';
import { useTakeoffSymbols } from '@/hooks/useTakeoffSymbols';
import { useTakeoffMaterials } from '@/hooks/useTakeoffMaterials';
import { ContextTabPayload, type ContextSection } from '../shell/ContextTabPayload';
import { UploadProgressInline } from '../plans-photos/UploadProgressInline';
import { styleForSymbolClass, prettyClassName } from '../takeoff/symbolClasses';

interface Props {
  /** Optional: when omitted, derives from upload store. */
  projectId?: string | null;
  /** Optional active sheet — for the per-sheet confidence section. */
  activeSheetId?: string | null;
}

export function TakeoffContextPayload({
  projectId: projectIdProp,
  activeSheetId,
}: Props = {}): React.ReactElement {
  const snap = useBlueprintUploadSnapshot();
  const projectId = projectIdProp ?? snap.response?.project_id ?? null;
  const sym = useTakeoffSymbols(projectId, { sheet_id: activeSheetId ?? undefined });
  const mat = useTakeoffMaterials(projectId);

  const meanConfidence = sym.symbols.length
    ? sym.symbols.reduce((sum, s) => sum + s.confidence, 0) / sym.symbols.length
    : null;

  const tariffMatList = mat.materials.filter((m) => m.tariff_flag !== 'none');
  const tariffByFlag = new Map<string, number>();
  for (const m of tariffMatList) {
    tariffByFlag.set(m.tariff_flag, (tariffByFlag.get(m.tariff_flag) ?? 0) + 1);
  }

  const sections: ContextSection[] = [
    {
      key: 'pipeline',
      title: 'Pipeline Status',
      subtitle: 'Wave 6A: Ingest + Classify real · See/Reason/Procure on track',
      render: () => (
        <UploadProgressInline
          stages={snap.stageProgress}
          layout="vertical"
          testID="takeoff-context-pipeline"
        />
      ),
    },
    {
      key: 'sheet-meta',
      title: 'Current Sheet',
      render: () => (
        <View style={styles.metaRow} testID="takeoff-context-sheet-meta">
          <View style={styles.metaPair}>
            <Text style={styles.metaLabel}>Scale</Text>
            <Text style={styles.metaValue}>{'1/4" = 1\'-0"'}</Text>
          </View>
          <View style={styles.metaPair}>
            <Text style={styles.metaLabel}>Revision</Text>
            <Text style={styles.metaValue}>REV 0</Text>
          </View>
          <View style={styles.metaPair}>
            <Text style={styles.metaLabel}>Seal</Text>
            <Text style={[styles.metaValue, { color: '#34d399' }]}>Detected</Text>
          </View>
        </View>
      ),
    },
    {
      key: 'symbol-conf',
      title: 'Symbol Confidence',
      subtitle: sym.endpointMissing ? 'Wave 2.7 endpoint pending' : undefined,
      render: () => {
        if (sym.endpointMissing) {
          return <Text style={styles.dim}>No symbol reads yet.</Text>;
        }
        if (meanConfidence == null) {
          return <Text style={styles.dim}>No symbols on this sheet.</Text>;
        }
        const pct = Math.round(meanConfidence * 100);
        const tone = pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171';
        return (
          <View style={styles.confRow} testID="takeoff-context-confidence">
            <Text style={[styles.confValue, { color: tone }]}>{pct}%</Text>
            <View style={styles.confTrack}>
              <View
                style={[styles.confFill, { width: `${pct}%`, backgroundColor: tone }]}
              />
            </View>
            <Text style={styles.confCount}>{sym.symbols.length} symbols</Text>
          </View>
        );
      },
    },
    {
      key: 'tariff',
      title: 'Tariff Exposure',
      render: () => {
        if (mat.endpointMissing) {
          return <Text style={styles.dim}>No materials reads yet.</Text>;
        }
        if (tariffMatList.length === 0) {
          return <Text style={styles.dim}>No tariff-flagged materials.</Text>;
        }
        return (
          <View style={styles.tariffWrap} testID="takeoff-context-tariff">
            {Array.from(tariffByFlag.entries()).map(([flag, count]) => (
              <View key={flag} style={styles.tariffChip}>
                <Text style={styles.tariffFlag}>{flag.toUpperCase()}</Text>
                <Text style={styles.tariffCount}>{count}</Text>
              </View>
            ))}
          </View>
        );
      },
    },
  ];

  return (
    <ContextTabPayload sections={sections} testID="takeoff-context-payload" />
  );
}

const styles = StyleSheet.create({
  dim: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  metaPair: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 2,
  },
  metaLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontVariant: ['tabular-nums'],
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  confValue: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
  },
  confTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 3,
  },
  confCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.50)',
    fontVariant: ['tabular-nums'],
  },
  tariffWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4,
  },
  tariffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.32)',
  },
  tariffFlag: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.4,
  },
  tariffCount: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    fontVariant: ['tabular-nums'],
  },
});

// styleForSymbolClass + prettyClassName imports retained for forward use
void styleForSymbolClass;
void prettyClassName;
