/**
 * /office-memory/[memoryId] — Pass 15 type-routed detail page.
 *
 * Layout (per plan §15.A):
 *   - DesktopShell chrome
 *   - MemoryDetailHeader (full width)
 *   - 2-column grid (web) / stack (native):
 *       Center column: per-type body (router resolves the right component)
 *       Right rail:    composed metadata (sticky on web)
 *
 * Background = Colors.memory.pageBackground (#0a0a0c).
 *
 * The per-type detail components are the centerpiece. The shared chrome
 * (header + right rail) keeps the visual frame stable across types so the
 * eye lands on the type-specific story (table, transcript, chat, recording,
 * narrative) immediately.
 *
 * Loading / empty / error states have personality per §12.1:
 *   - Loading: skeleton tiles matching layout shape with shimmer.
 *   - Empty:   subtle illustration + helpful copy + "Open in raw view".
 *   - Error:   explanation + retry CTA + raw view fallback.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DesktopShell } from '@/components/desktop/DesktopShell';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { useMemoryDetail } from '@/lib/memory/useMemoryDetail';
import { Colors, BorderRadius } from '@/constants/tokens';
import { injectMemoryKeyframes } from '@/components/office-memory/cardAnimations';

import type { MemoryDetail, MemoryType } from '@/components/office-memory/types';
import {
  MemoryDetailHeader,
  MemoryDetailRightRail,
  MemoryDetailNote,
  MemoryDetailDocument,
  MemoryDetailStrategy,
  MemoryDetailResearch,
  MemoryDetailTask,
  MemoryDetailSummary,
  MemoryDetailTranscript,
  MemoryDetailSession,
  MemoryDetailMeeting,
  MemoryDetailZoom,
  MemoryDetailCall,
  MemoryDetailInvoice,
  MemoryDetailQuote,
  MemoryDetailSMS,
} from '@/components/office-memory/details';

// ─── Type-router map ────────────────────────────────────────────────────────
//
// Centralized mapping from memory_type → detail body component. New types
// extend the map here only — page glue stays untouched. Components that
// haven't shipped yet fall back to MemoryDetailNote.

type DetailBody = React.ComponentType<{ memory: MemoryDetail }>;

const TYPE_TO_COMPONENT: Record<MemoryType, DetailBody> = {
  meeting: MemoryDetailMeeting as DetailBody,
  call: MemoryDetailCall as DetailBody,
  session_summary: MemoryDetailSession as DetailBody,
  transcript: MemoryDetailTranscript as DetailBody,
  sms_thread: MemoryDetailSMS as DetailBody,
  invoice: MemoryDetailInvoice as DetailBody,
  quote: MemoryDetailQuote as DetailBody,
  contract: MemoryDetailNote as DetailBody, // Lane B Contract not in scope this pass
  document: MemoryDetailDocument as DetailBody,
  note: MemoryDetailNote as DetailBody,
  strategy: MemoryDetailStrategy as DetailBody,
  research: MemoryDetailResearch as DetailBody,
  task: MemoryDetailTask as DetailBody,
  summary: MemoryDetailSummary as DetailBody,
  // Coordination-spine types — V1 fall back to Note layout.
  decision_fact: MemoryDetailNote as DetailBody,
  handoff_note: MemoryDetailNote as DetailBody,
  pending_intent: MemoryDetailNote as DetailBody,
  authority_context: MemoryDetailNote as DetailBody,
  thread_summary: MemoryDetailSummary as DetailBody,
  office_brief: MemoryDetailSummary as DetailBody,
  finance_brief: MemoryDetailSummary as DetailBody,
  risk_flag: MemoryDetailNote as DetailBody,
  followup_task: MemoryDetailTask as DetailBody,
  timeline_event: MemoryDetailNote as DetailBody,
  artifact_reference: MemoryDetailDocument as DetailBody,
  receipt_reference: MemoryDetailNote as DetailBody,
  workflow_reference: MemoryDetailNote as DetailBody,
};

// Inject keyframes once for skeleton shimmer + bubble pop.
injectMemoryKeyframes();

function OfficeMemoryDetailInner() {
  const router = useRouter();
  const { memoryId } = useLocalSearchParams<{ memoryId: string }>();
  const { memory, loading, error } = useMemoryDetail(memoryId);
  const [rawMode, setRawMode] = useState(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.push('/office-memory' as never);
  }, [router]);

  const Body = useMemo<DetailBody | null>(() => {
    if (!memory) return null;
    return TYPE_TO_COMPONENT[memory.type] ?? MemoryDetailNote;
  }, [memory]);

  // ─── Loading skeleton (matches the final layout shape) ─────────────────
  if (loading) {
    return (
      <DesktopShell>
        <View style={styles.scroll}>
          <View style={styles.container}>
            <DetailSkeleton />
          </View>
        </View>
      </DesktopShell>
    );
  }

  // ─── Error or missing ─────────────────────────────────────────────────
  if (error || !memory) {
    return (
      <DesktopShell>
        <View style={styles.scroll}>
          <View style={styles.container}>
            <DetailEmptyOrError
              variant={error ? 'error' : 'empty'}
              error={error}
              memoryId={memoryId}
              onBack={handleBack}
            />
          </View>
        </View>
      </DesktopShell>
    );
  }

  // ─── Successful render ────────────────────────────────────────────────
  return (
    <DesktopShell>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <MemoryDetailHeader memory={memory} onBack={handleBack} />

        {rawMode ? (
          <RawView memory={memory} onClose={() => setRawMode(false)} />
        ) : (
          <View style={styles.grid}>
            <View style={styles.center}>
              {Body ? <Body memory={memory} /> : <MemoryDetailNote memory={memory} />}
            </View>
            <View style={styles.right}>
              <MemoryDetailRightRail memory={memory} />
            </View>
          </View>
        )}

        {/* Footer — toggle raw view (power-user escape hatch) */}
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => setRawMode((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={rawMode ? 'Exit raw view' : 'Open raw JSON view'}
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
              styles.footerButton,
              hovered && styles.footerButtonHover,
              pressed && styles.footerButtonPressed,
            ]}
          >
            <Ionicons
              name={rawMode ? 'eye-off-outline' : 'code-slash-outline'}
              size={14}
              color={Colors.text.tertiary as string}
            />
            <Text style={styles.footerButtonText}>
              {rawMode ? 'Exit raw view' : 'View raw JSON'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <View accessibilityLabel="Loading memory" accessibilityRole="progressbar">
      <View style={styles.skeletonHeader}>
        <Skel width={140} height={14} style={{ marginBottom: 18 }} />
        <Skel width={420} height={32} style={{ marginBottom: 10 }} />
        <Skel width={260} height={14} />
      </View>
      <View style={styles.grid}>
        <View style={styles.center}>
          <SkelCard height={120} />
          <SkelCard height={220} />
          <SkelCard height={180} />
        </View>
        <View style={styles.right}>
          <SkelCard height={140} />
          <SkelCard height={180} />
        </View>
      </View>
    </View>
  );
}

function Skel({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        skelStyles.bar,
        { width, height, borderRadius: Math.min(8, height / 2) },
        style,
      ]}
      {...(Platform.OS === 'web'
        ? ({
            style: {
              width,
              height,
              borderRadius: Math.min(8, height / 2),
              backgroundImage:
                'linear-gradient(90deg, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.18) 50%, rgba(59,130,246,0.06) 100%)',
              backgroundSize: '200% 100%',
              animation: 'memoryShimmer 1600ms linear infinite',
              ...(style as React.CSSProperties),
            },
          } as object)
        : {})}
    />
  );
}

function SkelCard({ height }: { height: number }) {
  return (
    <View
      style={[skelStyles.card, { height }]}
      {...(Platform.OS === 'web'
        ? ({
            style: {
              height,
              borderRadius: BorderRadius.xl,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              backgroundImage:
                'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(59,130,246,0.10) 50%, rgba(255,255,255,0.02) 100%)',
              backgroundSize: '200% 100%',
              animation: 'memoryShimmer 1800ms linear infinite',
            },
          } as object)
        : {})}
    />
  );
}

const skelStyles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(59,130,246,0.10)',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(59,130,246,0.04)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
});

// ─── Empty / error state ───────────────────────────────────────────────────

function DetailEmptyOrError({
  variant,
  error,
  memoryId,
  onBack,
}: {
  variant: 'empty' | 'error';
  error: Error | null;
  memoryId: string | undefined;
  onBack: () => void;
}) {
  const title = variant === 'error' ? "We couldn't load that memory" : 'Memory not found';
  const body =
    variant === 'error'
      ? error?.message || 'Something interrupted the request mid-flight. Try again, or open the raw view to inspect what was returned.'
      : `We searched for "${memoryId ?? 'that memory'}" but nothing matched. It may have been deleted, superseded, or live under a different ID.`;

  return (
    <View style={emptyStyles.wrap}>
      <View style={emptyStyles.iconRing}>
        <Ionicons
          name={variant === 'error' ? 'pulse' : 'archive-outline'}
          size={32}
          color={variant === 'error' ? '#FB7185' : '#60A5FA'}
        />
      </View>
      <Text style={emptyStyles.title}>{title}</Text>
      <Text style={emptyStyles.body}>{body}</Text>

      <View style={emptyStyles.ctaRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to memory results"
          style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
            emptyStyles.cta,
            hovered && emptyStyles.ctaHover,
            pressed && emptyStyles.ctaPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={14} color={'#FFFFFF'} />
          <Text style={emptyStyles.ctaText}>Back to results</Text>
        </Pressable>

        {variant === 'error' && (
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            style={({ hovered, pressed }: { hovered?: boolean; pressed?: boolean }) => [
              emptyStyles.ctaSecondary,
              hovered && emptyStyles.ctaSecondaryHover,
              pressed && emptyStyles.ctaPressed,
            ]}
          >
            <Ionicons name="refresh" size={14} color={Colors.text.secondary as string} />
            <Text style={emptyStyles.ctaSecondaryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  wrap: {
    paddingVertical: 96,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.20)',
    marginBottom: 8,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 6px rgba(59,130,246,0.04), 0 0 32px rgba(59,130,246,0.18)',
        } as unknown as ViewStyle)
      : {}),
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary as string,
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 21,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent.cyan as string,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'transform 140ms ease-out, box-shadow 140ms ease-out',
          boxShadow: '0 0 0 1px rgba(59,130,246,0.30), 0 4px 18px rgba(59,130,246,0.32)',
        } as unknown as ViewStyle)
      : {}),
  },
  ctaHover: {
    transform: [{ translateY: -1 }],
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  ctaSecondaryHover: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  ctaSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary as string,
    letterSpacing: 0.1,
  },
});

// ─── Raw JSON view (power-user fallback) ────────────────────────────────────

function RawView({ memory, onClose }: { memory: MemoryDetail; onClose: () => void }) {
  let pretty: string;
  try {
    pretty = JSON.stringify(memory, null, 2);
  } catch {
    pretty = '{}';
  }
  return (
    <View style={rawStyles.wrap}>
      <View style={rawStyles.headerRow}>
        <Text style={rawStyles.eyebrow}>Raw JSON</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close raw view"
          style={({ pressed }) => [rawStyles.closeBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="close" size={16} color={Colors.text.secondary as string} />
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Text style={rawStyles.code}>{pretty}</Text>
      </ScrollView>
    </View>
  );
}

const rawStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0c0c10',
    borderRadius: BorderRadius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  code: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, "JetBrains Mono", Menlo, monospace' }),
    color: '#93C5FD',
    lineHeight: 18,
  },
});

// ─── Page styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.memory.pageBackground as string,
    margin: -16, // negate DesktopShell padding so the page is full-bleed
  },
  container: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    paddingBottom: 64,
    maxWidth: 1280,
    alignSelf: 'center',
    width: '100%',
  },
  grid: {
    ...(Platform.OS === 'web'
      ? ({
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 360px',
          gap: 24,
          alignItems: 'start',
        } as unknown as ViewStyle)
      : { gap: 24 }),
  },
  center: {
    gap: 16,
    minWidth: 0,
  },
  right: {
    gap: 16,
    minWidth: 0,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : {}),
  },
  footerButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  footerButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  footerButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.2,
  },
  skeletonHeader: {
    marginBottom: 32,
  },
});

export default function OfficeMemoryDetail() {
  return (
    <PageErrorBoundary pageName="office-memory-detail">
      <OfficeMemoryDetailInner />
    </PageErrorBoundary>
  );
}
