/**
 * MaterialStoryPanel — DV Pass 4.
 *
 * Renders the "MATERIALS ON THIS SHEET" zone inside SheetView. Mounted between
 * the WHAT TO BUY FOR THIS SHEET zone and the WATCH OUT FOR (this sheet) zone.
 *
 * Pulls per-project material story via `useMaterialStory(projectId)` (cached,
 * TTL-bounded, indexed by sheet_id at the hook layer). Filters the
 * pre-indexed `materialsBySheet` map for the active sheet — falling back to a
 * scan-by-sheet_code when the SheetView only knows the sheet_code (the
 * ChapterSource shape doesn't carry sheet_id today, so sheet_code is the join
 * key the UI surface has).
 *
 * Renders 5 states:
 *   1. Loading       — 3 skeleton card placeholders.
 *   2. Populated     — header + N MaterialInstanceCard rows, 8px gap.
 *   3. Empty         — "no materials bound on this sheet" dashed card.
 *   4. UNKNOWN_REVIEW — amber-bordered card when all instances are unknown.
 *   5. Error         — "Drew is still processing" message card.
 *
 * Law compliance:
 *   Law #7 — pure render layer; the panel never decides, never executes.
 *   Law #2 — receipt_id on each card flows back to immutable receipt via the
 *            optional onReceiptClick callback (parent wires the drawer).
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMaterialStory } from '@/hooks/useMaterialStory';
import type { MaterialInstance } from '@/lib/api/blueprintsStoryV2';
import { MaterialInstanceCard } from './MaterialInstanceCard';

const AMBER = '#fbbf24';
const WHITE_85 = 'rgba(255,255,255,0.85)';
const WHITE_60 = 'rgba(255,255,255,0.6)';
const BORDER_SUBTLE = 'rgba(255,255,255,0.08)';
const BORDER_AMBER_SOFT = 'rgba(251,191,36,0.18)';

interface MaterialStoryPanelProps {
  projectId: string | null;
  sheetId: string;
  sheetCode: string;
  /** Optional callback when user taps a receipt chip — bubbles to drawer. */
  onReceiptClick?: (receiptId: string) => void;
  testID?: string;
}

export function MaterialStoryPanel(props: MaterialStoryPanelProps): React.ReactElement {
  const { projectId, sheetId, sheetCode, onReceiptClick, testID } = props;
  const { materialsBySheet, isLoading, error } = useMaterialStory(projectId);

  // Resolve materials for this sheet.
  //
  // The hook indexes by `sheet_id`, but the SheetView only has `sheet_code`
  // (ChapterSource shape). Try sheet_id first (canonical key), then fall back
  // to a scan-by-sheet_code across all sheets in the index.
  //
  // TODO(material-story v2): once ChapterSource carries sheet_id, drop the
  // scan fallback and use the direct lookup only.
  const materials: MaterialInstance[] = useMemo(() => {
    const direct = materialsBySheet.get(sheetId);
    if (direct && direct.length > 0) return direct;
    if (direct && direct.length === 0) return direct; // empty sheet entry exists
    // Fallback: scan by sheet_code.
    const all: MaterialInstance[] = [];
    for (const arr of materialsBySheet.values()) {
      for (const m of arr) {
        if (m.sheet_code === sheetCode) all.push(m);
      }
    }
    return all;
  }, [materialsBySheet, sheetId, sheetCode]);

  const rootTestID = testID ?? 'material-story-panel';

  // ─── 5) Error state ──────────────────────────────────────────────────────
  if (error) {
    return (
      <View testID={rootTestID} style={styles.zone}>
        <View testID={`${rootTestID}-error`} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>!</Text>
          <Text style={styles.emptyTitle}>Material story unavailable</Text>
          <Text style={styles.emptyBody}>Drew is still processing.</Text>
        </View>
      </View>
    );
  }

  // ─── 1) Loading state ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View testID={rootTestID} style={styles.zone}>
        <View testID={`${rootTestID}-loading`}>
          {[0, 1, 2].map((i) => (
            <View key={`mat-skel-${i}`} style={styles.skeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  const hasMaterials = materials.length > 0;
  const allUnknown = hasMaterials && materials.every((m) => m.resolution_source === 'unknown');

  // ─── 4) UNKNOWN_REVIEW subvariant ────────────────────────────────────────
  if (allUnknown) {
    return (
      <View testID={rootTestID} style={styles.zone}>
        <View testID={`${rootTestID}-unknown-review`} style={styles.unknownCard}>
          <Text style={styles.unknownIcon}>?</Text>
          <Text style={styles.unknownTitle}>
            {`${materials.length} ${materials.length === 1 ? 'symbol' : 'symbols'} awaiting AVA review on this sheet`}
          </Text>
        </View>
      </View>
    );
  }

  // ─── 3) Empty state (no materials bound on this sheet) ───────────────────
  if (!hasMaterials) {
    return (
      <View testID={rootTestID} style={styles.zone}>
        <View testID={`${rootTestID}-empty`} style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>·</Text>
          <Text style={styles.emptyTitle}>No materials bound on this sheet</Text>
          <Text style={styles.emptyBody}>
            The buy list lives on the schedule or plan sheets in this chapter.
          </Text>
        </View>
      </View>
    );
  }

  // ─── 2) Populated state ──────────────────────────────────────────────────
  const itemsLabel = materials.length === 1 ? '1 item' : `${materials.length} items`;
  return (
    <View testID={rootTestID} style={styles.zone}>
      <View style={styles.header}>
        <Text style={styles.eyebrow} testID={`${rootTestID}-header`}>
          {`MATERIALS ON THIS SHEET · ${itemsLabel}`}
        </Text>
      </View>
      <View style={styles.list}>
        {materials.map((mat) => (
          <View
            key={mat.instance_id}
            style={styles.cardSlot}
            testID={`${rootTestID}-card-${mat.instance_id}`}
          >
            <MaterialInstanceCard
              instance={mat}
              onReceiptClick={onReceiptClick}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { marginTop: 22 },
  header: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_AMBER_SOFT,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: AMBER,
    fontWeight: '800',
  },
  list: { gap: 8 },
  cardSlot: { marginBottom: 0 },
  skeletonCard: {
    height: 64,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: BORDER_SUBTLE,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  emptyIcon: {
    color: 'rgba(251,191,36,0.45)',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  emptyTitle: {
    color: WHITE_85,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  emptyBody: {
    color: WHITE_60,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
  unknownCard: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  unknownIcon: {
    color: AMBER,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  unknownTitle: {
    color: AMBER,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
