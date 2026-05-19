/**
 * ServiceBriefCard — Wave 5.1b.
 *
 * Tim Rail Context payload for Service Hub routes. Summarizes the office's
 * Service Memory in a flat-premium card matching PropertySummaryCard
 * geometry. Five service-specific counters + "View all →" deep link to
 * `/service-hub/memory`.
 *
 * Renders three discrete states:
 *   - Loading  → shimmer skeletons (matches Memory cards' shimmer)
 *   - Error    → inline error with "Retry" link
 *   - Loaded   → 5-counter grid (Picks / Overrides / Pending / Handoffs / Threads)
 *
 * Law compliance:
 *   Law #6 — officeId comes from caller (sourced from useTenant); never URL.
 *   Law #7 — pure render; data flows through useServiceBrief.
 *   Law #9 — error messages do not leak backend internals (codes only).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SheenBlock } from './estimate-studio/visuals/InsightCardBase';
import { useServiceBrief, type ServiceBriefOut } from '@/hooks/useServiceBrief';

interface ServiceBriefCardProps {
  officeId: string;
  /** Optional override of the "View all" handler. Defaults to router.push. */
  onViewAllPress?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Counter cell
// ---------------------------------------------------------------------------

interface CounterCellProps {
  icon: string;
  count: number;
  label: string;
  testID: string;
  fullWidth?: boolean;
}

function CounterCell({ icon, count, label, testID, fullWidth }: CounterCellProps) {
  return (
    <View
      style={[styles.counterCell, fullWidth && styles.counterCellFull]}
      testID={testID}
    >
      <Text style={styles.counterIcon}>{icon}</Text>
      <Text style={styles.counterValue} numberOfLines={1} adjustsFontSizeToFit>
        {count}
      </Text>
      <Text style={styles.counterLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function ServiceBriefCard({ officeId, onViewAllPress }: ServiceBriefCardProps) {
  const router = useRouter();
  const { brief, loading, error, refresh } = useServiceBrief(officeId);

  const handleViewAll = React.useCallback(() => {
    if (onViewAllPress) {
      onViewAllPress();
      return;
    }
    // Same-origin deep link to the Service Memory home (built in the
    // parallel `feat/wave-5-1b-service-memory-frontend` PR).
    router.push('/service-hub/memory' as never);
  }, [onViewAllPress, router]);

  return (
    <View style={styles.card} testID="service-brief-card">
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="briefcase-outline" size={13} color="rgba(255,255,255,0.62)" />
          <Text style={styles.headerTitle}>Service Memory</Text>
        </View>
        <Pressable
          onPress={handleViewAll}
          accessibilityRole="link"
          accessibilityLabel="View all service memory"
          testID="service-brief-view-all"
          style={({ hovered, pressed }: any) => [
            styles.viewAll,
            hovered && styles.viewAllHover,
            pressed && styles.viewAllPressed,
          ]}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons name="arrow-forward" size={11} color="rgba(255,255,255,0.78)" />
        </Pressable>
      </View>

      {/* BODY */}
      {loading && !brief ? (
        <LoadingState />
      ) : error && !brief ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <LoadedState brief={brief} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <View style={styles.body} testID="service-brief-card-loading">
      <View style={styles.counterGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View style={styles.counterCell} key={i}>
            <SheenBlock width={20} height={20} radius={4} />
            <SheenBlock width={36} height={22} radius={4} style={{ marginTop: 6 }} />
            <SheenBlock width={56} height={9} radius={3} style={{ marginTop: 4 }} />
          </View>
        ))}
        <View style={[styles.counterCell, styles.counterCellFull]} key="last">
          <SheenBlock width={20} height={20} radius={4} />
          <SheenBlock width={36} height={22} radius={4} style={{ marginTop: 6 }} />
          <SheenBlock width={80} height={9} radius={3} style={{ marginTop: 4 }} />
        </View>
      </View>
      <SheenBlock width={100} height={9} radius={3} style={{ alignSelf: 'flex-end' }} />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorState} testID="service-brief-card-error" accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={14} color="#ff6b6b" />
      <View style={styles.errorBody}>
        <Text style={styles.errorTitle}>Could not load brief</Text>
        <Text style={styles.errorMessage} numberOfLines={2}>
          {message}
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading service brief"
          testID="service-brief-retry"
          style={({ hovered, pressed }: any) => [
            styles.retry,
            hovered && styles.retryHover,
            pressed && styles.retryPressed,
          ]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadedState({ brief }: { brief: ServiceBriefOut | null }) {
  // Null/empty brief: render zeros (never "—" or "no data") so the geometry
  // is stable regardless of office freshness. Last-built shows "—".
  const b: ServiceBriefOut = brief ?? {
    recent_picks_count: 0,
    recent_overrides_count: 0,
    open_pending_intents_count: 0,
    recent_handoffs_count: 0,
    active_threads_count: 0,
    due_now_count: 0,
    overdue_count: 0,
    pending_approval_count: 0,
    recent_receipts_count: 0,
    last_built_at: '',
  };

  return (
    <View style={styles.body} testID="service-brief-card-loaded">
      <View style={styles.counterGrid}>
        <CounterCell
          icon="📦"
          count={b.recent_picks_count}
          label="Picks"
          testID="service-brief-counter-picks"
        />
        <CounterCell
          icon="🔁"
          count={b.recent_overrides_count}
          label="Overrides"
          testID="service-brief-counter-overrides"
        />
        <CounterCell
          icon="⏳"
          count={b.open_pending_intents_count}
          label="Pending"
          testID="service-brief-counter-pending"
        />
        <CounterCell
          icon="🤝"
          count={b.recent_handoffs_count}
          label="Handoffs"
          testID="service-brief-counter-handoffs"
        />
        <CounterCell
          icon="🧵"
          count={b.active_threads_count}
          label="Active threads"
          testID="service-brief-counter-threads"
          fullWidth
        />
      </View>
      <Text style={styles.footer} testID="service-brief-footer">
        Updated {relativeTime(b.last_built_at)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — mirrors PropertySummaryCard flat-premium geometry (Lock #13/14).
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0c0c10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewAllHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  viewAllPressed: {
    opacity: 0.7,
  },
  viewAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: -0.05,
  },

  body: {
    gap: 10,
  },
  counterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  counterCell: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'flex-start',
    gap: 2,
  },
  counterCellFull: {
    flexBasis: '100%',
  },
  counterIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  counterValue: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.96)',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.50)',
    letterSpacing: -0.05,
  },
  footer: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.40)',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  // ERROR
  errorState: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,107,107,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.22)',
  },
  errorBody: {
    flex: 1,
    gap: 4,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ff6b6b',
    letterSpacing: -0.1,
  },
  errorMessage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 16,
  },
  retry: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 4,
  },
  retryHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  retryPressed: {
    opacity: 0.85,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
});
