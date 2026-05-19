/**
 * SheetRoster — Wave 6A.
 *
 * Roster view of the sheets Drew INGEST stored. Wave 6A surfaces just the
 * `sheet_ids` array + `discipline_counts` from the synchronous upload
 * response — there is NO per-sheet thumbnail or per-sheet discipline tag
 * available yet (backend GET /sheets ships in Wave 2.5; thumbnails in
 * Wave 6.5).
 *
 * The roster therefore renders:
 *   - A header strip of discipline-count chips (real data from CLASSIFY).
 *   - A flat list of sheet IDs with their index + a "?" discipline placeholder.
 *
 * Wave 6.5 will replace this component with a real <SheetThumbnailGrid />.
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDisciplineStyle } from './disciplines';
import { RevisionBadge } from './RevisionBadge';

interface Props {
  /** Sheet IDs from INGEST response (one per page). */
  sheetIds: string[];
  /** Discipline → count, from CLASSIFY response. */
  disciplineCounts: Record<string, number>;
  revisions: number;
  needsReviewCount: number;
  testID?: string;
}

export function SheetRoster({
  sheetIds,
  disciplineCounts,
  revisions,
  needsReviewCount,
  testID,
}: Props): React.ReactElement {
  const totalDisciplineHits = Object.values(disciplineCounts).reduce((a, b) => a + b, 0);
  const orderedDisciplines = Object.entries(disciplineCounts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.host} testID={testID ?? 'sheet-roster'}>
      {/* Discipline summary chip row */}
      <View style={styles.summaryRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{sheetIds.length}</Text>
          <Text style={styles.statLabel}>sheets</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{orderedDisciplines.length}</Text>
          <Text style={styles.statLabel}>disciplines</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{revisions}</Text>
          <Text style={styles.statLabel}>revisions</Text>
        </View>
        {needsReviewCount > 0 ? (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={[styles.statValue, styles.statValueWarn]}>{needsReviewCount}</Text>
              <Text style={styles.statLabel}>need review</Text>
            </View>
          </>
        ) : null}
      </View>

      {/* Discipline chip row */}
      {orderedDisciplines.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.disciplineRow}
        >
          {orderedDisciplines.map(([disc, count]) => {
            const style = getDisciplineStyle(disc);
            return (
              <View
                key={disc}
                style={[styles.discChip, { backgroundColor: style.bg, borderColor: style.fg + '55' }]}
                testID={`discipline-chip-${disc}`}
              >
                <View style={[styles.discCodeWrap, { backgroundColor: style.fg + '22' }]}>
                  <Text style={[styles.discCode, { color: style.fg }]}>{style.code}</Text>
                </View>
                <View style={styles.discBody}>
                  <Text style={styles.discLabel}>{style.label}</Text>
                  <Text style={styles.discCount}>
                    {count} sheet{count === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Sheet list (Wave 6A: no thumbnails, no per-sheet discipline tags). */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>SHEETS</Text>
        <Text style={styles.listHeaderHint}>
          {totalDisciplineHits === 0
            ? 'Classification in progress…'
            : 'Per-sheet discipline tags ship in Wave 6.5 (waiting on backend GET /sheets).'}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sheetIds.map((sheetId, idx) => (
          <View key={sheetId} style={styles.row} testID={`sheet-row-${idx}`}>
            <View style={styles.rowIdx}>
              <Text style={styles.rowIdxText}>{idx + 1}</Text>
            </View>
            <View style={styles.rowDisc}>
              <Text style={styles.rowDiscText}>—</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowSheetNo}>Sheet {idx + 1}</Text>
              <Text style={styles.rowSheetId} numberOfLines={1}>
                {sheetId}
              </Text>
            </View>
            <View style={styles.rowMeta}>
              <RevisionBadge revision={null} />
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.30)" />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
  },
  statBlock: {
    alignItems: 'flex-start',
    gap: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  statValueWarn: {
    color: '#fbbf24',
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  disciplineRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  discChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    minWidth: 150,
  },
  discCodeWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discCode: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  discBody: {
    flex: 1,
    gap: 1,
  },
  discLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  discCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: 4,
  },
  listHeaderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.62)',
    letterSpacing: 1.4,
  },
  listHeaderHint: {
    flex: 1,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: -0.05,
  },

  list: {
    flex: 1,
  },
  listContent: {
    gap: 6,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  rowIdx: {
    width: 28,
    alignItems: 'center',
  },
  rowIdxText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    fontVariant: ['tabular-nums'],
  },
  rowDisc: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDiscText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.42)',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowSheetNo: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  rowSheetId: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as any,
    letterSpacing: -0.1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
