/**
 * Visuals tab — Service Hub Phase 3, Pass 3.2.
 *
 * Composes the property-aware Visuals tab from Adam-sourced data.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ HeroSwitcher (5 modes — streetview / aerial / interior / │
 *   │                exterior / roof — 200ms cross-fade)        │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ PropertyImagesGrid (mode-switcher cards)                  │
 *   ├──────────────────────────────────────────────────────────┤
 *   │ PropertyInsights · TotalBuildingArea · MaterialSignals ·  │
 *   │ QuickCostInt                                              │
 *   └──────────────────────────────────────────────────────────┘
 *
 * The 13 visual components are being built in parallel by the
 * `uiux-implementer` agent under
 * `components/service-hub/estimate-studio/visuals/*`. We import them via
 * `require()` so that Pass 3.2 still typechecks + renders gracefully if a
 * component lands a few minutes later than the data layer.
 *
 * Aspire Law compliance:
 *   - Law #6: address comes from URL/store, never from a tenant input.
 *   - Law #7: render layer only — clicks set `useHeroMode` state.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProjectAddress, setProjectAddress } from '@/hooks/useProjectAddress';
import { useHeroMode, type HeroMode } from '@/hooks/useHeroMode';
import { usePropertyData } from '@/hooks/usePropertyData';

// Static imports — components ship in this same commit (Pass 3.2).
// Hero + photo grid only. PropertyInsights / TotalBuildingArea / MaterialSignals /
// QuickCostInt cards were removed from the canvas (founder decision 2026-05-10) —
// all that detail now lives in the Tim rail Context tab in a premium layout.
import { HeroSwitcher } from '@/components/service-hub/estimate-studio/visuals/HeroSwitcher';
import { PropertyImagesGrid } from '@/components/service-hub/estimate-studio/visuals/PropertyImagesGrid';

export default function VisualsTab() {
  const { address } = useProjectAddress();
  const { mode, setMode } = useHeroMode();
  const {
    data,
    status,
    error,
    suggestedAddress,
    retry,
    forceRefresh,
  } = usePropertyData(address);

  const isLoading = status === 'loading';

  // ---- Empty / error states ------------------------------------------------
  if (status === 'idle') {
    return <EmptyState />;
  }
  if (status === 'invalid') {
    return <InvalidAddressBanner message={error ?? 'Address could not be verified.'} onRetry={retry} />;
  }
  if (status === 'needs_correction') {
    return (
      <CorrectionPrompt
        suggested={suggestedAddress ?? ''}
        onAccept={(addr) => {
          // Push the corrected address into the shared store; usePropertyData
          // will re-fire automatically.
          setProjectAddress(addr);
        }}
        onDismiss={retry}
      />
    );
  }
  if (status === 'error') {
    return <ErrorBanner message={error ?? 'Could not load property data.'} onRetry={retry} />;
  }

  // ---- Main composition ----------------------------------------------------
  return (
    <View style={styles.container} testID="estimate-studio-visuals-tab">
      <View style={styles.heroSlot}>
        <HeroSwitcher
          mode={mode}
          onModeChange={setMode}
          data={data}
          loading={isLoading}
        />
      </View>

      <View style={styles.gridSlot}>
        <PropertyImagesGrid
          photos={data?.photos}
          aerialThumbUrl={data?.hero?.aerialThumbUrl}
          activeMode={mode}
          onLaneClick={(lane: HeroMode) => setMode(lane)}
          loading={isLoading}
        />
      </View>

      {status === 'partial' && (
        <View style={styles.partialBanner} testID="visuals-partial-banner">
          <Ionicons name="information-circle-outline" size={14} color="#fbbf24" />
          <Text style={styles.partialText}>
            Some data sources are still loading. Insights will refine as they arrive.
          </Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// State views — premium-quality fallbacks so the page never looks broken.
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <View style={styles.stateContainer} testID="visuals-empty-state">
      <View style={styles.iconWrap}>
        <Ionicons name="search-outline" size={28} color="rgba(255,255,255,0.30)" />
      </View>
      <Text style={styles.stateTitle}>Enter a property address</Text>
      <Text style={styles.stateSubtitle}>
        Type an address above to load Street View, photos, and property facts.
      </Text>
    </View>
  );
}

function InvalidAddressBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateContainer} testID="visuals-invalid-banner">
      <View style={[styles.iconWrap, styles.iconWrapWarn]}>
        <Ionicons name="alert-circle-outline" size={28} color="#fbbf24" />
      </View>
      <Text style={styles.stateTitle}>Address could not be verified</Text>
      <Text style={styles.stateSubtitle}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry address lookup"
        onPress={onRetry}
        style={styles.actionButton}
      >
        <Text style={styles.actionButtonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function CorrectionPrompt({
  suggested,
  onAccept,
  onDismiss,
}: {
  suggested: string;
  onAccept: (addr: string) => void;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.stateContainer} testID="visuals-correction-prompt">
      <View style={[styles.iconWrap, styles.iconWrapWarn]}>
        <Ionicons name="navigate-outline" size={28} color="#fbbf24" />
      </View>
      <Text style={styles.stateTitle}>Did you mean…</Text>
      <Text style={styles.stateSubtitle}>{suggested}</Text>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Accept corrected address"
          onPress={() => onAccept(suggested)}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Use this address</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Keep typed address"
          onPress={onDismiss}
          style={[styles.actionButton, styles.actionButtonGhost]}
        >
          <Text style={styles.actionButtonTextGhost}>Keep mine</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateContainer} testID="visuals-error-banner">
      <View style={[styles.iconWrap, styles.iconWrapError]}>
        <Ionicons name="cloud-offline-outline" size={28} color="#ff6b6b" />
      </View>
      <Text style={styles.stateTitle}>Could not load property data</Text>
      <Text style={styles.stateSubtitle}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry property data fetch"
        onPress={onRetry}
        style={styles.actionButton}
      >
        <Text style={styles.actionButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function HeroFallback({ mode, loading }: { mode: HeroMode; loading: boolean }) {
  return (
    <View style={styles.heroFallback} testID="visuals-hero-fallback">
      {loading ? (
        <ActivityIndicator color="rgba(255,255,255,0.45)" />
      ) : (
        <Text style={styles.heroFallbackText}>Hero ({mode})</Text>
      )}
    </View>
  );
}

function SkeletonCard() {
  return <View style={styles.skeletonCard} accessibilityRole="none" />;
}

// ---------------------------------------------------------------------------
// Styles — premium UX bar (no CLS, soft rounded banners).
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  heroSlot: {
    // flex:1 so the hero fills whatever vertical space is LEFT after
    // the gridSlot reserves its row. Without flex, heroSlot stayed at
    // minHeight 360 and the gridSlot could push past the canvas
    // bottom, cutting photo cards off.
    flex: 1,
    width: '100%',
    minHeight: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F0F12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 360,
  },
  heroFallbackText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
  },
  gridSlot: {
    width: '100%',
    // Fixed-height row for the photo lane cards. 96 was too short — the
    // PropertyImagesGrid cards (image + label) need ~140px to render
    // fully and were getting clipped at the bottom of the canvas.
    height: 140,
  },
  skeletonRow: {
    height: 96,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  insightCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skeletonCard: {
    flex: 1,
    minWidth: 200,
    height: 120,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  partialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.18)',
  },
  partialText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: -0.1,
  },
  // ---- state views --------------------------------------------------------
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    minHeight: 480,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapWarn: {
    backgroundColor: 'rgba(251,191,36,0.06)',
    borderColor: 'rgba(251,191,36,0.18)',
  },
  iconWrapError: {
    backgroundColor: 'rgba(255,107,107,0.06)',
    borderColor: 'rgba(255,107,107,0.18)',
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.2,
  },
  stateSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 460,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#fbbf24',
    marginTop: 12,
  },
  actionButtonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: -0.1,
  },
  actionButtonTextGhost: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.1,
  },
});
