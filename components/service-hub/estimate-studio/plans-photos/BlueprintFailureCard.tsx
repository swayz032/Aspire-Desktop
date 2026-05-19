/**
 * BlueprintFailureCard — surface Drew pipeline failures on the canvas.
 *
 * Premise (locked 2026-05-19): the user must NEVER stare at a shimmer when
 * Drew has actually died. Before this card existed, an INGEST failure left
 * the canvas in an infinite "loading" state because the polling hook saw
 * `stage_progress.ingest === 'failed'` and just kept spinning. This card
 * replaces that hole with a calm, premium failure surface that names the
 * failing stage, identifies the project + correlation IDs, and offers two
 * recovery paths (Try again with the SAME file · Start over).
 *
 * Voice: Drew's. Terse, factual, no apologies. The user is a contractor —
 * they want signal, not theatre. Each failed stage has a one-line copy
 * that names what stopped working AND who/what returned the error.
 *
 * Graceful degradation: backend hardening is in flight to ship structured
 * `failure_summary` payloads. When that's missing (older deploys, transient
 * race), the card still renders — just with generic copy and `—` in the
 * metadata block. Never crash, never hide.
 *
 * Aspire Laws:
 *   - #1 Single Brain: this card decides nothing — it just surfaces what
 *     the orchestrator has already concluded via stage_progress.
 *   - #7 Tools Are Hands: retry calls `useBlueprintUpload.retry()` which
 *     re-runs the same upload path; the backend's dedup logic owns the
 *     "skip failed, create fresh" decision.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type {
  BlueprintFailureSummary,
  StageKey,
} from '@/lib/api/blueprintsApi';

// ---------------------------------------------------------------------------
// Per-stage Drew copy. Keep terse. Two-sentence cap. Never apologize.
// ---------------------------------------------------------------------------

const STAGE_COPY: Record<StageKey, { label: string; subtitle: string }> = {
  ingest: {
    label: 'INGEST',
    subtitle: "Drew couldn't read the file. The OCR provider returned an error.",
  },
  classify: {
    label: 'CLASSIFY',
    subtitle:
      "Drew read the sheets but couldn't tag the disciplines. The classifier returned an error.",
  },
  see: {
    label: 'SEE',
    subtitle:
      "Drew got the disciplines but couldn't detect symbols. The vision model returned an error.",
  },
  reason: {
    label: 'REASON',
    subtitle:
      "Drew couldn't generate the story. The reasoner returned an error.",
  },
  procure: {
    label: 'PROCURE',
    subtitle:
      "Drew finished reading but couldn't price the materials. The supplier router returned an error.",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _shortId(id: string | null | undefined): string {
  if (!id) return '—';
  return id.slice(0, 8);
}

function _relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const delta = Date.now() - ts;
  if (delta < 0) return 'just now';
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface BlueprintFailureCardProps {
  /** The stage that died. Drives the title + subtitle copy. */
  failedStage: StageKey;
  /**
   * Structured failure detail, when available. MAY be `null` — the card
   * still renders, with `—` placeholders in the metadata block.
   */
  failureSummary: BlueprintFailureSummary | null;
  /** Project UUID for the metadata block (first 8 chars shown). */
  projectId: string | null;
  /** True while a retry is mid-flight — disables both buttons. */
  isRetrying?: boolean;
  /**
   * Re-run the same upload. Receives no args; the upload hook holds the
   * retained `File` reference. Called when the user hits "Try again".
   */
  onRetry: () => void;
  /**
   * Clear all project state and return the canvas to the upload dropzone.
   * Called when the user hits "Start over".
   */
  onStartOver: () => void;
  testID?: string;
}

export function BlueprintFailureCard({
  failedStage,
  failureSummary,
  projectId,
  isRetrying = false,
  onRetry,
  onStartOver,
  testID = 'blueprint-failure-card',
}: BlueprintFailureCardProps): React.ReactElement {
  const copy = STAGE_COPY[failedStage];

  return (
    <View style={styles.host} testID={testID}>
      {/* Icon — calm, never alarming. amber-gold accent matches the rest
          of the Aspire flat-premium card geometry, not red-screen-of-death. */}
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={26} color="#fbbf24" />
      </View>

      {/* Title + Drew subtitle */}
      <Text style={styles.title} testID="blueprint-failure-title">
        Drew couldn't finish this blueprint
      </Text>
      <Text style={styles.subtitle} testID="blueprint-failure-subtitle">
        {copy.subtitle}
      </Text>

      {/* Metadata block — hairline tracking-wide ui-monospace */}
      <View style={styles.metaBlock} testID="blueprint-failure-meta">
        <MetaRow label="STAGE" value={copy.label} accent />
        <MetaRow label="PROJECT" value={_shortId(projectId)} />
        <MetaRow
          label="CORRELATION"
          value={_shortId(failureSummary?.correlation_id)}
        />
        <MetaRow label="WHEN" value={_relativeTime(failureSummary?.occurred_at)} />
        {failureSummary?.error_class ? (
          <MetaRow
            label="ERROR"
            value={failureSummary.error_class}
            testID="blueprint-failure-error-class"
          />
        ) : null}
      </View>

      {/* Optional verbatim error message — only when backend ships it.
          Truncated to a single line to keep the card calm. */}
      {failureSummary?.error_message ? (
        <Text
          style={styles.errorMessage}
          numberOfLines={2}
          testID="blueprint-failure-error-message"
        >
          {failureSummary.error_message}
        </Text>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onRetry}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Try again — re-upload the same file"
          accessibilityState={{ disabled: isRetrying }}
          testID="blueprint-failure-retry"
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
            styles.btn,
            styles.btnPrimary,
            isRetrying && styles.btnDisabled,
            hovered && !isRetrying && styles.btnPrimaryHover,
            pressed && !isRetrying && styles.btnPressed,
          ]}
        >
          <Ionicons
            name={isRetrying ? 'sync-outline' : 'refresh-outline'}
            size={14}
            color="#0a0a0a"
          />
          <Text style={styles.btnPrimaryLabel}>
            {isRetrying ? 'Retrying…' : 'Try again'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onStartOver}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Start over — clear project and return to upload"
          accessibilityState={{ disabled: isRetrying }}
          testID="blueprint-failure-start-over"
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
            styles.btn,
            styles.btnSecondary,
            isRetrying && styles.btnDisabled,
            hovered && !isRetrying && styles.btnSecondaryHover,
            pressed && !isRetrying && styles.btnPressed,
          ]}
        >
          <Text style={styles.btnSecondaryLabel}>Start over</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetaRow({
  label,
  value,
  accent = false,
  testID,
}: {
  label: string;
  value: string;
  accent?: boolean;
  testID?: string;
}): React.ReactElement {
  return (
    <View style={styles.metaRow} testID={testID}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, accent && styles.metaValueAccent]}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — deep ink card, hairline 8% white border, amber-gold accent.
// Matches the Aspire flat-premium card geometry (CLS=0, min-height floor).
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 320,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    maxWidth: 420,
    lineHeight: 18,
    letterSpacing: -0.05,
  },
  metaBlock: {
    marginTop: 6,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(0,0,0,0.18)',
    minWidth: 280,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 18,
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.42)',
    letterSpacing: 1.6,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.4,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontVariant: ['tabular-nums'],
  },
  metaValueAccent: {
    color: '#fbbf24',
    fontWeight: '800',
  },
  errorMessage: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: 0.2,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    textAlign: 'center',
    maxWidth: 480,
    paddingHorizontal: 8,
  },
  actions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 132,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? (({
          transition: 'background-color 150ms ease, border-color 150ms ease, opacity 150ms ease',
          cursor: 'pointer',
        } as unknown) as ViewStyle)
      : {}),
  },
  btnPrimary: {
    backgroundColor: '#fbbf24',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  btnPrimaryHover: {
    backgroundColor: '#fcd34d',
    borderColor: '#fcd34d',
  },
  btnPrimaryLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0a0a0a',
    letterSpacing: -0.1,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  btnSecondaryHover: {
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  btnSecondaryLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: -0.1,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
