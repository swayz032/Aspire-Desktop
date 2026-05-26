/**
 * SheetReceiptDrawer — DV Pass 3 provenance surface.
 *
 * Compact row (always visible when sheet has any tier/routing data):
 *   [TierDot] [Tier chip] [Routing chip] [Disqualifier chips...]  [Why ▾]
 *
 * Expanded (on tap of any chip or the caret) lazy-loads the ExtractionReceipt
 * via useExtractionReceipt(projectId, receipt_id) and shows EVIDENCE / METRICS
 * / RECEIPT sections. Receipts are immutable (Law #2) so it's cache-safe.
 *
 * Renders null when the sheet has no tier/routing/disqualifier signals at all
 * (legacy pre-DV sheets).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TierDot } from '@/components/ui/TierDot';
import { useExtractionReceipt } from '@/hooks/useExtractionReceipt';
import type {
  ConfidenceTier,
  RoutingAction,
} from '@/lib/api/blueprintsStoryV2';

// ---------------------------------------------------------------------------
// Tier + routing visual maps
// ---------------------------------------------------------------------------
const TIER_BG: Record<ConfidenceTier, string> = {
  GREEN: 'rgba(34,197,94,0.15)',
  YELLOW: 'rgba(251,191,36,0.18)',
  RED: 'rgba(239,68,68,0.18)',
};
const TIER_FG: Record<ConfidenceTier, string> = {
  GREEN: '#86efac',
  YELLOW: '#fde68a',
  RED: '#fca5a5',
};
const ROUTING_LABEL: Record<RoutingAction, string> = {
  AUTO_POPULATE: 'AUTO BIND',
  REVIEW_PENDING: 'REVIEW',
  OPEN_QUESTION: 'BLOCKED',
};

function disqualifierLabel(code: string): string {
  return code.replace(/_/g, ' ').toUpperCase();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SheetReceiptDrawerProps {
  projectId: string | null;
  sheet: {
    sheet_code: string;
    tier?: ConfidenceTier;
    routing_action?: RoutingAction;
    receipt_id?: string;
    disqualifier_codes?: string[];
  };
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SheetReceiptDrawer({
  projectId,
  sheet,
  testID,
}: SheetReceiptDrawerProps): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const hasSignal =
    sheet.tier !== undefined ||
    sheet.routing_action !== undefined ||
    (sheet.disqualifier_codes?.length ?? 0) > 0;

  if (!hasSignal) return null;

  return (
    <View style={styles.card} testID={testID ?? 'sheet-receipt-drawer'}>
      <CompactRow
        sheet={sheet}
        expanded={expanded}
        onToggle={toggle}
      />
      {expanded ? (
        <ExpandedPanel
          projectId={projectId}
          receiptId={sheet.receipt_id}
        />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Compact row
// ---------------------------------------------------------------------------
interface CompactRowProps {
  sheet: SheetReceiptDrawerProps['sheet'];
  expanded: boolean;
  onToggle: () => void;
}

function CompactRow({ sheet, expanded, onToggle }: CompactRowProps): React.ReactElement {
  const codes = sheet.disqualifier_codes ?? [];
  const visibleCodes = codes.length >= 4 ? codes.slice(0, 2) : codes;
  const overflow = codes.length >= 4 ? codes.length - 2 : 0;

  return (
    <Pressable
      onPress={onToggle}
      style={styles.compactRow}
      accessibilityRole="button"
      accessibilityLabel={expanded ? 'Hide provenance' : 'Show provenance'}
      testID="sheet-receipt-drawer-compact"
    >
      {sheet.tier ? <TierDot tier={sheet.tier} size={10} /> : null}
      {sheet.tier ? (
        <View
          style={[styles.chip, { backgroundColor: TIER_BG[sheet.tier] }]}
          testID="sheet-receipt-drawer-tier-chip"
        >
          <Text style={[styles.chipText, { color: TIER_FG[sheet.tier] }]}>
            {sheet.tier}
          </Text>
        </View>
      ) : null}
      {sheet.routing_action ? (
        <View
          style={[styles.chip, styles.routingChip]}
          testID="sheet-receipt-drawer-routing-chip"
        >
          <Text style={styles.chipText}>
            {ROUTING_LABEL[sheet.routing_action]}
          </Text>
        </View>
      ) : null}
      {visibleCodes.map((code) => (
        <View
          key={code}
          style={[styles.chip, styles.disqualifierChip]}
          testID={`sheet-receipt-drawer-disqualifier-${code}`}
        >
          <Text style={[styles.chipText, styles.disqualifierText]}>
            {disqualifierLabel(code)}
          </Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={[styles.chip, styles.disqualifierChip]}
          testID="sheet-receipt-drawer-disqualifier-overflow"
        >
          <Text style={[styles.chipText, styles.disqualifierText]}>
            +{overflow} more
          </Text>
        </View>
      ) : null}
      <View style={styles.caretSlot} testID="sheet-receipt-drawer-caret">
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color="rgba(255,255,255,0.55)"
        />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Expanded panel — lazy fetch
// ---------------------------------------------------------------------------
interface ExpandedPanelProps {
  projectId: string | null;
  receiptId: string | undefined;
}

function ExpandedPanel({ projectId, receiptId }: ExpandedPanelProps): React.ReactElement {
  const { receipt, isLoading, error } = useExtractionReceipt(projectId, receiptId ?? null);

  const handleCopy = useCallback(() => {
    if (!receiptId) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      // Fire-and-forget; clipboard rejection is harmless here.
      void navigator.clipboard.writeText(receiptId);
    }
    // Native no-op per spec.
  }, [receiptId]);

  if (isLoading) {
    return (
      <View style={styles.expanded} testID="sheet-receipt-drawer-loading">
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
        <View style={styles.skeletonRow} />
      </View>
    );
  }

  if (error || !receipt) {
    return (
      <View style={styles.expanded} testID="sheet-receipt-drawer-error">
        <Text style={styles.errorText}>Receipt unavailable</Text>
        {receiptId ? (
          <ReceiptIdRow receiptId={receiptId} onCopy={handleCopy} auditTrail={null} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.expanded} testID="sheet-receipt-drawer-expanded">
      <EvidenceSection receipt={receipt} />
      <MetricsSection receipt={receipt} />
      <ReceiptIdRow
        receiptId={receipt.receipt_id}
        onCopy={handleCopy}
        auditTrail={receipt.audit_trail}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
function EvidenceSection({
  receipt,
}: {
  receipt: NonNullable<ReturnType<typeof useExtractionReceipt>['receipt']>;
}): React.ReactElement {
  const topTokens = useMemo(
    () => (receipt.evidence_ocr_tokens ?? []).slice(0, 5),
    [receipt.evidence_ocr_tokens],
  );
  return (
    <View style={styles.section} testID="sheet-receipt-drawer-evidence">
      <Text style={styles.sectionHeader}>EVIDENCE</Text>
      {topTokens.length === 0 ? (
        <Text style={styles.bodyMuted}>No OCR tokens recorded.</Text>
      ) : (
        topTokens.map((tok, i) => {
          const text = tok.text.length > 32 ? `${tok.text.slice(0, 32)}…` : tok.text;
          const conf = `${(tok.confidence * 100).toFixed(1)}%`;
          return (
            <View key={`${tok.text}-${i}`} style={styles.tokenRow}>
              <Text style={styles.tokenText} numberOfLines={1}>{text}</Text>
              <Text style={styles.tokenConf}>{conf}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function MetricsSection({
  receipt,
}: {
  receipt: NonNullable<ReturnType<typeof useExtractionReceipt>['receipt']>;
}): React.ReactElement {
  const lines: string[] = [];
  if (receipt.iou !== undefined) lines.push(`IoU: ${receipt.iou.toFixed(2)}`);
  if (receipt.primitive_recall !== undefined)
    lines.push(`Recall: ${receipt.primitive_recall.toFixed(2)}`);
  if (receipt.primitive_precision !== undefined)
    lines.push(`Precision: ${receipt.primitive_precision.toFixed(2)}`);
  const cost = `$${receipt.cost_usd.toFixed(4)}`;
  const runtime = `${receipt.runtime_ms}ms`;
  return (
    <View style={styles.section} testID="sheet-receipt-drawer-metrics">
      <Text style={styles.sectionHeader}>METRICS</Text>
      {lines.map((l) => (
        <Text key={l} style={styles.body}>{l}</Text>
      ))}
      <Text style={styles.body}>{`Cost: ${cost} · Runtime: ${runtime}`}</Text>
    </View>
  );
}

function ReceiptIdRow({
  receiptId,
  onCopy,
  auditTrail,
}: {
  receiptId: string;
  onCopy: () => void;
  auditTrail: string | null;
}): React.ReactElement {
  return (
    <View style={styles.section} testID="sheet-receipt-drawer-receipt">
      <Text style={styles.sectionHeader}>RECEIPT</Text>
      <View style={styles.receiptIdRow}>
        <Text style={styles.receiptIdText} numberOfLines={1}>{receiptId}</Text>
        <Pressable
          onPress={onCopy}
          style={styles.copyBtn}
          accessibilityRole="button"
          accessibilityLabel="Copy receipt id"
          testID="sheet-receipt-drawer-copy"
        >
          <Text style={styles.copyBtnText}>Copy</Text>
        </Pressable>
      </View>
      {auditTrail ? (
        <Text style={styles.auditTrail} numberOfLines={1}>{auditTrail}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(11,13,18,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: 12,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  routingChip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  disqualifierChip: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.32)',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.85)',
  },
  disqualifierText: {
    color: '#fca5a5',
  },
  caretSlot: {
    marginLeft: 'auto',
    paddingHorizontal: 4,
  },
  expanded: {
    marginTop: 10,
    gap: 10,
  },
  section: {
    gap: 4,
  },
  sectionHeader: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
  },
  bodyMuted: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  tokenText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
  },
  tokenConf: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.62)',
    fontVariant: ['tabular-nums'],
  },
  receiptIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptIdText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Menlo',
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  copyBtnText: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  auditTrail: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'Menlo',
  },
  skeletonRow: {
    height: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorText: {
    fontSize: 12,
    color: 'rgba(252,165,165,0.85)',
  },
});
